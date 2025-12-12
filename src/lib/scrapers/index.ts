import { NormalisedEvent, ScrapeResult } from './types';
import { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
import { scrapeMarrinerGroup } from './marriner';
import { scrapeWhatsOnMelbourne, WhatsOnScrapeOptions } from './whatson';
import { scrapeFeverUpMelbourne, FeverUpScrapeOptions } from './feverup';

export { fetchAllTicketmasterEvents, normaliseTicketmasterEvent } from './ticketmaster';
export { scrapeMarrinerGroup } from './marriner';
export { scrapeWhatsOnMelbourne } from './whatson';
export { scrapeFeverUpMelbourne } from './feverup';
export type { WhatsOnScrapeOptions } from './whatson';
export type { FeverUpScrapeOptions } from './feverup';

interface ScrapeAllOptions {
  sources?: ('ticketmaster' | 'marriner' | 'whatson' | 'feverup')[];
  verbose?: boolean;
  parallel?: boolean;
  marrinerOptions?: {
    maxShows?: number;
    maxDetailFetches?: number;
    usePuppeteer?: boolean;
  };
  whatsonOptions?: WhatsOnScrapeOptions;
  feverupOptions?: FeverUpScrapeOptions;
}

/**
 * Orchestrates scraping from multiple event sources.
 */
export async function scrapeAll(
  options?: ScrapeAllOptions
): Promise<{ events: NormalisedEvent[]; results: ScrapeResult[] }> {
  const sources = options?.sources || ['ticketmaster', 'marriner', 'whatson', 'feverup'];
  const verbose = options?.verbose ?? true;
  const parallel = options?.parallel ?? true;

  const results: ScrapeResult[] = [];
  const allEvents: NormalisedEvent[] = [];

  if (verbose) {
    console.log('[Scraper] Starting scrape');
    console.log(`[Scraper] Sources: ${sources.join(', ')}`);
    console.log(`[Scraper] Mode: ${parallel ? 'parallel' : 'sequential'}`);
  }

  const tasks = buildTasks(sources, verbose, options);

  // Execute tasks
  if (parallel) {
    const settled = await Promise.allSettled(tasks.map(t => t.fn()));
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        allEvents.push(...result.value.events);
      } else {
        console.error(`[${tasks[index].name}] Failed:`, result.reason);
      }
    });
  } else {
    for (const task of tasks) {
      try {
        const result = await task.fn();
        results.push(result);
        allEvents.push(...result.events);
      } catch (error) {
        console.error(`[${task.name}] Failed:`, error);
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

function buildTasks(
  sources: string[],
  verbose: boolean,
  options?: ScrapeAllOptions
): { name: string; fn: () => Promise<ScrapeResult> }[] {
  const tasks: { name: string; fn: () => Promise<ScrapeResult> }[] = [];

  if (sources.includes('ticketmaster')) {
    tasks.push({ 
      name: 'ticketmaster', 
      fn: () => scrapeSource('ticketmaster', verbose, async () => {
        const rawEvents = await fetchAllTicketmasterEvents();
        return rawEvents.map(normaliseTicketmasterEvent);
      })
    });
  }

  if (sources.includes('marriner')) {
    tasks.push({
      name: 'marriner',
      fn: () => scrapeSource('marriner', verbose, () => 
        scrapeMarrinerGroup({
          maxShows: options?.marrinerOptions?.maxShows ?? 100,
          maxDetailFetches: options?.marrinerOptions?.maxDetailFetches ?? 100,
          usePuppeteer: options?.marrinerOptions?.usePuppeteer ?? true,
        })
      )
    });
  }

  if (sources.includes('whatson')) {
    tasks.push({
      name: 'whatson',
      fn: () => scrapeSource('whatson', verbose, () =>
        scrapeWhatsOnMelbourne({
          categories: ['theatre', 'music'],
          maxPages: 5,
          maxEventsPerCategory: 50,
          fetchDetails: true,
          detailFetchDelay: 1000,
          ...options?.whatsonOptions,
        })
      )
    });
  }

  if (sources.includes('feverup')) {
    tasks.push({
      name: 'feverup',
      fn: () => scrapeSource('feverup', verbose, () =>
        scrapeFeverUpMelbourne({
          maxEvents: 50,
          detailFetchDelay: 1500,
          ...options?.feverupOptions,
        })
      )
    });
  }

  return tasks;
}

async function scrapeSource(
  source: string,
  verbose: boolean,
  scrapeFn: () => Promise<NormalisedEvent[]>
): Promise<ScrapeResult> {
  const start = Date.now();
  const stats = {
    source,
    fetched: 0,
    normalised: 0,
    errors: 0,
    duration: 0,
  };

  if (verbose) console.log(`[${source}] Starting scrape`);

  try {
    const events = await scrapeFn();
    stats.fetched = events.length;
    stats.normalised = events.length;

    if (verbose) console.log(`[${source}] Complete: ${stats.normalised} events`);

    stats.duration = Date.now() - start;
    return { events, stats };
  } catch (error) {
    if (verbose) console.error(`[${source}] Error:`, error);
    stats.errors++;
    stats.duration = Date.now() - start;
    return { events: [], stats };
  }
}