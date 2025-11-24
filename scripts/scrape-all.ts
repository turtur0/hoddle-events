import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import Event from '@/lib/models/Event';
import { scrapeAll } from '@/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';

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
        maxShows: 100,
        maxDetailFetches: 100,
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
      console.log('No events were scraped from any source.');
      return;
    }

    console.log('\nProcessing events with deduplication...');

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalMerged = 0;
    let totalSkipped = 0;

    const eventsBySource = new Map<string, typeof events>();
    for (const ev of events) {
      if (!eventsBySource.has(ev.source)) eventsBySource.set(ev.source, []);
      eventsBySource.get(ev.source)!.push(ev);
    }

    for (const [source, sourceEvents] of eventsBySource) {
      console.log(`Processing ${sourceEvents.length} events from '${source}'...`);
      const stats = await processEventsWithDeduplication(sourceEvents, source);
      totalInserted += stats.inserted;
      totalUpdated += stats.updated;
      totalMerged += stats.merged;
      totalSkipped += stats.skipped;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalInDb = await Event.countDocuments();

    console.log('\n========================================================');
    console.log('SCRAPE COMPLETE');
    console.log('========================================================');
    console.log(`Duration:     ${duration}s`);
    console.log(`Scraped:      ${events.length}`);
    console.log(`Inserted:     ${totalInserted}`);
    console.log(`Updated:      ${totalUpdated}`);
    console.log(`Merged:       ${totalMerged}`);
    console.log(`Skipped:      ${totalSkipped}`);
    console.log(`Total in DB:  ${totalInDb}`);
    console.log('========================================================\n');

    console.log('Source Breakdown:');
    for (const r of results) {
      console.log(`  ${r.stats.source.padEnd(15)} ${r.stats.normalised}`);
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
