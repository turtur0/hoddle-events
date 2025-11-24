import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from '@/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';

export async function scrapeTicketmasterWithDedup() {
  console.log('Ticketmaster scraper starting');

  try {
    await connectDB();

    const rawEvents = await fetchAllTicketmasterEvents();
    console.log(`Scraped ${rawEvents.length} events from Ticketmaster`);

    const events = rawEvents.map((r) => normaliseTicketmasterEvent(r));
    const stats = await processEventsWithDeduplication(events, 'ticketmaster');

    console.log('--------------------------------------------------------');
    console.log('Ticketmaster Processing Complete');
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
  scrapeTicketmasterWithDedup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
