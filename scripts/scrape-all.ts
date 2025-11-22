// ============================================
// scripts/scrape-all.ts
// Updated with deduplication
// ============================================
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/app/lib/db';
import { scrapeAll } from '@/app/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';
import Event from '@/app/lib/models/Event';

async function main() {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎭 Melbourne Events Aggregator - Full Scrape');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    await connectDB();

    // Step 1: Scrape all sources
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
      },
    });

    if (events.length === 0) {
      console.log('\n⚠️  No events scraped from any source');
      return;
    }

    // Step 2: Process with deduplication (handles both same-source and cross-source)
    console.log('\n💾 Processing events with deduplication...');
    
    let totalInserted = 0, totalUpdated = 0, totalMerged = 0, totalSkipped = 0;

    // Group events by source for organized processing
    const eventsBySource = new Map<string, typeof events>();
    events.forEach(event => {
      if (!eventsBySource.has(event.source)) {
        eventsBySource.set(event.source, []);
      }
      eventsBySource.get(event.source)!.push(event);
    });

    // Process each source
    for (const [source, sourceEvents] of eventsBySource) {
      console.log(`\n📊 Processing ${sourceEvents.length} events from ${source}...`);
      const stats = await processEventsWithDeduplication(sourceEvents, source);
      
      totalInserted += stats.inserted;
      totalUpdated += stats.updated;
      totalMerged += stats.merged;
      totalSkipped += stats.skipped;
    }

    // Step 3: Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalInDb = await Event.countDocuments();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  📊 SCRAPE COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Duration:     ${duration}s`);
    console.log(`  Scraped:      ${events.length} events`);
    console.log(`  Inserted:     ${totalInserted}`);
    console.log(`  Updated:      ${totalUpdated}`);
    console.log(`  Merged:       ${totalMerged}`);
    console.log(`  Skipped:      ${totalSkipped}`);
    console.log(`  Total in DB:  ${totalInDb}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Show breakdown by source
    console.log('📈 Source Breakdown:');
    results.forEach(r => {
      console.log(`   ${r.stats.source.padEnd(15)}: ${r.stats.normalised} events`);
    });

  } catch (error) {
    console.error('\n❌ Scraper failed:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

main();