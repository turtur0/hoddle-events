import dotenv from 'dotenv';
import path from 'path';

if (!process.env.CI) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

import { connectDB, disconnectDB } from '@/lib/db';
import Event from '@/lib/models/Event';
import { scrapeAll } from '@/lib/scrapers';
import { processEventsWithDeduplication } from '../utils/scrape-with-dedup';
import { archivePastEvents } from '@/lib/services/archive-service';

interface Stats {
  inserted: number;
  updated: number;
  merged: number;
  skipped: number;
  notifications: number;
}

async function main() {
  const startTime = Date.now();

  console.log('========================================================');
  console.log('Melbourne Events Aggregator — Full Scrape');
  console.log('========================================================\n');

  try {
    await connectDB();

    // Step 1: Archive past events
    console.log('Step 1: Archiving past events...\n');
    const archiveStats = await archivePastEvents();
    console.log('');

    // Step 2: Scrape new events
    console.log('Step 2: Scraping new events...\n');
    const { events, results } = await scrapeAll({
      verbose: true,
      sources: ['ticketmaster', 'marriner', 'whatson', 'feverup'],
      marrinerOptions: {
        maxShows: 200,
        maxDetailFetches: 200,
        usePuppeteer: true,
      },
      whatsonOptions: {
        categories: ['theatre', 'music', 'comedy', 'sport', 'arts', 'film', 'family-and-kids', 'festival'],
        maxPages: 20,
        maxEventsPerCategory: 300,
        fetchDetails: true,
        detailFetchDelay: 1500,
      },
      feverupOptions: {
        maxEvents: 300,
        detailFetchDelay: 1500,
      },
    });

    if (!events?.length) {
      console.log('No events scraped from any source.');
      await displaySummary(
        { inserted: 0, updated: 0, merged: 0, skipped: 0, notifications: 0 },
        0,
        results,
        startTime,
        archiveStats
      );
      return;
    }

    // Step 3: Process events with deduplication
    console.log('\nStep 3: Processing events with deduplication...\n');
    const scrapeStats = await processEventsBySource(events);

    // Display summary
    await displaySummary(scrapeStats, events.length, results, startTime, archiveStats);

  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

async function processEventsBySource(events: any[]): Promise<Stats> {
  const stats: Stats = { inserted: 0, updated: 0, merged: 0, skipped: 0, notifications: 0 };

  // Group events by source
  const grouped = new Map<string, any[]>();
  for (const event of events) {
    if (!grouped.has(event.source)) {
      grouped.set(event.source, []);
    }
    grouped.get(event.source)!.push(event);
  }

  // Process each source
  for (const [source, sourceEvents] of grouped) {
    console.log(`\nProcessing ${sourceEvents.length} events from '${source}'...`);
    const sourceStats = await processEventsWithDeduplication(sourceEvents, source);

    stats.inserted += sourceStats.inserted;
    stats.updated += sourceStats.updated;
    stats.merged += sourceStats.merged;
    stats.skipped += sourceStats.skipped;
    stats.notifications += sourceStats.notifications;
  }

  return stats;
}

async function displaySummary(
  stats: Stats,
  totalScraped: number,
  results: any[],
  startTime: number,
  archiveStats: { archived: number; skipped: number; errors: number }
) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalInDb = await Event.countDocuments({ isArchived: { $ne: true } });
  const totalArchived = await Event.countDocuments({ isArchived: true });

  console.log('\n========================================================');
  console.log('SCRAPE COMPLETE');
  console.log('========================================================');
  console.log(`Duration:       ${duration}s`);
  console.log('');
  console.log('ARCHIVING:');
  console.log(`  Archived:     ${archiveStats.archived}`);
  console.log(`  Errors:       ${archiveStats.errors}`);
  console.log('');
  console.log('SCRAPING:');
  console.log(`  Scraped:      ${totalScraped}`);
  console.log(`  Inserted:     ${stats.inserted}`);
  console.log(`  Updated:      ${stats.updated}`);
  console.log(`  Merged:       ${stats.merged}`);
  console.log(`  Skipped:      ${stats.skipped}`);
  console.log(`  Notifications: ${stats.notifications}`);
  console.log('');
  console.log('DATABASE:');
  console.log(`  Active:       ${totalInDb}`);
  console.log(`  Archived:     ${totalArchived}`);
  console.log(`  Total:        ${totalInDb + totalArchived}`);
  console.log('========================================================\n');

  console.log('Source Breakdown:');
  for (const result of results) {
    const source = result.stats.source.padEnd(15);
    const count = result.stats.normalised;
    console.log(`  ${source} ${count} events`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default main;