import Event from "@/lib/models/Event";
import {
  findDuplicates,
  findSameSourceDuplicates,
  findBestMatch,
  getMatchId,
  mergeEvents
} from "@/lib/utils/deduplication";
import {
  processNewEventNotifications,
  processFavouritedEventUpdate
} from "@/lib/services";
import type { NormalisedEvent, EventForDedup } from "@/lib/scrapers/types";

interface Stats {
  inserted: number;
  updated: number;
  merged: number;
  skipped: number;
  notifications: number;
}

interface EventChanges {
  priceDropped?: boolean;
  priceDrop?: number;
  significantUpdate?: string;
  hasChanges?: boolean;
  hasContentChanges?: boolean;
}

interface Decision {
  action: "insert" | "update" | "update-migrate" | "merge" | "skip";
  event: NormalisedEvent;
  existingId?: string;
  reason?: string;
  changes?: EventChanges;
  fullExisting?: any;
}

interface ProcessContext {
  existing: any[];
  bySourceId: Map<string, any>;
  byNameVenue: Map<string, any>;
  existingDedup: (EventForDedup & { _id: string })[];
  batchDecided: (EventForDedup & { _id: string })[];
  sourceName: string;
}

const PRICE_CHANGE_THRESHOLD = 5;
const SIGNIFICANT_KEYWORDS = [
  "cancelled",
  "postponed",
  "rescheduled",
  "sold out",
  "extra show",
  "additional show",
  "new date",
  "date change"
];

/**
 * Processes scraped events with intelligent deduplication and merging.
 *
 * Algorithm:
 * 1. Load all existing events from database
 * 2. Decide action for each event (pure in-memory, no DB writes)
 * 3. Execute all decisions in a single bulkWrite
 * 4. Send notifications for inserts, price drops, and significant changes
 */
export async function processEventsWithDeduplication(
  newEvents: NormalisedEvent[],
  sourceName: string
): Promise<Stats> {
  console.log(`\n[Dedup] Processing ${newEvents.length} events from '${sourceName}'`);

  const existing = await Event.find({ isArchived: { $ne: true } }).lean();
  console.log(`[Dedup] Found ${existing.length} existing events in database`);

  const context: ProcessContext = {
    existing,
    bySourceId: buildSourceIdMap(existing),
    byNameVenue: buildNameVenueMap(existing, sourceName),
    existingDedup: mapToEventForDedup(existing),
    batchDecided: [],
    sourceName
  };

  // Phase 1: Decide what to do with each event (pure in-memory)
  const decisions: Decision[] = [];
  for (const event of newEvents) {
    const decision = decide(event, context);
    decisions.push(decision);

    // Track inserted/merged events so later events in the batch can deduplicate against them
    if (decision.action === "insert") {
      const tempId = `temp:${event.sourceId}`;
      context.batchDecided.push({
        _id: tempId,
        ...event,
        subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : [])
      });
    }
  }

  // Phase 2: Execute all decisions in one bulkWrite
  const stats = await executeBulk(decisions, existing);

  console.log(
    `[Dedup] Complete: ${stats.inserted} inserted, ${stats.updated} updated, ` +
    `${stats.merged} merged, ${stats.skipped} skipped, ${stats.notifications} notifications\n`
  );

  return stats;
}

/**
 * Decides what action to take for a single event without touching the database.
 *
 * Priority order:
 * 1. Exact source + sourceId match → update
 * 2. Name + venue match (Ticketmaster sourceId migration) → update + migrate
 * 3. Same-source duplicate (e.g. multi-tier listings) → update canonical or skip
 * 4. Cross-source fuzzy match → merge
 * 5. No match → insert
 */
