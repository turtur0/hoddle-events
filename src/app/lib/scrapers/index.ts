import { NormalisedEvent, ScrapeResult } from './types';
import { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
import { scrapeMarrinerGroup } from './marriner';

export { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
export { scrapeMarrinerGroup } from './marriner';
export * from './types';

interface ScrapeAllOptions {
  sources?: ('ticketmaster' | 'marriner')[];
  verbose?: boolean;
  marrinerOptions?: {
    maxShows?: number;
    maxDetailFetches?: number;
    usePuppeteer?: boolean;
  };
}

/**
 * Scrape events from all sources (or specified sources)
 */
export async function scrapeAll(options?: ScrapeAllOptions): Promise<{
  events: NormalisedEvent[];
  results: ScrapeResult[];
}> {
  const sources = options?.sources || ['ticketmaster', 'marriner'];
  const verbose = options?.verbose ?? true;
  const results: ScrapeResult[] = [];
  const allEvents: NormalisedEvent[] = [];

  if (verbose) {
    console.log('🚀 Starting multi-source scrape...');
    console.log(`   Sources: ${sources.join(', ')}\n`);
  }

  // Scrape sources in parallel for speed
  const scrapePromises: Promise<ScrapeResult>[] = [];

  if (sources.includes('ticketmaster')) {
    scrapePromises.push(scrapeTicketmaster(verbose));
  }

  if (sources.includes('marriner')) {
    scrapePromises.push(scrapeMarriner(verbose, options?.marrinerOptions));
  }

  // Wait for all scrapers to complete
  const completedResults = await Promise.allSettled(scrapePromises);

  // Process results
  completedResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
      allEvents.push(...result.value.events);
    } else {
      console.error('   ❌ Scraper failed:', result.reason);
    }
  });

  if (verbose) {
    console.log('\n📊 Scrape Summary:');
    results.forEach(r => {
      console.log(`   ${r.stats.source}: ${r.stats.normalised} events (${(r.stats.duration / 1000).toFixed(1)}s)`);
    });
    console.log(`   Total: ${allEvents.length} events`);
  }

  return { events: allEvents, results };
}

/**
 * Scrape Ticketmaster and return normalised events
 */
async function scrapeTicketmaster(verbose: boolean): Promise<ScrapeResult> {
  const start = Date.now();
  let fetched = 0, normalised = 0, errors = 0;

  if (verbose) console.log('🎫 Scraping Ticketmaster...');

  try {
    const rawEvents = await fetchAllTicketmasterEvents();
    fetched = rawEvents.length;

    const events: NormalisedEvent[] = [];
    for (const raw of rawEvents) {
      try {
        events.push(normaliseTicketmasterEvent(raw));
        normalised++;
      } catch (e) {
        errors++;
        if (verbose) console.error(`   ⚠️  Failed to normalise event: ${raw.name}`);
      }
    }

    if (verbose) console.log(`   ✅ Ticketmaster: ${normalised} events\n`);

    return {
      events,
      stats: { source: 'ticketmaster', fetched, normalised, errors, duration: Date.now() - start }
    };
  } catch (error) {
    if (verbose) console.error('   ❌ Ticketmaster failed:', error);
    return {
      events: [],
      stats: { source: 'ticketmaster', fetched, normalised, errors: errors + 1, duration: Date.now() - start }
    };
  }
}

/**
 * Scrape Marriner Group and return normalised events
 */
async function scrapeMarriner(
  verbose: boolean,
  options?: { maxShows?: number; maxDetailFetches?: number; usePuppeteer?: boolean }
): Promise<ScrapeResult> {
  const start = Date.now();
  let fetched = 0, normalised = 0, errors = 0;

  if (verbose) console.log('🎭 Scraping Marriner Group...');

  try {
    const events = await scrapeMarrinerGroup({
      maxShows: options?.maxShows || 100,
      maxDetailFetches: options?.maxDetailFetches || 100,
      usePuppeteer: options?.usePuppeteer ?? true,
    });

    fetched = events.length;
    normalised = events.length;

    if (verbose) console.log(`   ✅ Marriner: ${normalised} events\n`);

    return {
      events,
      stats: { source: 'marriner', fetched, normalised, errors, duration: Date.now() - start }
    };
  } catch (error) {
    if (verbose) console.error('   ❌ Marriner failed:', error);
    return {
      events: [],
      stats: { source: 'marriner', fetched, normalised, errors: errors + 1, duration: Date.now() - start }
    };
  }
}