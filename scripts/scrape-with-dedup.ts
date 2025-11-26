// lib/services/scrape-with-dedup.ts
import Event from '@/lib/models/Event';
import { findDuplicates, mergeEvents } from '@/lib/utils/deduplication';
import { processNewEventNotifications, processFavoritedEventUpdate } from '@/lib/services/notificationService';
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

const PRICE_CHANGE_THRESHOLD = 5;
const SIGNIFICANT_KEYWORDS = [
  'cancelled', 'postponed', 'rescheduled', 'sold out',
  'extra show', 'additional show', 'new date', 'date change'
];

export async function processEventsWithDeduplication(
  newEvents: NormalisedEvent[],
  sourceName: string
): Promise<Stats> {
  console.log(`\n[Dedup] Processing ${newEvents.length} events from '${sourceName}'`);
  const stats: Stats = { inserted: 0, updated: 0, merged: 0, skipped: 0, notifications: 0 };

  const existing = await Event.find({}).lean();
  console.log(`[Dedup] Found ${existing.length} existing events in database`);

  const bySourceId = buildSourceIdMap(existing);
  const existingDedup = mapToEventForDedup(existing);
  const batchInserted: (EventForDedup & { _id: string })[] = [];

  for (const event of newEvents) {
    try {
      const result = await processEvent(event, {
        existing,
        bySourceId,
        existingDedup,
        batchInserted,
        sourceName
      });

      updateStats(stats, result);
      logResult(result, event.title);
    } catch (err: any) {
      handleProcessingError(err, event.title, stats);
    }
  }

  console.log(`[Dedup] Complete: ${stats.inserted} inserted, ${stats.updated} updated, ${stats.merged} merged, ${stats.notifications} notifications\n`);
  return stats;
}

async function processEvent(
  event: NormalisedEvent,
  context: {
    existing: any[];
    bySourceId: Map<string, any>;
    existingDedup: (EventForDedup & { _id: string })[];
    batchInserted: (EventForDedup & { _id: string })[];
    sourceName: string;
  }
): Promise<{ action: 'updated' | 'merged' | 'inserted' | 'skipped'; notifications: number; data?: any }> {
  const { existing, bySourceId, existingDedup, batchInserted } = context;

  const sourceKey = `${event.source}:${event.sourceId}`;
  const sameSource = bySourceId.get(sourceKey);

  if (sameSource) {
    const notifications = await updateExistingEvent(sameSource, event);
    // If no changes were made, mark as skipped
    return { action: notifications === -1 ? 'skipped' : 'updated', notifications: Math.max(0, notifications) };
  }

  const tempId = `temp:${event.sourceId}`;
  const eventDedup: EventForDedup & { _id: string } = {
    _id: tempId,
    ...event,
    subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : []),
  };

  const pool = [...existingDedup, ...batchInserted, eventDedup];
  const dupes = findDuplicates(pool);
  const match = dupes
    .filter(d => d.event1Id === tempId || d.event2Id === tempId)
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (match) {
    const matchId = match.event1Id === tempId ? match.event2Id : match.event1Id;
    const dbMatch = existing.find(e => e._id.toString() === matchId);
    const batchMatch = batchInserted.find(e => e._id === matchId);

    if (dbMatch || batchMatch) {
      const targetDedup = dbMatch ? mapToEventForDedup([dbMatch])[0] : batchMatch!;
      const notifications = await mergeIntoExisting(matchId, targetDedup, event, dbMatch);
      return { action: notifications === -1 ? 'skipped' : 'merged', notifications: Math.max(0, notifications), data: { reason: match.reason } };
    }
  }

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
 * Only update if there are actual changes
 */
async function updateExistingEvent(existing: any, newEvent: NormalisedEvent): Promise<number> {
  const changes = detectAllChanges(existing, newEvent);

  // If nothing changed, skip the update
  if (!changes.hasChanges) {
    return -1; // Signal that no update was needed
  }

  const subcategories = [...(newEvent.subcategories || [])];
  if (newEvent.subcategory && !subcategories.includes(newEvent.subcategory)) {
    subcategories.push(newEvent.subcategory);
  }

  const updateDoc: any = {
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
      lastUpdated: new Date(), // Only set when actually updating
    },
    $addToSet: { subcategories: { $each: subcategories } },
  };

  await Event.updateOne({ _id: existing._id }, updateDoc);

  // Only notify if there are significant changes
  if (changes.priceDropped || changes.significantUpdate) {
    return await notifyFavoriteUsers(existing._id, changes);
  }

  return 0;
}

