import Event from '@/lib/models/Event';
import { findDuplicates, mergeEvents } from '@/lib/utils/deduplication';
import { processNewEventNotifications } from '@/lib/services/notificationService';
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

  console.log('Loading existing events...');
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
        await updateExistingEvent(sameSource._id, event, sourceName);
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

        let targetSource: string;
        let targetId: any;
        let targetDedup: EventForDedup | undefined;

        const dbMatch = existing.find((e) => e._id.toString() === matchId);
        if (dbMatch) {
          targetSource = dbMatch.primarySource;
          targetId = dbMatch._id;
          targetDedup = {
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
          };
        } else {
          const batchMatch = batchInserted.find((e) => e._id === matchId);
          if (!batchMatch) {
            // unexpected; skip this event
            console.log(`Skipping duplicate match for ${event.title} (no match found in DB or batch)`);
            stats.skipped++;
            continue;
          }
          targetSource = batchMatch.source;
          targetId = batchMatch._id;
          targetDedup = batchMatch;
        }

        if (targetDedup) {
          await mergeIntoExisting(targetId, targetDedup, event, sourceName);
          stats.merged++;
          console.log(`Merged: "${event.title}" into ${targetSource} (${match.reason})`);
        }

        continue;
      }

      const created = await insertNewEvent(event);
      batchInserted.push({
        _id: created._id.toString(),
        ...event,
        subcategories: event.subcategories || (event.subcategory ? [event.subcategory] : []),
      });
      stats.inserted++;
      console.log(`Inserted: ${event.title}`);

      try {
        const notificationCount = await processNewEventNotifications(created);
        stats.notifications += notificationCount;
        if (notificationCount > 0) {
          console.log(`Notifications sent: ${notificationCount} for ${event.title}`);
        }
      } catch (notifError) {
        console.error(`Notification error for ${event.title}:`, notifError);
      }
    } catch (err: any) {
      if (err && err.code === 11000) {
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

async function updateExistingEvent(id: any, event: NormalisedEvent, source: string) {
  const subcategories = [...(event.subcategories || [])];
  if (event.subcategory && !subcategories.includes(event.subcategory)) {
    subcategories.push(event.subcategory);
  }

  await Event.updateOne(
    { _id: id },
    {
      $set: {
        title: event.title,
        description: event.description,
        category: event.category,
        startDate: event.startDate,
        endDate: event.endDate,
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
        lastUpdated: new Date(),
      },
      $addToSet: { subcategories: { $each: subcategories } },
    }
  );
}

async function mergeIntoExisting(
  existingId: any,
  existing: EventForDedup,
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
