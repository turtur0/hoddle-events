import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import { scrapeWhatsOnMelbourne, WhatsOnScrapeOptions } from '@/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';

const DEFAULT_OPTIONS: WhatsOnScrapeOptions = {
  categories: ['theatre', 'music'],
  maxPages: 2,
  maxEventsPerCategory: 25,
  fetchDetails: true,
  detailFetchDelay: 1000,
};

export async function scrapeWhatsOnWithDedup(customOptions?: WhatsOnScrapeOptions) {
  console.log("What's On Melbourne scraper starting");

  try {
    await connectDB();

    const options = customOptions || DEFAULT_OPTIONS;

    console.log('Scrape settings:');
    console.log(`  Categories: ${options.categories?.join(', ') || 'all'}`);
    console.log(`  Max pages per category: ${options.maxPages || 'unlimited'}`);
    console.log(`  Max events per category: ${options.maxEventsPerCategory || 'unlimited'}`);

    const events = await scrapeWhatsOnMelbourne(options);
    console.log(`Scraped ${events.length} events from What's On`);

    const stats = await processEventsWithDeduplication(events, 'whatson');

    console.log('--------------------------------------------------------');
    console.log("What's On Processing Complete");
    console.log('--------------------------------------------------------');
    console.log('Summary:');
    console.log(`  Inserted: ${stats.inserted}`);
    console.log(`  Updated:  ${stats.updated}`);
    console.log(`  Merged:   ${stats.merged}`);
    console.log(`  Skipped:  ${stats.skipped}`);
    console.log(`  Total:    ${events.length}`);
    console.log('');
    return stats;
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  scrapeWhatsOnWithDedup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
