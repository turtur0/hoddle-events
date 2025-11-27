import Event from '@/lib/models/Event';
import { findDuplicates, mergeEvents } from '@/lib/utils/deduplication';
import { processNewEventNotifications, processFavouritedEventUpdate } from '@/lib/services';
import type { NormalisedEvent, EventForDedup } from '@/lib/scrapers/types';

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
}

interface ProcessContext {
  existing: any[];
  bySourceId: Map<string, any>;
  existingDedup: (EventForDedup & { _id: string })[];
  batchInserted: (EventForDedup & { _id: string })[];
  sourceName: string;
}

/** Minimum price change in dollars to trigger notifications */
const PRICE_CHANGE_THRESHOLD = 5;

/** Keywords indicating significant event changes that warrant notifications */
const SIGNIFICANT_KEYWORDS = [
  'cancelled', 'postponed', 'rescheduled', 'sold out',
  'extra show', 'additional show', 'new date', 'date change'
];

/**
 * Processes scraped events with intelligent deduplication and merging.
 * 
 * The deduplication algorithm works in stages:
 * 1. Load all existing events from database
 * 2. Build lookup maps (source:sourceId -> event) for fast comparison
 * 3. For each new event:
 *    a) Check if exact source match exists (same source + sourceId)
 *       - If yes: update existing event if changes detected
 *    b) If no exact match, run fuzzy deduplication against:
 *       - All existing database events
 *       - Events inserted earlier in this batch
 *    c) Deduplication uses similarity scoring on title, dates, venue
 *       - If confident match found: merge into existing event
 *       - If no match: insert as new event
 * 4. Track which events were processed in this batch to avoid re-insertion
 * 5. Send notifications for price drops and significant changes
 * 
 * @param newEvents - Freshly scraped events to process
 * @param sourceName - Name of the scraping source (e.g., 'ticketmaster')
 * @returns Statistics about inserted, updated, merged, and skipped events
 */
export async function processEventsWithDeduplication(
  newEvents: NormalisedEvent[],
  sourceName: string
): Promise<Stats> {
  console.log(`\n[Dedup] Processing ${newEvents.length} events from '${sourceName}'`);

  const stats: Stats = {
    inserted: 0,
    updated: 0,
    merged: 0,
    skipped: 0,
    notifications: 0
  };

  // Load all existing events for comparison
  const existing = await Event.find({}).lean();
  console.log(`[Dedup] Found ${existing.length} existing events in database`);

  // Build lookup structures for efficient processing
  const context: ProcessContext = {
    existing,
    bySourceId: buildSourceIdMap(existing),
    existingDedup: mapToEventForDedup(existing),
    batchInserted: [],
    sourceName
  };

  // Process each event through the deduplication pipeline
  for (const event of newEvents) {
    try {
      const result = await processEvent(event, context);
      updateStats(stats, result);
      logResult(result, event.title);
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
 * Processes a single event through the deduplication pipeline.
 * 
 * Decision tree:
 * 1. Same source match exists → update if changed
 * 2. No source match → run fuzzy deduplication
 *    a) Duplicate found → merge into existing
 *    b) No duplicate → insert as new
 * 
 * @returns Action taken and notification count
 */
async function processEvent(
  event: NormalisedEvent,
  context: ProcessContext
): Promise<{
  action: 'updated' | 'merged' | 'inserted' | 'skipped';
  notifications: number;
  data?: any
}> {
  const { existing, bySourceId, existingDedup, batchInserted } = context;

  // Check for exact source match (same source + sourceId)
  const sourceKey = `${event.source}:${event.sourceId}`;
  const sameSource = bySourceId.get(sourceKey);

  if (sameSource) {
    const notifications = await updateExistingEvent(sameSource, event);
    return {
      action: notifications === -1 ? 'skipped' : 'updated',
      notifications: Math.max(0, notifications)
    };
  }

  // Prepare event for fuzzy deduplication
  const tempId = `temp:${event.sourceId}`;
  const eventDedup: EventForDedup & { _id: string } = {
    _id: tempId,
    ...event,
    subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : []),
  };

  // Run deduplication against all existing and batch-inserted events
  const pool = [...existingDedup, ...batchInserted, eventDedup];
  const duplicates = findDuplicates(pool);

  // Find best match for this event (highest confidence score)
  const match = duplicates
    .filter(d => d.event1Id === tempId || d.event2Id === tempId)
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (match) {
    const matchId = match.event1Id === tempId ? match.event2Id : match.event1Id;
    const dbMatch = existing.find(e => e._id.toString() === matchId);
    const batchMatch = batchInserted.find(e => e._id === matchId);

    if (dbMatch || batchMatch) {
      const targetDedup = dbMatch ? mapToEventForDedup([dbMatch])[0] : batchMatch!;
      const notifications = await mergeIntoExisting(matchId, targetDedup, event, dbMatch);

      return {
        action: notifications === -1 ? 'skipped' : 'merged',
        notifications: Math.max(0, notifications),
        data: { reason: match.reason }
      };
    }
  }

  // No match found - insert as new event and track in batch
  const created = await insertNewEvent(event);
  batchInserted.push({
    _id: created._id.toString(),
    ...event,
    subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : []),
  });

  const notifications = await processNewEventNotifications(created);
  return { action: 'inserted', notifications };
}