function decide(event: NormalisedEvent, context: ProcessContext): Decision {
  const { existing, bySourceId, byNameVenue, existingDedup, batchDecided } = context;

  // Step 1: Exact source + sourceId match
  const sameSource = bySourceId.get(`${event.source}:${event.sourceId}`);
  if (sameSource) {
    return {
      action: "update",
      event,
      existingId: sameSource._id.toString(),
      changes: detectAllChanges(sameSource, event),
      fullExisting: sameSource
    };
  }

  // Step 2: Name + venue match for Ticketmaster sourceId migration
  if (event.source === "ticketmaster") {
    const nameVenueMatch = byNameVenue.get(createNameVenueKey(event));
    if (nameVenueMatch) {
      return {
        action: "update-migrate",
        event,
        existingId: nameVenueMatch._id.toString(),
        changes: detectAllChanges(nameVenueMatch, event),
        fullExisting: nameVenueMatch,
        reason: "migrated sourceId"
      };
    }
  }

  const tempId = `temp:${event.sourceId}`;
  const eventDedup: EventForDedup & { _id: string } = {
    _id: tempId,
    ...event,
    subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : [])
  };

  // Step 3: Same-source duplicate check (e.g. Ticketmaster multi-tier listings)
  const sameSourcePool = [...existingDedup, ...batchDecided, eventDedup]
    .filter(e => e.source === event.source);
  const sameSourceMatch = findBestMatch(tempId, findSameSourceDuplicates(sameSourcePool));

  if (sameSourceMatch) {
    const matchId = getMatchId(tempId, sameSourceMatch);
    const dbMatch = existing.find(e => e._id.toString() === matchId);

    if (dbMatch) {
      return {
        action: "update",
        event,
        existingId: matchId,
        changes: detectAllChanges(dbMatch, event),
        fullExisting: dbMatch,
        reason: sameSourceMatch.reason
      };
    }

    // Match is in batchDecided — skip to avoid inserting a duplicate
    return { action: "skip", event };
  }

  // Step 4: Cross-source fuzzy deduplication
  const pool = [...existingDedup, ...batchDecided, eventDedup];
  const crossSourceMatch = findBestMatch(tempId, findDuplicates(pool));

  if (crossSourceMatch) {
    const matchId = getMatchId(tempId, crossSourceMatch);
    const dbMatch = existing.find(e => e._id.toString() === matchId);
    const batchMatch = batchDecided.find(e => e._id === matchId);

    if (dbMatch || batchMatch) {
      const targetDedup = dbMatch ? mapToEventForDedup([dbMatch])[0] : batchMatch!;
      const changes = detectAllChanges(targetDedup, event);
      const existingSources = dbMatch?.sources || [];
      const isNewSource = !existingSources.includes(event.source);

      // Skip if nothing new to contribute
      if (!changes.hasChanges && !isNewSource) return { action: "skip", event };

      return {
        action: "merge",
        event,
        existingId: matchId,
        changes,
        fullExisting: dbMatch,
        reason: crossSourceMatch.reason
      };
    }
  }

  // Step 5: No match — insert as new
  return { action: "insert", event };
}

/**
 * Executes all decisions in a single bulkWrite, then sends notifications.
 */
