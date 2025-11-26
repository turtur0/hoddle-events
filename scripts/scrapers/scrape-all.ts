import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import Event from '@/lib/models/Event';
import { scrapeAll } from '@/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';

interface ScrapeStats {
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

    const { events, results } = await scrapeAll({
      verbose: true,
      sources: ['ticketmaster', 'marriner', 'whatson'],
      marrinerOptions: {
        maxShows: 50,
        maxDetailFetches: 50,
        usePuppeteer: true,
      },
      whatsonOptions: {
        categories: ['theatre', 'music'],
        maxPages: 5,
        maxEventsPerCategory: 50,
        fetchDetails: true,
        detailFetchDelay: 1000,
      },
    });

    if (!events || events.length === 0) {
      console.log('No events scraped from any source.');
      return;
    }

    console.log('\nProcessing events with deduplication...');

    const stats: ScrapeStats = {
      inserted: 0,
      updated: 0,
      merged: 0,
      skipped: 0,
      notifications: 0,
    };

    // Group events by source
    const eventsBySource = new Map<string, typeof events>();
    for (const event of events) {
      if (!eventsBySource.has(event.source)) {
        eventsBySource.set(event.source, []);
      }
      eventsBySource.get(event.source)!.push(event);
    }

    // Process each source
    for (const [source, sourceEvents] of eventsBySource) {
      console.log(`\nProcessing ${sourceEvents.length} events from '${source}'...`);
      const sourceStats = await processEventsWithDeduplication(sourceEvents, source);

      stats.inserted += sourceStats.inserted;
      stats.updated += sourceStats.updated;
      stats.merged += sourceStats.merged;
      stats.skipped += sourceStats.skipped;
      stats.notifications += sourceStats.notifications;
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalInDb = await Event.countDocuments();

    console.log('\n========================================================');
    console.log('SCRAPE COMPLETE');
    console.log('========================================================');
    console.log(`Duration:       ${duration}s`);
    console.log(`Scraped:        ${events.length}`);
    console.log(`Inserted:       ${stats.inserted}`);
    console.log(`Updated:        ${stats.updated}`);
    console.log(`Merged:         ${stats.merged}`);
    console.log(`Skipped:        ${stats.skipped}`);
    console.log(`Notifications:  ${stats.notifications}`);
    console.log(`Total in DB:    ${totalInDb}`);
    console.log('========================================================\n');

    console.log('Source Breakdown:');
    for (const result of results) {
      console.log(`  ${result.stats.source.padEnd(15)} ${result.stats.normalised} events`);
    }
  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export default main;