/**
 * Updates an existing event from the same source.
 * Only performs update if actual changes are detected.
 * 
 * @returns Number of notifications sent, or -1 if no update needed
 */
async function updateExistingEvent(existing: any, newEvent: NormalisedEvent): Promise<number> {
  const changes = detectAllChanges(existing, newEvent);

  if (!changes.hasChanges) {
    return -1; // Skip update if nothing changed
  }

  const subcategories = [...(newEvent.subcategories || [])];
  if (newEvent.subcategory && !subcategories.includes(newEvent.subcategory)) {
    subcategories.push(newEvent.subcategory);
  }

  await Event.updateOne(
    { _id: existing._id },
    {
      $set: {
        title: newEvent.title,
        description: newEvent.description,
        category: newEvent.category,
        startDate: newEvent.startDate,
        endDate: newEvent.endDate,
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
      },
      $addToSet: { subcategories: { $each: subcategories } },
    }
  );

  // Send notifications for significant changes
  if (changes.priceDropped || changes.significantUpdate) {
    return await notifyFavouritedUsers(existing._id, changes);
  }

  return 0;
}

/**
 * Merges a new event into an existing event from a different source.
 * Only performs merge if actual changes are detected.
 * 
 * @returns Number of notifications sent, or -1 if no merge needed
 */
async function mergeIntoExisting(
  existingId: any,
  existing: any,
  newEvent: NormalisedEvent,
  fullExistingEvent?: any
): Promise<number> {
  const changes = detectAllChanges(existing, newEvent);

  if (!changes.hasChanges) {
    return -1; // Skip merge if nothing changed
  }

  const merged = mergeEvents(existing, newEvent);

  await Event.updateOne(
    { _id: existingId },
    {
      $set: {
        description: merged.description,
        category: merged.category,
        startDate: merged.startDate,
        endDate: merged.endDate,
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
      },
      $addToSet: {
        sources: newEvent.source,
        subcategories: { $each: merged.subcategories || [] },
        mergedFrom: `${newEvent.source}:${newEvent.sourceId}`,
      },
    }
  );

  // Send notifications for significant changes
  if (changes.priceDropped || changes.significantUpdate) {
    return await notifyFavouritedUsers(existingId, changes);
  }

  return 0;
}

/** Inserts a new event into the database. */
async function insertNewEvent(event: NormalisedEvent) {
  const subcategories = [...(event.subcategories || [])];
  if (event.subcategory && !subcategories.includes(event.subcategory)) {
    subcategories.push(event.subcategory);
  }

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
    scrapedAt: new Date(),
    lastUpdated: new Date(),
  });
}

/**
 * Detects all changes between existing and new event data.
 * 
 * Checks for:
 * - Field changes (title, description, prices, dates, etc.)
 * - Venue and accessibility changes
 * - Significant updates (price drops, cancellations, etc.)
 * 
 * @returns Object describing what changed and its significance
 */
