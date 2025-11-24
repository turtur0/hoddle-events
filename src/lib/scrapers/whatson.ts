import { load, CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { NormalisedEvent } from './types';
import { mapWhatsOnCategory } from '../utils/category-mapper';

const BASE_URL = 'https://whatson.melbourne.vic.gov.au';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

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
  categories?: string[];
  maxPages?: number;
  maxEventsPerCategory?: number;
  fetchDetails?: boolean;
  detailFetchDelay?: number;
}

export async function scrapeWhatsOnMelbourne(opts: WhatsOnScrapeOptions = {}): Promise<NormalisedEvent[]> {
  const categories = opts.categories || ['theatre', 'music'];
  const fetchDetails = opts.fetchDetails ?? false;
  const allEvents: NormalisedEvent[] = [];
  const seenTitles = new Set<string>();

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
        const details = await fetchEventDetails(listing.url);
        if (details) {
          eventData = { ...listing, ...details };
        }
        await delay(opts.detailFetchDelay || 800);
      }

      const event = toNormalisedEvent(eventData, category);
      if (event) {
        allEvents.push(event);
        seenTitles.add(titleKey);
        processedCount++;
        console.log(`[WhatsOn] Processed ${processedCount}/${limit}: ${event.title}`);
      }
    }
  }

  console.log(`[WhatsOn] Total: ${allEvents.length} unique events`);
  return allEvents;
}

async function collectEventsFromListings(category: string, maxPages: number): Promise<ListingEvent[]> {
  const events: ListingEvent[] = [];
  const seenUrls = new Set<string>();
  let consecutiveEmptyPages = 0;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = `${BASE_URL}/tags/${category}${page > 1 ? `/page-${page}` : ''}`;
      const res = await fetch(pageUrl, { headers: HEADERS });

      if (!res.ok) {
        console.log(`[WhatsOn] Page ${page} failed: ${res.status}`);
        break;
      }

      const $ = load(await res.text());
      const prevCount = events.length;

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

      if (newCount === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) {
          console.log(`[WhatsOn] Stopping: ${consecutiveEmptyPages} consecutive empty pages`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
      }

      const hasNextPage = $('.pagination a[rel="next"]').length > 0 ||
        $('.pagination .next a').length > 0;

      if (!hasNextPage && page > 1) {
        console.log('[WhatsOn] No more pages available');
        break;
      }

      await delay(800);
    } catch (err) {
      console.error(`[WhatsOn] Page ${page} error:`, err);
      break;
    }
  }

  return events;
}

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
  const imageUrl = imgSrc?.startsWith('http') ? imgSrc : imgSrc ? `${BASE_URL}${imgSrc}` : undefined;

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

function parseDatesFromListing($el: Cheerio<Element>): { startDate?: Date; endDate?: Date } {
  const timeEls = $el.find('time[datetime]');
  const dates: Date[] = [];

  timeEls.each((_, el) => {
    const dt = $el.find(el).attr('datetime');
    if (dt) {
      const d = new Date(dt);
      if (!isNaN(d.getTime())) dates.push(d);
    }
  });

  if (dates.length === 0) return {};
  
  dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    startDate: dates[0],
    endDate: dates.length > 1 ? dates[dates.length - 1] : undefined,
  };
}

async function fetchEventDetails(url: string): Promise<Partial<DetailedEvent> | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
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
  } catch {
    return null;
  }
}

function extractDescription($: CheerioAPI): string | undefined {
  return $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('.listing-description .contents').text().trim().substring(0, 500) ||
    undefined;
}

function extractVenue($: CheerioAPI): string | undefined {
  const locationWidget = $('.location.details-widget p').first().text().trim();
  if (locationWidget) return locationWidget.split('\n')[0].trim();
  return $('[class*="venue"]').first().text().trim().split('\n')[0] || undefined;
}

function extractAddress($: CheerioAPI): string | undefined {
  const lines = $('.location.details-widget p')
    .text()
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  return lines.slice(1).join(', ') || undefined;
}

function extractPrices($: CheerioAPI): { 
  priceMin?: number; 
  priceMax?: number; 
  priceDetails?: string; 
  isFree?: boolean 
} {
  const widget = $('.price-and-bookings').text();
  
  if (/\bfree\b/i.test(widget)) {
    return { priceMin: 0, priceMax: 0, isFree: true };
  }

  const rangeMatch = widget.match(/From\s*\$(\d+(?:\.\d+)?)\s*to\s*\$(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return {
      priceMin: parseFloat(rangeMatch[1]),
      priceMax: parseFloat(rangeMatch[2]),
      priceDetails: extractPriceTable($),
    };
  }

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

function extractPriceTable($: CheerioAPI): string | undefined {
  const rows = $('.price-table tr td').map((_, el) => $(el).text().trim()).get();
  return rows.length > 0 ? rows.join('; ') : undefined;
}

function extractAccessibility($: CheerioAPI): string[] {
  return $('.accessibility-feature__link').map((_, el) => $(el).text().trim()).get();
}

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
    isFree: event.isFree,
    bookingUrl: event.url,
    imageUrl: event.imageUrl,
    accessibility: event.accessibility,
    source: 'whatson',
    sourceId: slugify(event.title),
    scrapedAt: new Date(),
    lastUpdated: new Date(),
  };
}

function extractSuburb(address: string): string {
  const suburbs = [
    'Melbourne', 'Carlton', 'Fitzroy', 'Collingwood', 
    'Richmond', 'Southbank', 'St Kilda', 'South Yarra', 'Docklands'
  ];
  
  for (const s of suburbs) {
    if (address.includes(s)) return s;
  }
  
  return 'Melbourne';
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}