// ============================================
// scrapers/index.ts
// Updated to include whatson scraper with detail fetching
// ============================================
import { NormalisedEvent, ScrapeResult } from './types';
import { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
import { scrapeMarrinerGroup } from './marriner';
import { scrapeWhatsOnMelbourne, WhatsOnScrapeOptions } from './whatson';

export { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
export { scrapeMarrinerGroup } from './marriner';
export { scrapeWhatsOnMelbourne } from './whatson';
export * from './types';

interface ScrapeAllOptions {
  sources?: ('ticketmaster' | 'marriner' | 'whatson')[];
  verbose?: boolean;
  parallel?: boolean;  // Run scrapers in parallel (default: true)
  marrinerOptions?: {
    maxShows?: number;
    maxDetailFetches?: number;
    usePuppeteer?: boolean;
  };
  whatsonOptions?: WhatsOnScrapeOptions;
}

/**
 * Scrape events from all sources (or specified sources)
 */
export async function scrapeAll(options?: ScrapeAllOptions): Promise<{
  events: NormalisedEvent[];
  results: ScrapeResult[];
}> {
  const sources = options?.sources || ['ticketmaster', 'marriner', 'whatson'];
  const verbose = options?.verbose ?? true;
  const parallel = options?.parallel ?? true;
  const results: ScrapeResult[] = [];
  const allEvents: NormalisedEvent[] = [];

  if (verbose) {
    console.log('🚀 Starting multi-source scrape...');
    console.log(`   Sources: ${sources.join(', ')}`);
    console.log(`   Mode: ${parallel ? 'parallel' : 'sequential'}\n`);
  }

  // Build scraper tasks
  const scraperTasks: { name: string; fn: () => Promise<ScrapeResult> }[] = [];

  if (sources.includes('ticketmaster')) {
    scraperTasks.push({ name: 'ticketmaster', fn: () => scrapeTicketmaster(verbose) });
  }

  if (sources.includes('marriner')) {
    scraperTasks.push({ name: 'marriner', fn: () => scrapeMarriner(verbose, options?.marrinerOptions) });
  }

  if (sources.includes('whatson')) {
    scraperTasks.push({ name: 'whatson', fn: () => scrapeWhatsOn(verbose, options?.whatsonOptions) });
  }

  if (parallel) {
    // Run all scrapers in parallel
    const completedResults = await Promise.allSettled(scraperTasks.map(t => t.fn()));

    completedResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        allEvents.push(...result.value.events);
      } else {
        console.error(`   ❌ ${scraperTasks[i].name} failed:`, result.reason);
      }
    });
  } else {
    // Run scrapers sequentially (cleaner logs, easier debugging)
    for (const task of scraperTasks) {
      try {
        const result = await task.fn();
        results.push(result);
        allEvents.push(...result.events);
      } catch (error) {
        console.error(`   ❌ ${task.name} failed:`, error);
      }
    }
  }

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

/**
 * Scrape What's On Melbourne and return normalised events
 */
async function scrapeWhatsOn(
  verbose: boolean,
  options?: WhatsOnScrapeOptions
): Promise<ScrapeResult> {
  const start = Date.now();
  let fetched = 0, normalised = 0, errors = 0;

  if (verbose) console.log('🎪 Scraping What\'s On Melbourne...');

  try {
    // Default options with fetchDetails ENABLED for full data
    const defaultOptions: WhatsOnScrapeOptions = {
      categories: ['theatre', 'music'],
      maxPages: 5,
      maxEventsPerCategory: 50,
      fetchDetails: true,  // IMPORTANT: Enable detail fetching by default
      detailFetchDelay: 1000,
    };

    const events = await scrapeWhatsOnMelbourne({
      ...defaultOptions,
      ...options,  // Allow overrides
    });

    fetched = events.length;
    normalised = events.length;

    if (verbose) console.log(`   ✅ What's On: ${normalised} events\n`);

    return {
      events,
      stats: { source: 'whatson', fetched, normalised, errors, duration: Date.now() - start }
    };
  } catch (error) {
    if (verbose) console.error('   ❌ What\'s On failed:', error);
    return {
      events: [],
      stats: { source: 'whatson', fetched, normalised, errors: errors + 1, duration: Date.now() - start }
    };
  }
}