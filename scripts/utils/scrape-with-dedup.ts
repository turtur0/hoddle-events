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

interface ProcessContext {
  existing: any[];
  bySourceId: Map<string, any>;
  byNameVenue: Map<string, any>;
  existingDedup: (EventForDedup & { _id: string })[];
  batchInserted: (EventForDedup & { _id: string })[];
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
 * 2. For each new event:
 *    a) Check if exact source match exists (same source + sourceId)
 *       - If yes: update existing event, keep earliest start date
 *    b) Check if name+venue match exists (for Ticketmaster sourceId migration)
 *       - If yes: update existing event and migrate sourceId
 *    c) Check for same-source duplicates (e.g. Ticketmaster multi-tier listings)
 *       - If yes: update canonical record or skip the duplicate
 *    d) Run cross-source fuzzy deduplication
 *       - If confident match: merge into existing event
 *       - If no match: insert as new event
 * 3. Send notifications for price drops and significant changes
 */
export async function processEventsWithDeduplication(
  newEvents: NormalisedEvent[],
  sourceName: string
): Promise<Stats> {
  console.log(
    `\n[Dedup] Processing ${newEvents.length} events from '${sourceName}'`
  );

  const stats: Stats = {
    inserted: 0,
    updated: 0,
    merged: 0,
    skipped: 0,
    notifications: 0
  };

  const existing = await Event.find({}).lean();
  console.log(`[Dedup] Found ${existing.length} existing events in database`);

  const context: ProcessContext = {
    existing,
    bySourceId: buildSourceIdMap(existing),
    byNameVenue: buildNameVenueMap(existing, sourceName),
    existingDedup: mapToEventForDedup(existing),
    batchInserted: [],
    sourceName
  };

  for (const event of newEvents) {
    try {
      const result = await processEvent(event, context);
      updateStats(stats, result);
      if (result.action !== "skipped") logResult(result, event.title);
    } catch (error: any) {
      handleProcessingError(error, event.title, stats);
    }
  }

  console.log(
    `[Dedup] Complete: ${stats.inserted} inserted, ${stats.updated} updated, ` +
      `${stats.merged} merged, ${stats.notifications} notifications\n`
  );

  return stats;
}

/**
 * Processes a single event through the full deduplication pipeline.
 */
