// ============================================
// scripts/scrape-ticketmaster.ts
// Ticketmaster scraper with deduplication
// ============================================
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/app/lib/db';
import { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from '@/app/lib/scrapers';
import { processEventsWithDeduplication } from './scrape-with-dedup';

export async function scrapeTicketmasterWithDedup() {
  console.log('🎫 Ticketmaster Scraper with Deduplication\n');

  try {
    await connectDB();

    const rawEvents = await fetchAllTicketmasterEvents();
    console.log(`\n✅ Scraped ${rawEvents.length} events from Ticketmaster`);

    const events = rawEvents.map(raw => normaliseTicketmasterEvent(raw));

    const stats = await processEventsWithDeduplication(events, 'ticketmaster');

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ Ticketmaster Processing Complete');
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
  scrapeTicketmasterWithDedup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}