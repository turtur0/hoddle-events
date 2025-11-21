// =============================================
// scripts/scrape-marriner.ts
// =============================================
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/app/lib/db';
import { scrapeMarrinerGroup, ScrapeOptions } from '@/app/lib/scrapers/marriner';
import Event from '@/app/lib/models/Event';

const SCRAPE_OPTIONS: ScrapeOptions = {
  maxShows: 50,          // Fetch up to 50 shows
  maxDetailFetches: 50,  // Fetch details for all shows
  usePuppeteer: true,    // Use Puppeteer for lazy-loaded /shows page
};

async function scrapeMarriner() {
  console.log('🎭 Marriner Group Scraper\n');
  console.log('📋 Options:', SCRAPE_OPTIONS, '\n');

  try {
    await connectDB();

    // Step 1: Scrape events
    const startTime = Date.now();
    const events = await scrapeMarrinerGroup(SCRAPE_OPTIONS);
    const scrapeDuration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Scraped ${events.length} events in ${scrapeDuration}s\n`);

    if (events.length === 0) {
      console.log('⚠️  No events found. Exiting.\n');
      return;
    }

    // Step 2: Process events with deduplication
    let inserted = 0, updated = 0, skipped = 0;

    for (const event of events) {
      try {
        // Check if event already exists by source + sourceId
        const existing = await Event.findOne({
          source: 'marriner',
          sourceId: event.sourceId,
        });

        if (existing) {
          // Update existing event (allows missing info to be filled in)
          const updateData = {
            ...event,
            lastUpdated: new Date(),
            // Preserve existing data if new data is missing
            description: event.description || existing.description,
            imageUrl: event.imageUrl || existing.imageUrl,
            priceMin: event.priceMin ?? existing.priceMin,
            priceMax: event.priceMax ?? existing.priceMax,
          };

          await Event.updateOne(
            { _id: existing._id },
            { $set: updateData }
          );
          updated++;
          console.log(`   ↻ Updated: ${event.title}`);
        } else {
          // Insert new event
          await Event.create(event);
          inserted++;
          console.log(`   + Inserted: ${event.title}`);
        }
      } catch (error: any) {
        // Handle duplicate key errors (should be rare with our check above)
        if (error.code === 11000) {
          skipped++;
          console.log(`   ⊘ Skipped (duplicate): ${event.title}`);
        } else {
          console.error(`   ❌ Error processing "${event.title}":`, error.message);
        }
      }
    }

    // Step 3: Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ Database Update Complete');
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 Summary:`);
    console.log(`   • Inserted: ${inserted} new events`);
    console.log(`   • Updated:  ${updated} existing events`);
    console.log(`   • Skipped:  ${skipped} duplicates`);
    console.log(`   • Total:    ${events.length} events processed`);
    console.log(`   • Duration: ${scrapeDuration}s\n`);

  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

scrapeMarriner();