function detectAllChanges(existing: any, newEvent: NormalisedEvent): EventChanges {
  const changes: EventChanges = { hasChanges: false };

  // Check direct field changes
  const fieldChanged =
    existing.title !== newEvent.title ||
    existing.description !== newEvent.description ||
    existing.category !== newEvent.category ||
    existing.isFree !== newEvent.isFree ||
    existing.priceMin !== newEvent.priceMin ||
    existing.priceMax !== newEvent.priceMax ||
    existing.priceDetails !== newEvent.priceDetails ||
    existing.imageUrl !== newEvent.imageUrl ||
    existing.videoUrl !== newEvent.videoUrl ||
    existing.bookingUrl !== newEvent.bookingUrl ||
    existing.ageRestriction !== newEvent.ageRestriction ||
    existing.duration !== newEvent.duration;

  // Check date changes
  const dateChanged =
    existing.startDate?.getTime() !== newEvent.startDate?.getTime() ||
    existing.endDate?.getTime() !== newEvent.endDate?.getTime();

  // Check structural changes (venue, accessibility)
  const venueChanged = JSON.stringify(existing.venue) !== JSON.stringify(newEvent.venue);
  const accessibilityChanged =
    JSON.stringify(existing.accessibility) !== JSON.stringify(newEvent.accessibility);

  if (fieldChanged || dateChanged || venueChanged || accessibilityChanged) {
    changes.hasChanges = true;
  }

  // Detect significant price changes
  const oldPrice = existing.priceMin || 0;
  const newPrice = newEvent.priceMin || 0;

  if (oldPrice === 0 && newPrice > 0) {
    changes.significantUpdate = `Price now available: $${newPrice.toFixed(2)}`;
  } else if (oldPrice > 0 && newPrice > 0 &&
    Math.abs(oldPrice - newPrice) >= PRICE_CHANGE_THRESHOLD) {
    const change = newPrice - oldPrice;
    if (change < 0) {
      changes.priceDropped = true;
      changes.priceDrop = Math.abs(change);
    } else {
      changes.significantUpdate = `Price increased by $${change.toFixed(2)}`;
    }
  }

  // Check for significant keywords in description
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

/** Sends notifications to users who have favourited this event. */
async function notifyFavouritedUsers(eventId: any, changes: EventChanges): Promise<number> {
  if (!changes.priceDropped && !changes.significantUpdate) {
    return 0;
  }

  try {
    const updatedEvent = await Event.findById(eventId).lean();
    if (!updatedEvent) return 0;

    return await processFavouritedEventUpdate(updatedEvent, changes);
  } catch (error) {
    console.error('[Dedup] Error sending favourite notifications:', error);
    return 0;
  }
}

/** Builds a map of source:sourceId → event for fast lookups. */
function buildSourceIdMap(events: any[]): Map<string, any> {
  return new Map(
    events.map(e => {
      const sourceId = getSourceId(e, e.primarySource);
      return [`${e.primarySource}:${sourceId}`, e];
    })
  );
}

/** Converts database events to EventForDedup format for comparison. */
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
    duration: e.duration,
  }));
}

/** Extracts source ID from event's sourceIds map/object. */
function getSourceId(event: any, source: string): string {
  if (!event.sourceIds) return '';

  // Handle both Map and plain object formats
  if (typeof event.sourceIds.get === 'function') {
    return event.sourceIds.get(source) || '';
  }

  return event.sourceIds[source] || '';
}

/** Updates statistics based on processing result. */
function updateStats(stats: Stats, result: { action: string; notifications: number }) {
  if (result.action === 'inserted') stats.inserted++;
  else if (result.action === 'updated') stats.updated++;
  else if (result.action === 'merged') stats.merged++;
  else if (result.action === 'skipped') stats.skipped++;

  stats.notifications += result.notifications;
}

/** Logs processing result (skips logging for skipped events). */
function logResult(result: any, title: string) {
  if (result.action === 'skipped') return;

  const action = result.action.charAt(0).toUpperCase() + result.action.slice(1);
  let log = `[Dedup] ${action}: ${title}`;

  if (result.data?.reason) {
    log += ` (${result.data.reason})`;
  }

  if (result.notifications > 0) {
    log += ` [${result.notifications} notifications]`;
  }

  console.log(log);
}

/** Handles errors during event processing. */
function handleProcessingError(error: any, title: string, stats: Stats) {
  if (error?.code === 11000) {
    console.log(`[Dedup] Duplicate key error: ${title}`);
  } else {
    console.error(`[Dedup] Error processing ${title}:`, error?.message || error);
  }

  stats.skipped++;
}