async function processEvent(
  event: NormalisedEvent,
  context: ProcessContext
): Promise<{
  action: "updated" | "merged" | "inserted" | "skipped";
  notifications: number;
  data?: any;
}> {
  const { existing, bySourceId, byNameVenue, existingDedup, batchInserted } =
    context;

  // Step 1: Exact source + sourceId match
  const sameSource = bySourceId.get(`${event.source}:${event.sourceId}`);
  if (sameSource) {
    const notifications = await updateExistingEvent(sameSource, event);
    return { action: "updated", notifications: Math.max(0, notifications) };
  }

  // Step 2: Name + venue match for Ticketmaster sourceId migration
  if (event.source === "ticketmaster") {
    const nameVenueMatch = byNameVenue.get(createNameVenueKey(event));
    if (nameVenueMatch) {
      const notifications = await updateAndMigrateSourceId(
        nameVenueMatch,
        event
      );
      return {
        action: "updated",
        notifications: Math.max(0, notifications),
        data: { reason: "migrated sourceId" }
      };
    }
  }

  // Build a dedup record for this incoming event
  const tempId = `temp:${event.sourceId}`;
  const eventDedup: EventForDedup & { _id: string } = {
    _id: tempId,
    ...event,
    subcategories:
      event.subcategories || (event.subcategory ? [event.subcategory] : [])
  };

  // Step 3: Same-source duplicate check (e.g. Ticketmaster multi-tier listings)
  // Only compare against events from the same source to keep this focused
  const sameSourcePool = [
    ...existingDedup,
    ...batchInserted,
    eventDedup
  ].filter((e) => e.source === event.source);

  const sameSourceMatch = findBestMatch(
    tempId,
    findSameSourceDuplicates(sameSourcePool)
  );

  if (sameSourceMatch) {
    const matchId = getMatchId(tempId, sameSourceMatch);
    const dbMatch = existing.find((e) => e._id.toString() === matchId);

    if (dbMatch) {
      // Update the canonical record with any new data from this duplicate
      const notifications = await updateExistingEvent(dbMatch, event);
      return {
        action: "updated",
        notifications: Math.max(0, notifications),
        data: { reason: sameSourceMatch.reason }
      };
    }

    // Match is in batchInserted - skip entirely to avoid inserting a second copy
    return { action: "skipped", notifications: 0 };
  }

  // Step 4: Cross-source fuzzy deduplication
  const pool = [...existingDedup, ...batchInserted, eventDedup];
  const crossSourceMatch = findBestMatch(tempId, findDuplicates(pool));

  if (crossSourceMatch) {
    const matchId = getMatchId(tempId, crossSourceMatch);
    const dbMatch = existing.find((e) => e._id.toString() === matchId);
    const batchMatch = batchInserted.find((e) => e._id === matchId);

    if (dbMatch || batchMatch) {
      const targetDedup = dbMatch
        ? mapToEventForDedup([dbMatch])[0]
        : batchMatch!;
      const notifications = await mergeIntoExisting(
        matchId,
        targetDedup,
        event,
        dbMatch
      );

      return {
        action: notifications === -1 ? "skipped" : "merged",
        notifications: Math.max(0, notifications),
        data: { reason: crossSourceMatch.reason }
      };
    }
  }

  // Step 5: No match found - insert as a new event
  const created = await insertNewEvent(event);
  batchInserted.push({
    _id: created._id.toString(),
    ...event,
    subcategories:
      event.subcategories || (event.subcategory ? [event.subcategory] : [])
  });

  const notifications = await processNewEventNotifications(created);
  return { action: "inserted", notifications };
}

// Database Operations

/**
 * Updates an existing event from the same source.
 * Always keeps the earliest start date and latest end date.
 */
async function updateExistingEvent(
  existing: any,
  newEvent: NormalisedEvent
): Promise<number> {
  const changes = detectAllChanges(existing, newEvent);
  const { finalStartDate, finalEndDate } = resolveDates(existing, newEvent);
  const subcategories = mergeSubcategories(newEvent);

  const updateFields: any = {
    title: newEvent.title,
    description: newEvent.description,
    category: newEvent.category,
    startDate: finalStartDate,
    endDate: finalEndDate,
    venue: newEvent.venue,
    priceMin: newEvent.priceMin,
    priceMax: newEvent.priceMax,
    priceDetails: newEvent.priceDetails,
    isFree: newEvent.isFree,
    bookingUrl: newEvent.bookingUrl,
    imageUrl: newEvent.imageUrl,
    videoUrl: newEvent.videoUrl,
    accessibility: newEvent.accessibility,
    ageRestriction: newEvent.ageRestriction,
    duration: newEvent.duration,
    lastUpdated: new Date(),
    ...(changes.hasContentChanges && { lastContentChange: new Date() })
  };

  const result = await Event.updateOne(
    { _id: existing._id },
    {
      $set: updateFields,
      $addToSet: { subcategories: { $each: subcategories } }
    }
  );

  if (result.matchedCount === 0) {
    console.error(`[Dedup] Update failed: Event ${existing._id} not found`);
    return 0;
  }

  return changes.priceDropped || changes.significantUpdate
    ? notifyFavouritedUsers(existing._id, changes)
    : 0;
}

/**
 * Updates an existing event and migrates its sourceId to the new stable format.
 * Used during transition from old Ticketmaster IDs to stable hash-based IDs.
 */
