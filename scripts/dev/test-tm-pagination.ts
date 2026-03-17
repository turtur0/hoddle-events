import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { fetchTicketmasterEvents } from '@/lib/scrapers/ticketmaster';

const TM_MAX_PAGE = 4; // Must match the value in ticketmaster.ts

async function main() {
  // Page 0 — baseline check
  const { events, totalPages } = await fetchTicketmasterEvents(0, 10);
  console.log('totalPages reported by API:', totalPages);
  console.log('events on page 0:', events.length);

  // Last valid page — should succeed
  console.log(`\nFetching last valid page (${TM_MAX_PAGE})...`);
  const last = await fetchTicketmasterEvents(TM_MAX_PAGE, 10);
  console.log(`Page ${TM_MAX_PAGE} events:`, last.events.length, '✓');

  // One beyond the cap — should 400 (confirming the cap is real)
  console.log(`\nFetching page ${TM_MAX_PAGE + 1} (expect 400)...`);
  try {
    await fetchTicketmasterEvents(TM_MAX_PAGE + 1, 10);
    console.log('No error — cap may have changed, check TM_MAX_PAGE');
  } catch (err: any) {
    console.log(`Got expected error: ${err.message} ✓`);
    console.log('TM_MAX_PAGE = 4 is correct, loop guard will stop before this page');
  }
}

main().catch(console.error);