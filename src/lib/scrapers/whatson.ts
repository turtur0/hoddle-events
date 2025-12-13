import { load, CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { NormalisedEvent } from './types';
import { mapWhatsOnCategory } from '../utils/category-mapper';
import { canScrape } from '../utils/robots-checker';
import { normalisePrice } from '../utils/price-utils';

const BASE_URL = 'https://whatson.melbourne.vic.gov.au';

/** Browser-like headers to avoid 403 responses */
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

/** Known Melbourne suburbs for venue location extraction */
const MELBOURNE_SUBURBS = [
  'Melbourne', 'Carlton', 'Fitzroy', 'Collingwood',
  'Richmond', 'Southbank', 'St Kilda', 'South Yarra', 'Docklands'
];

interface ListingEvent {
  url: string;
  title: string;
  summary: string;
  startDate?: Date;
  endDate?: Date;
  imageUrl?: string;
  isFree: boolean;
  tags: string[];
}

interface DetailedEvent extends ListingEvent {
  description?: string;
  venue?: string;
  address?: string;
  priceMin?: number;
  priceMax?: number;
  priceDetails?: string;
  accessibility?: string[];
}

export interface WhatsOnScrapeOptions {
  /** Categories to scrape (e.g., 'theatre', 'music') */
  categories?: string[];
  /** Maximum number of pages to scrape per category */
  maxPages?: number;
  /** Maximum events to collect per category */
  maxEventsPerCategory?: number;
  /** Whether to fetch detailed event pages */
  fetchDetails?: boolean;
  /** Delay between detail page fetches in milliseconds */
  detailFetchDelay?: number;
}

/**
 * Scrapes events from What's On Melbourne website.
 * Can scrape multiple categories and optionally fetch detailed event information.
 * 
 * @param opts - Scraping options
 * @returns Array of normalised events
 */
export async function scrapeWhatsOnMelbourne(opts: WhatsOnScrapeOptions = {}): Promise<NormalisedEvent[]> {
  const categories = opts.categories || ['theatre', 'music'];
  const fetchDetails = opts.fetchDetails ?? false;
  const allEvents: NormalisedEvent[] = [];
  const seenTitles = new Set<string>();

  console.log('[WhatsOn] Checking robots.txt compliance');
  const baseAllowed = await canScrape(`${BASE_URL}/tags/theatre`);
  if (!baseAllowed) {
    console.log('[WhatsOn] Scraping disallowed by robots.txt');
    return [];
  }

  console.log(`[WhatsOn] Scraping categories: ${categories.join(', ')}`);
  console.log(`[WhatsOn] Detail fetching: ${fetchDetails ? 'enabled' : 'disabled'}`);

  for (const category of categories) {
    console.log(`[WhatsOn] Processing category: ${category}`);

    const listingEvents = await collectEventsFromListings(category, opts.maxPages || 10);
    console.log(`[WhatsOn] Found ${listingEvents.length} events from listings`);

    const limit = opts.maxEventsPerCategory || listingEvents.length;
    let processedCount = 0;

    for (let i = 0; i < listingEvents.length && processedCount < limit; i++) {
      const listing = listingEvents[i];

      const titleKey = listing.title.toLowerCase().trim();
      if (seenTitles.has(titleKey)) {
        console.log(`[WhatsOn] Skipping duplicate: ${listing.title}`);
        continue;
      }

      let eventData: DetailedEvent = listing;

      if (fetchDetails) {
        // Check robots.txt before fetching details
        const detailsAllowed = await canScrape(listing.url);
        if (!detailsAllowed) {
          console.log(`[WhatsOn] Skipping ${listing.url} - disallowed by robots.txt`);
          continue;
        }

        const details = await fetchEventDetails(listing.url);
        if (details) {
          eventData = { ...listing, ...details };
        }
        await delay(opts.detailFetchDelay || 1000);
      }

      const event = toNormalisedEvent(eventData, category);
      if (event) {
        allEvents.push(event);
        seenTitles.add(titleKey);
        processedCount++;
        console.log(`[WhatsOn] Processed ${processedCount}/${limit}: ${event.title}`);
      }
    }

    await delay(2000);
  }

  console.log(`[WhatsOn] Total: ${allEvents.length} unique events`);
  return allEvents;
}

/**
 * Collects event listings from category pages with pagination.
 * Implements retry logic and rate limiting to handle server restrictions.
 */
async function collectEventsFromListings(category: string, maxPages: number): Promise<ListingEvent[]> {
  const events: ListingEvent[] = [];
  const seenUrls = new Set<string>();
  let consecutiveFailures = 0;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = `${BASE_URL}/tags/${category}${page > 1 ? `/page-${page}` : ''}`;

      // Rate limiting with random delay
      if (page > 1) {
        await delay(2000 + Math.random() * 1000);
      }

      const res = await fetch(pageUrl, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        console.log(`[WhatsOn] Page ${page} failed: ${res.status} ${res.statusText}`);
        consecutiveFailures++;

        if (consecutiveFailures >= 3) {
          console.log(`[WhatsOn] Too many failures, stopping category: ${category}`);
          break;
        }

        await delay(5000);
        continue;
      }

      consecutiveFailures = 0;
      const $ = load(await res.text());
      const prevCount = events.length;

      // Parse event listings from page
      $('.page-preview').each((_, el) => {
        const $el = $(el);
        const listingType = $el.attr('data-listing-type');

        if (!listingType || !listingType.includes('event')) {
          return;
        }

        const event = parseListingItem($, $el);
        if (event && !seenUrls.has(event.url)) {
          events.push(event);
          seenUrls.add(event.url);
        }
      });

      const newCount = events.length - prevCount;
      console.log(`[WhatsOn] Page ${page}: +${newCount} events (${events.length} total)`);

      // Stop if no new events found
      if (newCount === 0) {
        console.log(`[WhatsOn] No new events found on page ${page}, stopping`);
        break;
      }

      // Check for next page
      const hasNextPage = $('.pagination a[rel="next"]').length > 0 ||
        $('.pagination .next a').length > 0;

      if (!hasNextPage && page > 1) {
        console.log('[WhatsOn] No more pages available');
        break;
      }

    } catch (error: any) {
      console.error(`[WhatsOn] Page ${page} error:`, error.message);
      consecutiveFailures++;

      if (consecutiveFailures >= 3) {
        console.log(`[WhatsOn] Too many failures, stopping category: ${category}`);
        break;
      }

      await delay(5000);
    }
  }

  return events;
}