async function updateAndMigrateSourceId(
  existing: any,
  newEvent: NormalisedEvent
): Promise<number> {
  const changes = detectAllChanges(existing, newEvent);
  const { finalStartDate, finalEndDate } = resolveDates(existing, newEvent);
  const subcategories = mergeSubcategories(newEvent);

  const updateFields: any = {
    title: newEvent.title,
    description: newEvent.description,
    category: newEvent.category,
    startDate: finalStartDate,
    endDate: finalEndDate,
    venue: newEvent.venue,
    priceMin: newEvent.priceMin,
    priceMax: newEvent.priceMax,
    priceDetails: newEvent.priceDetails,
    isFree: newEvent.isFree,
    bookingUrl: newEvent.bookingUrl,
    imageUrl: newEvent.imageUrl,
    videoUrl: newEvent.videoUrl,
    accessibility: newEvent.accessibility,
    ageRestriction: newEvent.ageRestriction,
    duration: newEvent.duration,
    lastUpdated: new Date(),
    [`sourceIds.${newEvent.source}`]: newEvent.sourceId,
    ...(changes.hasContentChanges && { lastContentChange: new Date() })
  };

  const result = await Event.updateOne(
    { _id: existing._id },
    {
      $set: updateFields,
      $addToSet: { subcategories: { $each: subcategories } }
    }
  );

  if (result.matchedCount === 0) {
    console.error(`[Dedup] Update failed: Event ${existing._id} not found`);
    return 0;
  }

  console.log(
    `[Dedup] Migrated sourceId for "${existing.title}": ${getSourceId(existing, newEvent.source)} -> ${newEvent.sourceId}`
  );

  return changes.priceDropped || changes.significantUpdate
    ? notifyFavouritedUsers(existing._id, changes)
    : 0;
}

/**
 * Merges a new event into an existing event from a different source.
 * Always keeps the earliest start date and latest end date.
 */
async function mergeIntoExisting(
  existingId: any,
  existing: any,
  newEvent: NormalisedEvent,
  fullExistingEvent?: any
): Promise<number> {
  if (!fullExistingEvent) {
    fullExistingEvent = await Event.findById(existingId).lean();
    if (!fullExistingEvent) {
      console.error(`[Dedup] Could not find event ${existingId} in database`);
      return -1;
    }
  }

  const existingSources = fullExistingEvent.sources || [];
  const isNewSource = !existingSources.includes(newEvent.source);
  const changes = detectAllChanges(existing, newEvent);

  // Skip if no new source and no data changes
  if (!changes.hasChanges && !isNewSource) return -1;

  const merged = mergeEvents(existing, newEvent);
  const { finalStartDate, finalEndDate } = resolveDates(
    fullExistingEvent,
    newEvent
  );

  const updateFields: any = {
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
    lastUpdated: new Date(),
    [`bookingUrls.${newEvent.source}`]: newEvent.bookingUrl,
    [`sourceIds.${newEvent.source}`]: newEvent.sourceId,
    ...(changes.hasContentChanges && { lastContentChange: new Date() })
  };

  const result = await Event.updateOne(
    { _id: existingId },
    {
      $set: updateFields,
      $addToSet: {
        sources: newEvent.source,
        subcategories: { $each: merged.subcategories || [] },
        mergedFrom: `${newEvent.source}:${newEvent.sourceId}`
      }
    }
  );

  if (result.matchedCount === 0) {
    console.error(`[Dedup] Merge failed: Event ${existingId} not found`);
    return -1;
  }

  return changes.priceDropped || changes.significantUpdate
    ? notifyFavouritedUsers(existingId, changes)
    : 0;
}

/** Inserts a new event into the database. */
async function insertNewEvent(event: NormalisedEvent) {
  const subcategories = mergeSubcategories(event);
  const now = new Date();

  return Event.create({
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
  });
}

// Change Detection

/**
 * Detects all changes between existing and new event data.
 * Distinguishes between content changes (user-facing) and technical-only changes.
 */
