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

export async function processEventsWithDeduplication(
  newEvents: NormalisedEvent[],
  sourceName: string
): Promise<Stats> {
  console.log(`Processing ${newEvents.length} events from '${sourceName}'...`);
  const stats: Stats = { inserted: 0, updated: 0, merged: 0, skipped: 0, notifications: 0 };

  const existing = await Event.find({}).lean();
  console.log(`Found ${existing.length} existing events`);

  const getSourceId = (event: any, source: string): string => {
    if (!event.sourceIds) return '';
    if (typeof event.sourceIds.get === 'function') return event.sourceIds.get(source) || '';
    return event.sourceIds[source] || '';
  };

  const bySourceId = new Map(
    existing.map((e) => [`${e.primarySource}:${getSourceId(e, e.primarySource)}`, e])
  );

  const existingDedup: (EventForDedup & { _id: string })[] = existing.map((e) => ({
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

  const batchInserted: (EventForDedup & { _id: string })[] = [];

  for (const event of newEvents) {
    try {
      const sourceKey = `${event.source}:${event.sourceId}`;
      const sameSource = bySourceId.get(sourceKey);

      if (sameSource) {
        await updateExistingEvent(sameSource, event, sourceName);
        stats.updated++;
        console.log(`Updated: ${event.title}`);
        continue;
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
        .filter((d) => d.event1Id === tempId || d.event2Id === tempId)
        .sort((a, b) => b.confidence - a.confidence)[0];

      if (match) {
        const matchId = match.event1Id === tempId ? match.event2Id : match.event1Id;

        const dbMatch = existing.find((e) => e._id.toString() === matchId);
        const batchMatch = batchInserted.find((e) => e._id === matchId);

        if (!dbMatch && !batchMatch) {
          console.log(`Skipping duplicate match for ${event.title} (no match found)`);
          stats.skipped++;
          continue;
        }

        const targetId = dbMatch?._id || batchMatch?._id;
        const targetSource = dbMatch ? dbMatch.primarySource : batchMatch?.source;

        if (targetId) {
          const targetDedup = dbMatch ? {
            title: dbMatch.title,
            startDate: dbMatch.startDate,
            endDate: dbMatch.endDate,
            venue: dbMatch.venue,
            source: dbMatch.primarySource,
            sourceId: getSourceId(dbMatch, dbMatch.primarySource),
            description: dbMatch.description,
            category: dbMatch.category,
            subcategories: dbMatch.subcategories,
            imageUrl: dbMatch.imageUrl,
            videoUrl: dbMatch.videoUrl,
            priceMin: dbMatch.priceMin,
            priceMax: dbMatch.priceMax,
            priceDetails: dbMatch.priceDetails,
            isFree: dbMatch.isFree,
            bookingUrl: dbMatch.bookingUrl,
            accessibility: dbMatch.accessibility,
            ageRestriction: dbMatch.ageRestriction,
            duration: dbMatch.duration,
          } : batchMatch;

          if (targetDedup) {
            await mergeIntoExisting(targetId, targetDedup, event, sourceName);
            stats.merged++;
            console.log(`Merged: "${event.title}" into ${targetSource} (${match.reason})`);
          }
        }

        continue;
      }

      // Insert new event
      const created = await insertNewEvent(event);
      batchInserted.push({
        _id: created._id.toString(),
        ...event,
        subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : []),
      });
      stats.inserted++;
      console.log(`Inserted: ${event.title}`);

      // Send notifications for new events
      try {
        const notificationCount = await processNewEventNotifications(created);
        stats.notifications += notificationCount;
        if (notificationCount > 0) {
          console.log(`  → Sent ${notificationCount} notifications`);
        }
      } catch (error) {
        console.error(`  ✗ Notification error:`, error);
      }
    } catch (err: any) {
      if (err?.code === 11000) {
        stats.skipped++;
        console.log(`Duplicate key error for: ${event.title}`);
      } else {
        console.error(`Error processing ${event.title}:`, err?.message ?? err);
        stats.skipped++;
      }
    }
  }

  return stats;
}

async function updateExistingEvent(
  existing: any,
  newEvent: NormalisedEvent,
  source: string
) {
  const subcategories = [...(newEvent.subcategories || [])];
  if (newEvent.subcategory && !subcategories.includes(newEvent.subcategory)) {
    subcategories.push(newEvent.subcategory);
  }

  // Detect significant changes for favorited event notifications
  const changes: {
    priceDropped?: boolean;
    priceDrop?: number;
    significantUpdate?: string;
  } = {};

  // Check for price drop
  const oldPrice = existing.priceMin || 0;
  const newPrice = newEvent.priceMin || 0;
  if (oldPrice > 0 && newPrice > 0 && newPrice < oldPrice) {
    const drop = oldPrice - newPrice;
    if (drop >= 5) { // Only notify for drops of $5 or more
      changes.priceDropped = true;
      changes.priceDrop = drop;
    }
  }

  // Check for significant description changes
  if (newEvent.description && existing.description) {
    const oldDesc = existing.description.toLowerCase();
    const newDesc = newEvent.description.toLowerCase();

    // Look for meaningful keywords in the new description
    const significantKeywords = [
      'cancelled', 'postponed', 'rescheduled', 'sold out',
      'extra show', 'additional show', 'new date', 'date change'
    ];

    for (const keyword of significantKeywords) {
      if (!oldDesc.includes(keyword) && newDesc.includes(keyword)) {
        changes.significantUpdate = `Event status updated: ${keyword}`;
        break;
      }
    }
  }

  // Update the event in database
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

  // Send notifications for significant changes to favorited events
  if (changes.priceDropped || changes.significantUpdate) {
    try {
      const updatedEvent = await Event.findById(existing._id).lean();
      if (updatedEvent) {
        await processFavoritedEventUpdate(updatedEvent, changes);
      }
    } catch (error) {
      console.error(`  ✗ Favorite notification error:`, error);
    }
  }
}

async function mergeIntoExisting(
  existingId: any,
  existing: any,
  newEvent: NormalisedEvent,
  source: string
) {
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
      lastUpdated: new Date(),
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