async function executeBulk(decisions: Decision[], existing: any[]): Promise<Stats> {
  const stats: Stats = { inserted: 0, updated: 0, merged: 0, skipped: 0, notifications: 0 };
  const now = new Date();
  const bulkOps: any[] = [];

  // Pending notifications — collected during bulk build, sent after writes
  const pendingNotifications: { existingId: string; changes: EventChanges }[] = [];
  const pendingInserts: NormalisedEvent[] = [];

  for (const decision of decisions) {
    const { action, event, existingId, changes, fullExisting, reason } = decision;

    if (action === "skip") {
      stats.skipped++;
      continue;
    }

    if (action === "insert") {
      const subcategories = mergeSubcategories(event);
      bulkOps.push({
        insertOne: {
          document: {
            title: event.title,
            description: event.description,
            category: event.category,
            subcategories: [...new Set(subcategories)],
            startDate: event.startDate,
            endDate: event.endDate,
            venue: event.venue,
            priceMin: event.priceMin,
            priceMax: event.priceMax,
            priceDetails: event.priceDetails,
            isFree: event.isFree,
            bookingUrl: event.bookingUrl,
            bookingUrls: { [event.source]: event.bookingUrl },
            imageUrl: event.imageUrl,
            videoUrl: event.videoUrl,
            sources: [event.source],
            primarySource: event.source,
            sourceIds: { [event.source]: event.sourceId },
            accessibility: event.accessibility,
            ageRestriction: event.ageRestriction,
            duration: event.duration,
            scrapedAt: now,
            lastUpdated: now,
            lastContentChange: now
          }
        }
      });
      pendingInserts.push(event);
      stats.inserted++;
      continue;
    }

    if (action === "update" || action === "update-migrate") {
      const { finalStartDate, finalEndDate } = resolveDates(fullExisting, event);
      const subcategories = mergeSubcategories(event);

      const updateFields: any = {
        title: event.title,
        description: event.description,
        category: event.category,
        startDate: finalStartDate,
        endDate: finalEndDate,
        venue: event.venue,
        priceMin: event.priceMin,
        priceMax: event.priceMax,
        priceDetails: event.priceDetails,
        isFree: event.isFree,
        bookingUrl: event.bookingUrl,
        imageUrl: event.imageUrl,
        videoUrl: event.videoUrl,
        accessibility: event.accessibility,
        ageRestriction: event.ageRestriction,
        duration: event.duration,
        lastUpdated: now,
        ...(changes?.hasContentChanges && { lastContentChange: now }),
        ...(action === "update-migrate" && { [`sourceIds.${event.source}`]: event.sourceId })
      };

      bulkOps.push({
        updateOne: {
          filter: { _id: existingId },
          update: {
            $set: updateFields,
            $addToSet: { subcategories: { $each: subcategories } }
          }
        }
      });

      if (action === "update-migrate") {
        console.log(`[Dedup] Updated: ${event.title} (${reason})`);
      }

      if (changes?.priceDropped || changes?.significantUpdate) {
        pendingNotifications.push({ existingId: existingId!, changes });
      }

      stats.updated++;
      continue;
    }

    if (action === "merge") {
      const merged = mergeEvents(fullExisting || decision.event, event);
      const { finalStartDate, finalEndDate } = resolveDates(fullExisting || {}, event);
      const subcategories = mergeSubcategories(event);

      bulkOps.push({
        updateOne: {
          filter: { _id: existingId },
          update: {
            $set: {
              description: merged.description,
              category: merged.category,
              startDate: finalStartDate,
              endDate: finalEndDate,
              venue: merged.venue,
              priceMin: merged.priceMin,
              priceMax: merged.priceMax,
              priceDetails: merged.priceDetails,
              imageUrl: merged.imageUrl,
              videoUrl: merged.videoUrl,
              accessibility: merged.accessibility,
              ageRestriction: merged.ageRestriction,
              duration: merged.duration,
              isFree: merged.isFree,
              lastUpdated: now,
              [`bookingUrls.${event.source}`]: event.bookingUrl,
              [`sourceIds.${event.source}`]: event.sourceId,
              ...(changes?.hasContentChanges && { lastContentChange: now })
            },
            $addToSet: {
              sources: event.source,
              subcategories: { $each: subcategories },
              mergedFrom: `${event.source}:${event.sourceId}`
            }
          }
        }
      });

      if (changes?.priceDropped || changes?.significantUpdate) {
        pendingNotifications.push({ existingId: existingId!, changes });
      }

      stats.merged++;
    }
  }

  // Execute all writes in one round trip
  if (bulkOps.length > 0) {
    await Event.bulkWrite(bulkOps, { ordered: false });
  }

  // Send notifications after writes complete
  const notificationResults = await Promise.all([
    ...pendingNotifications.map(async ({ existingId, changes }) => {
      const updated = await Event.findById(existingId).lean();
      if (!updated) return 0;
      return processFavouritedEventUpdate(updated, changes).catch(err => {
        console.error("[Dedup] Notification error:", err);
        return 0;
      });
    }),
    ...pendingInserts.map(async event => {
      const created = await Event.findOne({
        source: event.source,
        "sourceIds": { $exists: true },
        [`sourceIds.${event.source}`]: event.sourceId
      }).lean();
      if (!created) return 0;
      return processNewEventNotifications(created).catch(err => {
        console.error("[Dedup] New event notification error:", err);
        return 0;
      });
    })
  ]);

  stats.notifications = notificationResults.reduce((sum, n) => sum + n, 0);
  return stats;
}

// Change Detection

/**
 * Detects all changes between existing and new event data.
 * Distinguishes between content changes (user-facing) and technical-only changes.
 */
function detectAllChanges(existing: any, newEvent: NormalisedEvent): EventChanges {
  const changes: EventChanges = { hasChanges: false, hasContentChanges: false };

  const contentChanged =
    existing.title !== newEvent.title ||
    existing.description !== newEvent.description ||
    existing.category !== newEvent.category ||
    existing.isFree !== newEvent.isFree ||
    existing.imageUrl !== newEvent.imageUrl ||
    existing.ageRestriction !== newEvent.ageRestriction ||
    existing.duration !== newEvent.duration;

  // More than 1 hour difference to avoid timestamp noise
  const dateChanged =
    Math.abs(existing.startDate?.getTime() - newEvent.startDate?.getTime()) > 3600000 ||
    Math.abs((existing.endDate?.getTime() || 0) - (newEvent.endDate?.getTime() || 0)) > 3600000;

  const venueChanged = JSON.stringify(existing.venue) !== JSON.stringify(newEvent.venue);
  const accessibilityChanged = JSON.stringify(existing.accessibility) !== JSON.stringify(newEvent.accessibility);

  const priceChanged =
    existing.priceMin !== newEvent.priceMin ||
    existing.priceMax !== newEvent.priceMax ||
    existing.priceDetails !== newEvent.priceDetails;

  const technicalChanged =
    existing.bookingUrl !== newEvent.bookingUrl ||
    existing.videoUrl !== newEvent.videoUrl;

  if (contentChanged || dateChanged || venueChanged || accessibilityChanged || priceChanged) {
    changes.hasChanges = true;
    changes.hasContentChanges = true;
  } else if (technicalChanged) {
    changes.hasChanges = true;
    changes.hasContentChanges = false;
  }

  // Price change detection
  const oldPrice = existing.priceMin || 0;
  const newPrice = newEvent.priceMin || 0;

  if (oldPrice === 0 && newPrice > 0) {
    changes.significantUpdate = `Price now available: $${newPrice.toFixed(2)}`;
  } else if (oldPrice > 0 && newPrice > 0 && Math.abs(oldPrice - newPrice) >= PRICE_CHANGE_THRESHOLD) {
    const change = newPrice - oldPrice;
    if (change < 0) {
      changes.priceDropped = true;
      changes.priceDrop = Math.abs(change);
    } else {
      changes.significantUpdate = `Price increased by $${change.toFixed(2)}`;
    }
  }

  // Significant keyword detection (e.g. cancellations, rescheduling)
  if (newEvent.description && existing.description) {
    const oldDesc = existing.description.toLowerCase();
    const newDesc = newEvent.description.toLowerCase();
    for (const keyword of SIGNIFICANT_KEYWORDS) {
      if (!oldDesc.includes(keyword) && newDesc.includes(keyword)) {
        changes.significantUpdate = `Event status: ${keyword}`;
        break;
      }
    }
  }

  return changes;
}