/**
 * Parses a single event listing item from the page.
 */
function parseListingItem($: CheerioAPI, $el: Cheerio<Element>): ListingEvent | null {
  const $link = $el.find('a.main-link');
  const href = $link.attr('href');

  if (!href || !href.includes('/things-to-do/')) {
    return null;
  }

  const title = $el.find('h2.title').text().trim();
  if (!title) return null;

  const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
  const dates = parseDatesFromListing($el);

  const imgSrc = $el.find('.page_image').attr('src');
  const imageUrl = imgSrc?.startsWith('http')
    ? imgSrc
    : imgSrc ? `${BASE_URL}${imgSrc}` : undefined;

  // Extract tags
  const tags: string[] = [];
  $el.find('.tag-list a').each((_, tagEl) => {
    const tag = $(tagEl).text().trim().toLowerCase();
    if (tag) tags.push(tag);
  });

  const isFree = tags.includes('free');

  return {
    url: fullUrl,
    title,
    summary: $el.find('p.summary').text().trim() || '',
    startDate: dates.startDate,
    endDate: dates.endDate,
    imageUrl,
    isFree,
    tags,
  };
}

/**
 * Parses date information from listing item.
 */
function parseDatesFromListing($el: Cheerio<Element>): { startDate?: Date; endDate?: Date } {
  const timeEls = $el.find('time[datetime]');
  const dates: Date[] = [];

  timeEls.each((_, el) => {
    const dt = $el.find(el).attr('datetime');
    if (dt) {
      const date = new Date(dt);
      if (!isNaN(date.getTime())) {
        dates.push(date);
      }
    }
  });

  if (dates.length === 0) return {};

  dates.sort((a, b) => a.getTime() - b.getTime());

  return {
    startDate: dates[0],
    endDate: dates.length > 1 ? dates[dates.length - 1] : undefined,
  };
}

/**
 * Fetches and parses detailed information from an event page.
 */
