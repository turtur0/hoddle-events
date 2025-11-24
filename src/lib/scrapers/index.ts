import { NormalisedEvent, ScrapeResult } from './types';
import { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
import { scrapeMarrinerGroup } from './marriner';
import { scrapeWhatsOnMelbourne, WhatsOnScrapeOptions } from './whatson';

export { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
export { scrapeMarrinerGroup } from './marriner';
export { scrapeWhatsOnMelbourne } from './whatson';
export type { WhatsOnScrapeOptions } from './whatson';

interface ScrapeAllOptions {
  sources?: ('ticketmaster' | 'marriner' | 'whatson')[];
  verbose?: boolean;
  parallel?: boolean;
  marrinerOptions?: {
    maxShows?: number;
    maxDetailFetches?: number;
    usePuppeteer?: boolean;
  };
  whatsonOptions?: WhatsOnScrapeOptions;
}

export async function scrapeAll(
  options?: ScrapeAllOptions
): Promise<{ events: NormalisedEvent[]; results: ScrapeResult[] }> {
  const sources = options?.sources || ['ticketmaster', 'marriner', 'whatson'];
  const verbose = options?.verbose ?? true;
  const parallel = options?.parallel ?? true;

  const results: ScrapeResult[] = [];
  const allEvents: NormalisedEvent[] = [];

  if (verbose) {
    console.log('[Scraper] Starting scrape');
    console.log(`[Scraper] Sources: ${sources.join(', ')}`);
    console.log(`[Scraper] Mode: ${parallel ? 'parallel' : 'sequential'}`);
  }

  const tasks: { name: string; fn: () => Promise<ScrapeResult> }[] = [];

  if (sources.includes('ticketmaster')) {
    tasks.push({ name: 'ticketmaster', fn: () => scrapeTicketmaster(verbose) });
  }
  if (sources.includes('marriner')) {
    tasks.push({
      name: 'marriner',
      fn: () => scrapeMarriner(verbose, options?.marrinerOptions),
    });
  }
  if (sources.includes('whatson')) {
    tasks.push({
      name: 'whatson',
      fn: () => scrapeWhatsOn(verbose, options?.whatsonOptions),
    });
  }

  if (parallel) {
    const settled = await Promise.allSettled(tasks.map(t => t.fn()));
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        results.push(r.value);
        allEvents.push(...r.value.events);
      } else {
        console.error(`[${tasks[i].name}] Failed:`, r.reason);
      }
    });
  } else {
    for (const task of tasks) {
      try {
        const result = await task.fn();
        results.push(result);
        allEvents.push(...result.events);
      } catch (err) {
        console.error(`[${task.name}] Failed:`, err);
      }
    }
  }

  if (verbose) {
    console.log('[Scraper] Summary:');
    results.forEach(r => {
      console.log(
        `[${r.stats.source}] ${r.stats.normalised} events in ${(r.stats.duration / 1000).toFixed(1)}s`
      );
    });
    console.log(`[Scraper] Total: ${allEvents.length} events`);
  }

  return { events: allEvents, results };
}

async function scrapeTicketmaster(verbose: boolean): Promise<ScrapeResult> {
  const start = Date.now();
  let fetched = 0;
  let normalised = 0;
  let errors = 0;

  if (verbose) console.log('[Ticketmaster] Starting scrape');

  try {
    const rawEvents = await fetchAllTicketmasterEvents();
    fetched = rawEvents.length;

    const events: NormalisedEvent[] = [];
    for (const raw of rawEvents) {
      try {
        events.push(normaliseTicketmasterEvent(raw));
        normalised++;
      } catch {
        errors++;
        if (verbose) console.error(`[Ticketmaster] Failed to normalise: ${raw.name}`);
      }
    }

    if (verbose) console.log(`[Ticketmaster] Complete: ${normalised} events`);

    return {
      events,
      stats: {
        source: 'ticketmaster',
        fetched,
        normalised,
        errors,
        duration: Date.now() - start,
      },
    };
  } catch (error) {
    if (verbose) console.error('[Ticketmaster] Error:', error);
    return {
      events: [],
      stats: {
        source: 'ticketmaster',
        fetched,
        normalised,
        errors: errors + 1,
        duration: Date.now() - start,
      },
    };
  }
}

async function scrapeMarriner(
  verbose: boolean,
  options?: { maxShows?: number; maxDetailFetches?: number; usePuppeteer?: boolean }
): Promise<ScrapeResult> {
  const start = Date.now();
  let fetched = 0;
  let normalised = 0;
  let errors = 0;

  if (verbose) console.log('[Marriner] Starting scrape');

  try {
    const events = await scrapeMarrinerGroup({
      maxShows: options?.maxShows ?? 100,
      maxDetailFetches: options?.maxDetailFetches ?? 100,
      usePuppeteer: options?.usePuppeteer ?? true,
    });

    fetched = events.length;
    normalised = events.length;

    if (verbose) console.log(`[Marriner] Complete: ${normalised} events`);

    return {
      events,
      stats: {
        source: 'marriner',
        fetched,
        normalised,
        errors,
        duration: Date.now() - start,
      },
    };
  } catch (error) {
    if (verbose) console.error('[Marriner] Error:', error);
    return {
      events: [],
      stats: {
        source: 'marriner',
        fetched,
        normalised,
        errors: errors + 1,
        duration: Date.now() - start,
      },
    };
  }
}

async function scrapeWhatsOn(
  verbose: boolean,
  options?: WhatsOnScrapeOptions
): Promise<ScrapeResult> {
  const start = Date.now();
  let fetched = 0;
  let normalised = 0;
  let errors = 0;

  if (verbose) console.log("[WhatsOn] Starting scrape");

  try {
    const defaultOptions: WhatsOnScrapeOptions = {
      categories: ['theatre', 'music'],
      maxPages: 5,
      maxEventsPerCategory: 50,
      fetchDetails: true,
      detailFetchDelay: 1000,
    };

    const events = await scrapeWhatsOnMelbourne({
      ...defaultOptions,
      ...options,
    });

    fetched = events.length;
    normalised = events.length;

    if (verbose) console.log(`[WhatsOn] Complete: ${normalised} events`);

    return {
      events,
      stats: {
        source: 'whatson',
        fetched,
        normalised,
        errors,
        duration: Date.now() - start,
      },
    };
  } catch (error) {
    if (verbose) console.error("[WhatsOn] Error:", error);
    return {
      events: [],
      stats: {
        source: 'whatson',
        fetched,
        normalised,
        errors: errors + 1,
        duration: Date.now() - start,
      },
    };
  }
}