// Utility Helpers

/**
 * Resolves final start and end dates when updating or merging events.
 * Keeps the earliest start date and latest end date to capture the full run.
 */
function resolveDates(existing: any, newEvent: NormalisedEvent) {
  const finalStartDate =
    new Date(existing.startDate) < new Date(newEvent.startDate)
      ? existing.startDate
      : newEvent.startDate;

  const existingEnd = existing.endDate ? new Date(existing.endDate) : null;
  const newEnd = newEvent.endDate ? new Date(newEvent.endDate) : null;

  const finalEndDate =
    existingEnd && newEnd
      ? existingEnd > newEnd ? existing.endDate : newEvent.endDate
      : existingEnd || newEnd || newEvent.endDate;

  return { finalStartDate, finalEndDate };
}

/** Merges subcategories from a normalised event, including legacy single subcategory. */
function mergeSubcategories(event: NormalisedEvent): string[] {
  const subcategories = [...(event.subcategories || [])];
  if (event.subcategory && !subcategories.includes(event.subcategory)) {
    subcategories.push(event.subcategory);
  }
  return subcategories;
}

/** Builds a map of source:sourceId -> event for fast exact-match lookups. */
function buildSourceIdMap(events: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const e of events) {
    const sourceId = getSourceId(e, e.primarySource);
    const key = `${e.primarySource}:${sourceId}`;
    if (map.has(key)) {
      const existing = map.get(key);
      if (new Date(e.startDate) < new Date(existing.startDate)) map.set(key, e);
    } else {
      map.set(key, e);
    }
  }
  return map;
}

/**
 * Builds a name+venue map for Ticketmaster sourceId migration.
 * Allows matching events with old sourceIds to their new stable equivalents.
 */
function buildNameVenueMap(events: any[], sourceName: string): Map<string, any> {
  const map = new Map<string, any>();
  if (sourceName !== "ticketmaster") return map;
  for (const e of events) {
    if (e.primarySource === "ticketmaster") {
      const key = createNameVenueKey({ title: e.title, venue: e.venue, source: e.primarySource });
      if (!map.has(key)) map.set(key, e);
    }
  }
  return map;
}

/** Creates a normalised name+venue key for event matching. */
function createNameVenueKey(event: { title: string; venue: any; source: string }): string {
  const name = event.title.toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, "-");
  const venue = event.venue?.name?.toLowerCase().replace(/[^\w\s]/g, "").trim() || "unknown";
  return `${event.source}:${name}::${venue}`;
}

/** Converts database events to EventForDedup format. */
function mapToEventForDedup(events: any[]): (EventForDedup & { _id: string })[] {
  return events.map(e => ({
    _id: e._id.toString(),
    title: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
    venue: e.venue,
    source: e.primarySource,
    sourceId: getSourceId(e, e.primarySource),
    description: e.description,
    category: e.category,
    subcategories: e.subcategories,
    imageUrl: e.imageUrl,
    videoUrl: e.videoUrl,
    priceMin: e.priceMin,
    priceMax: e.priceMax,
    priceDetails: e.priceDetails,
    isFree: e.isFree,
    bookingUrl: e.bookingUrl,
    accessibility: e.accessibility,
    ageRestriction: e.ageRestriction,
    duration: e.duration
  }));
}

/** Extracts a source ID from an event's sourceIds map or plain object. */
function getSourceId(event: any, source: string): string {
  if (!event.sourceIds) return "";
  if (typeof event.sourceIds.get === "function") return event.sourceIds.get(source) || "";
  return event.sourceIds[source] || "";
}