async function fetchEventDetails(url: string): Promise<Partial<DetailedEvent> | null> {
  try {
    await delay(1000 + Math.random() * 500);

    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      console.log(`[WhatsOn] Detail fetch failed for ${url}: ${res.status}`);
      return null;
    }

    const $ = load(await res.text());

    return {
      description: extractDescription($),
      venue: extractVenue($),
      address: extractAddress($),
      ...extractPrices($),
      accessibility: extractAccessibility($),
    };
  } catch (error: any) {
    console.log(`[WhatsOn] Detail error for ${url}:`, error.message);
    return null;
  }
}

/**
 * Extracts event description from meta tags or page content.
 */
function extractDescription($: CheerioAPI): string | undefined {
  return $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('.listing-description .contents').text().trim().substring(0, 500) ||
    undefined;
}

/**
 * Extracts venue name from location widget or venue elements.
 */
function extractVenue($: CheerioAPI): string | undefined {
  const locationWidget = $('.location.details-widget p').first().text().trim();
  if (locationWidget) {
    return locationWidget.split('\n')[0].trim();
  }

  return $('[class*="venue"]').first().text().trim().split('\n')[0] || undefined;
}

/**
 * Extracts full address from location widget.
 */
function extractAddress($: CheerioAPI): string | undefined {
  const lines = $('.location.details-widget p')
    .text()
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  return lines.slice(1).join(', ') || undefined;
}

/**
 * Extracts price information including ranges and free events.
 */
function extractPrices($: CheerioAPI): {
  priceMin?: number;
  priceMax?: number;
  priceDetails?: string;
  isFree?: boolean;
} {
  const widget = $('.price-and-bookings').text();

  // Check for free events
  if (/\bfree\b/i.test(widget)) {
    return { priceMin: 0, priceMax: 0, isFree: true };
  }

  // Check for price range format
  const rangeMatch = widget.match(/From\s*\$(\d+(?:\.\d+)?)\s*to\s*\$(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return {
      priceMin: parseFloat(rangeMatch[1]),
      priceMax: parseFloat(rangeMatch[2]),
      priceDetails: extractPriceTable($),
    };
  }

  // Extract all dollar amounts
  const prices = widget
    .match(/\$(\d+(?:\.\d+)?)/g)
    ?.map(p => parseFloat(p.replace('$', '')))
    .filter(p => p > 0) || [];

  if (prices.length > 0) {
    return {
      priceMin: Math.min(...prices),
      priceMax: prices.length > 1 ? Math.max(...prices) : undefined,
      priceDetails: extractPriceTable($),
    };
  }

  return {};
}

/**
 * Extracts detailed price information from price table.
 */
function extractPriceTable($: CheerioAPI): string | undefined {
  const rows = $('.price-table tr td')
    .map((_, el) => $(el).text().trim())
    .get();

  return rows.length > 0 ? rows.join('; ') : undefined;
}

/**
 * Extracts accessibility features listed on the event page.
 */
function extractAccessibility($: CheerioAPI): string[] {
  return $('.accessibility-feature__link')
    .map((_, el) => $(el).text().trim())
    .get();
}

/**
 * Converts detailed event data to normalised format.
 */
function toNormalisedEvent(event: DetailedEvent, categoryTag: string): NormalisedEvent | null {
  if (!event.startDate) {
    console.log(`[WhatsOn] Skipping "${event.title}" - no start date`);
    return null;
  }

  const { category, subcategory } = mapWhatsOnCategory(categoryTag, event.title);
  const suburb = extractSuburb(event.address || '');

  return {
    title: event.title,
    description: event.description || event.summary || 'No description available',
    category,
    subcategory,
    subcategories: subcategory ? [subcategory] : [],
    startDate: event.startDate,
    endDate: event.endDate,
    venue: {
      name: event.venue || 'Venue TBA',
      address: event.address || 'Melbourne VIC',
      suburb,
    },
    priceMin: event.priceMin,
    priceMax: event.priceMax,
    priceDetails: event.priceDetails,
    isFree: event.isFree || false,
    bookingUrl: event.url,
    imageUrl: event.imageUrl,
    accessibility: event.accessibility,
    source: 'whatson',
    sourceId: slugify(event.title),
    scrapedAt: new Date(),
    lastUpdated: new Date(),
  };
}

/**
 * Extracts suburb from address string by matching known Melbourne suburbs.
 */
function extractSuburb(address: string): string {
  for (const suburb of MELBOURNE_SUBURBS) {
    if (address.includes(suburb)) {
      return suburb;
    }
  }
  return 'Melbourne';
}

/**
 * Converts text to URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Simple delay utility for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}