function detectAllChanges(
  existing: any,
  newEvent: NormalisedEvent
): EventChanges {
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
    Math.abs(existing.startDate?.getTime() - newEvent.startDate?.getTime()) >
      3600000 ||
    Math.abs(
      (existing.endDate?.getTime() || 0) - (newEvent.endDate?.getTime() || 0)
    ) > 3600000;

  const venueChanged =
    JSON.stringify(existing.venue) !== JSON.stringify(newEvent.venue);
  const accessibilityChanged =
    JSON.stringify(existing.accessibility) !==
    JSON.stringify(newEvent.accessibility);

  const priceChanged =
    existing.priceMin !== newEvent.priceMin ||
    existing.priceMax !== newEvent.priceMax ||
    existing.priceDetails !== newEvent.priceDetails;

  const technicalChanged =
    existing.bookingUrl !== newEvent.bookingUrl ||
    existing.videoUrl !== newEvent.videoUrl;

  if (
    contentChanged ||
    dateChanged ||
    venueChanged ||
    accessibilityChanged ||
    priceChanged
  ) {
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
  } else if (
    oldPrice > 0 &&
    newPrice > 0 &&
    Math.abs(oldPrice - newPrice) >= PRICE_CHANGE_THRESHOLD
  ) {
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

// Notifications

/** Sends notifications to users who have favourited this event. */
async function notifyFavouritedUsers(
  eventId: any,
  changes: EventChanges
): Promise<number> {
  if (!changes.priceDropped && !changes.significantUpdate) return 0;

  try {
    const updatedEvent = await Event.findById(eventId).lean();
    if (!updatedEvent) return 0;
    return await processFavouritedEventUpdate(updatedEvent, changes);
  } catch (error) {
    console.error("[Dedup] Error sending favourite notifications:", error);
    return 0;
  }
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
      ? existingEnd > newEnd
        ? existing.endDate
        : newEvent.endDate
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

    // If a duplicate key exists, keep the one with the earliest start date
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
function buildNameVenueMap(
  events: any[],
  sourceName: string
): Map<string, any> {
  const map = new Map<string, any>();

  if (sourceName !== "ticketmaster") return map;

  for (const e of events) {
    if (e.primarySource === "ticketmaster") {
      const key = createNameVenueKey({
        title: e.title,
        venue: e.venue,
        source: e.primarySource
      });
      if (!map.has(key)) map.set(key, e);
    }
  }

  return map;
}

/** Creates a normalised name+venue key for event matching. */
function createNameVenueKey(event: {
  title: string;
  venue: any;
  source: string;
}): string {
  const name = event.title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const venue =
    event.venue?.name
      ?.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim() || "unknown";
  return `${event.source}:${name}::${venue}`;
}

/** Converts database events to EventForDedup format. */
function mapToEventForDedup(
  events: any[]
): (EventForDedup & { _id: string })[] {
  return events.map((e) => ({
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
  if (typeof event.sourceIds.get === "function")
    return event.sourceIds.get(source) || "";
  return event.sourceIds[source] || "";
}

/** Updates run statistics based on a processing result. */
function updateStats(
  stats: Stats,
  result: { action: string; notifications: number }
) {
  if (result.action === "inserted") stats.inserted++;
  else if (result.action === "updated") stats.updated++;
  else if (result.action === "merged") stats.merged++;
  else if (result.action === "skipped") stats.skipped++;
  stats.notifications += result.notifications;
}

/** Logs a processing result with optional reason and notification count. */
function logResult(result: any, title: string) {
  const action = result.action.charAt(0).toUpperCase() + result.action.slice(1);
  let log = `[Dedup] ${action}: ${title}`;
  if (result.data?.reason) log += ` (${result.data.reason})`;
  if (result.notifications > 0)
    log += ` [${result.notifications} notifications]`;
  console.log(log);
}

/** Handles errors during event processing and increments the skipped count. */
function handleProcessingError(error: any, title: string, stats: Stats) {
  if (error?.code === 11000) {
    console.log(`[Dedup] Duplicate key error: ${title}`);
  } else {
    console.error(
      `[Dedup] Error processing ${title}:`,
      error?.message || error
    );
  }
  stats.skipped++;
}
