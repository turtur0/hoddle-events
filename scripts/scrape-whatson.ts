// ============================================
// scripts/scrape-whatson.ts
// ============================================
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/app/lib/db';
import { scrapeWhatsOnMelbourne, WhatsOnScrapeOptions } from '@/app/lib/scrapers/whatson';
import { processEventsWithDeduplication } from './scrape-with-dedup';

const SCRAPE_OPTIONS: WhatsOnScrapeOptions = {
        categories: ['theatre', 'music'],
        maxPages: 2,
        maxEventsPerCategory: 25,
        fetchDetails: true, 
        detailFetchDelay: 1000,  // Be polite to the server
};

export async function scrapeWhatsOnWithDedup(customOptions?: WhatsOnScrapeOptions) {
  console.log('🎭 What\'s On Melbourne Scraper with Deduplication\n');

  try {
    await connectDB();

    // Use custom options if provided, otherwise use defaults
    const options = customOptions || SCRAPE_OPTIONS;
    
    console.log(`📋 Scrape settings:`);
    console.log(`   • Categories: ${options.categories?.join(', ') || 'all'}`);
    console.log(`   • Max pages per category: ${options.maxPages || 'unlimited'}`);
    console.log(`   • Max events per category: ${options.maxEventsPerCategory || 'unlimited'}\n`);

    const events = await scrapeWhatsOnMelbourne(options);

    console.log(`\n✅ Scraped ${events.length} events from What's On`);

    const stats = await processEventsWithDeduplication(events, 'whatson');

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ What\'s On Processing Complete');
    console.log(`${'='.repeat(70)}`);
    console.log(`📊 Summary:`);
    console.log(`   • Inserted: ${stats.inserted} new events`);
    console.log(`   • Updated:  ${stats.updated} same-source events`);
    console.log(`   • Merged:   ${stats.merged} cross-source duplicates`);
    console.log(`   • Skipped:  ${stats.skipped} errors`);
    console.log(`   • Total:    ${events.length} events processed\n`);

  } finally {
    await disconnectDB();
  }
}

// Allow running directly
if (require.main === module) {
  scrapeWhatsOnWithDedup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}