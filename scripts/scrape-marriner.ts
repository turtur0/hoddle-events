import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import { ScrapeOptions } from '@/lib/scrapers/marriner';
import { scrapeMarrinerGroup } from '@/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';

const SCRAPE_OPTIONS: ScrapeOptions = {
  maxShows: 25,
  maxDetailFetches: 25,
  usePuppeteer: true,
};

export async function scrapeMarrinerWithDedup() {
  console.log('Marriner Group scraper starting');

  try {
    await connectDB();

    const events = await scrapeMarrinerGroup(SCRAPE_OPTIONS);
    console.log(`Scraped ${events.length} events from Marriner`);

    const stats = await processEventsWithDeduplication(events, 'marriner');

    console.log('--------------------------------------------------------');
    console.log('Marriner Processing Complete');
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
  scrapeMarrinerWithDedup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