async function mergeIntoExisting(
  existingId: any,
  existing: any,
  newEvent: NormalisedEvent,
  fullExistingEvent?: any
): Promise<number> {
  const changes = detectAllChanges(existing, newEvent);

  // If nothing changed, skip the merge
  if (!changes.hasChanges) {
    return -1; // Signal that no merge was needed
  }

  const merged = mergeEvents(existing, newEvent);

  const updateDoc: any = {
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
      lastUpdated: new Date(), // Only set when actually merging
    },
    $addToSet: {
      sources: newEvent.source,
      subcategories: { $each: merged.subcategories || [] },
      mergedFrom: `${newEvent.source}:${newEvent.sourceId}`,
    },
  };

  updateDoc.$set[`bookingUrls.${newEvent.source}`] = newEvent.bookingUrl;
  updateDoc.$set[`sourceIds.${newEvent.source}`] = newEvent.sourceId;

  await Event.updateOne({ _id: existingId }, updateDoc);

  // Only notify if there are significant changes
  if (changes.priceDropped || changes.significantUpdate) {
    return await notifyFavoriteUsers(existingId, changes);
  }

  return 0;
}

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
 * Detect ALL changes, not just significant ones
 */
function detectAllChanges(existing: any, newEvent: NormalisedEvent): EventChanges {
  const changes: EventChanges = { hasChanges: false };

  // Direct field comparisons (type-safe)
  if (existing.title !== newEvent.title ||
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
    existing.duration !== newEvent.duration) {
    changes.hasChanges = true;
  }

  // Check dates
  if (existing.startDate?.getTime() !== newEvent.startDate?.getTime() ||
    existing.endDate?.getTime() !== newEvent.endDate?.getTime()) {
    changes.hasChanges = true;
  }

  // Check venue
  if (JSON.stringify(existing.venue) !== JSON.stringify(newEvent.venue)) {
    changes.hasChanges = true;
  }

  // Check accessibility array
  if (JSON.stringify(existing.accessibility) !== JSON.stringify(newEvent.accessibility)) {
    changes.hasChanges = true;
  }

  // Detect significant changes for notifications
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

async function notifyFavoriteUsers(eventId: any, changes: EventChanges): Promise<number> {
  if (!changes.priceDropped && !changes.significantUpdate) return 0;

  try {
    const updatedEvent = await Event.findById(eventId).lean();
    if (!updatedEvent) return 0;

    return await processFavoritedEventUpdate(updatedEvent, changes);
  } catch (error) {
    console.error('[Dedup] Error sending favorite notifications:', error);
    return 0;
  }
}

// Helper functions
function buildSourceIdMap(events: any[]): Map<string, any> {
  return new Map(
    events.map(e => {
      const sourceId = getSourceId(e, e.primarySource);
      return [`${e.primarySource}:${sourceId}`, e];
    })
  );
}

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

function getSourceId(event: any, source: string): string {
  if (!event.sourceIds) return '';
  if (typeof event.sourceIds.get === 'function') return event.sourceIds.get(source) || '';
  return event.sourceIds[source] || '';
}

function updateStats(stats: Stats, result: { action: string; notifications: number }) {
  if (result.action === 'inserted') stats.inserted++;
  else if (result.action === 'updated') stats.updated++;
  else if (result.action === 'merged') stats.merged++;
  else if (result.action === 'skipped') stats.skipped++;
  stats.notifications += result.notifications;
}

function logResult(result: any, title: string) {
  if (result.action === 'skipped') return; // Don't log skipped events

  const action = result.action.charAt(0).toUpperCase() + result.action.slice(1);
  let log = `[Dedup] ${action}: ${title}`;
  if (result.data?.reason) log += ` (${result.data.reason})`;
  if (result.notifications > 0) log += ` [${result.notifications} notifications]`;
  console.log(log);
}

function handleProcessingError(err: any, title: string, stats: Stats) {
  if (err?.code === 11000) {
    console.log(`[Dedup] Duplicate key error: ${title}`);
  } else {
    console.error(`[Dedup] Error processing ${title}:`, err?.message || err);
  }
  stats.skipped++;
}