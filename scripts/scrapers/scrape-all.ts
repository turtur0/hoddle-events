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

/**
 * Main scraper orchestrator that coordinates scraping from all sources,
 * processes events with deduplication, and reports statistics.
 */
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
        maxShows: 10,
        maxDetailFetches: 10,
        usePuppeteer: true,
      },
      whatsonOptions: {
        categories: ['theatre', 'music'],
        maxPages: 2,
        maxEventsPerCategory: 10,
        fetchDetails: true,
        detailFetchDelay: 1000,
      },
    });

    if (!events?.length) {
      console.log('No events scraped from any source.');
      return;
    }

    console.log('\nProcessing events with deduplication...');

    const stats = await processAllEvents(events);
    await displaySummary(stats, events.length, results, startTime);

  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

/**
 * Processes events grouped by source through the deduplication pipeline.
 */
async function processAllEvents(events: any[]): Promise<ScrapeStats> {
  const stats: ScrapeStats = {
    inserted: 0,
    updated: 0,
    merged: 0,
    skipped: 0,
    notifications: 0,
  };

  const eventsBySource = groupEventsBySource(events);

  for (const [source, sourceEvents] of eventsBySource) {
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

/** Groups events by their source for separate processing. */
function groupEventsBySource(events: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();

  for (const event of events) {
    if (!grouped.has(event.source)) {
      grouped.set(event.source, []);
    }
    grouped.get(event.source)!.push(event);
  }

  return grouped;
}

/** Displays comprehensive scrape statistics and summary. */
async function displaySummary(
  stats: ScrapeStats,
  totalScraped: number,
  results: any[],
  startTime: number
) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalInDb = await Event.countDocuments();

  console.log('\n========================================================');
  console.log('SCRAPE COMPLETE');
  console.log('========================================================');
  console.log(`Duration:       ${duration}s`);
  console.log(`Scraped:        ${totalScraped}`);
  console.log(`Inserted:       ${stats.inserted}`);
  console.log(`Updated:        ${stats.updated}`);
  console.log(`Merged:         ${stats.merged}`);
  console.log(`Skipped:        ${stats.skipped}`);
  console.log(`Notifications:  ${stats.notifications}`);
  console.log(`Total in DB:    ${totalInDb}`);
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