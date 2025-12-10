import { load } from 'cheerio';
import type { NormalisedEvent } from './types';
import { canScrape } from '../utils/robots-checker';

const BASE_URL = 'https://feverup.com';
const MELBOURNE_URL = `${BASE_URL}/en/melbourne/things-to-do`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
  'Referer': 'https://feverup.com/en/melbourne',
};

export interface FeverUpScrapeOptions {
  maxEvents?: number;
  fetchDetails?: boolean;
  detailFetchDelay?: number;
}

/**
 * Scrapes events from FeverUp Melbourne using structured data (JSON-LD).
 */
export async function scrapeFeverUpMelbourne(opts: FeverUpScrapeOptions = {}): Promise<NormalisedEvent[]> {
  const { maxEvents = 50, fetchDetails = true, detailFetchDelay = 1500 } = opts;
  const allEvents: NormalisedEvent[] = [];
  const seenUrls = new Set<string>();

  console.log('[FeverUp] Checking robots.txt compliance');
  if (!await canScrape(MELBOURNE_URL)) {
    console.log('[FeverUp] Scraping disallowed by robots.txt');
    return [];
  }

  console.log('[FeverUp] Starting scrape of Melbourne events');
  console.log(`[FeverUp] Detail fetching: ${fetchDetails ? 'enabled' : 'disabled'}`);

  try {
    const eventUrls = await fetchEventListingUrls();
    console.log(`[FeverUp] Found ${eventUrls.length} event URLs`);

    const limit = Math.min(maxEvents, eventUrls.length);
    let processedCount = 0;

    for (const url of eventUrls) {
      if (processedCount >= limit || seenUrls.has(url)) continue;
      if (!await canScrape(url)) {
        console.log(`[FeverUp] Skipping ${url} - disallowed by robots.txt`);
        continue;
      }

      const event = await fetchAndNormaliseEvent(url);
      if (event) {
        allEvents.push(event);
        seenUrls.add(url);
        processedCount++;
        console.log(`[FeverUp] Processed ${processedCount}/${limit}: ${event.title}`);
      }

      await delay(detailFetchDelay);
    }

    console.log(`[FeverUp] Total: ${allEvents.length} events scraped`);
    return allEvents;

  } catch (error: any) {
    console.error('[FeverUp] Scraping failed:', error.message);
    return allEvents;
  }
}

/**
 * Fetches event URLs from listing page using JSON-LD structured data.
 */
async function fetchEventListingUrls(): Promise<string[]> {
  await delay(1000);

  const response = await fetch(MELBOURNE_URL, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    console.error(`[FeverUp] Listing fetch failed: ${response.status}`);
    return [];
  }

  const $ = load(await response.text());
  const eventUrls: string[] = [];

  $('script[type="application/ld+json"]').each((_: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
        data.itemListElement.forEach((item: any) => {
          if (item.url?.includes('/m/')) {
            eventUrls.push(item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`);
          }
        });
      }
    } catch { }
  });

  // Fallback to HTML scraping
  if (eventUrls.length === 0) {
    $('a[href*="/m/"]').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (href?.includes('/m/')) {
        eventUrls.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
      }
    });
  }

  return [...new Set(eventUrls)];
}

/**
 * Fetches and normalises a single event.
 */
async function fetchAndNormaliseEvent(url: string): Promise<NormalisedEvent | null> {
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const $ = load(await response.text());
    const structuredData = extractStructuredData($);

    if (!structuredData) {
      console.log(`[FeverUp] No structured data found for ${url}`);
      return null;
    }

    const title = structuredData.name || '';
    if (title.toLowerCase().includes('gift card')) {
      console.log(`[FeverUp] Skipping gift card: ${title}`);
      return null;
    }

    const dates = extractDates(structuredData, $);
    if (!dates.startDate) {
      console.log('[FeverUp] Skipping event - missing required fields');
      return null;
    }

    const venue = extractVenue(structuredData, $);
    const pricing = extractPricing(structuredData);
    const description = cleanText(structuredData.description || '', 500);

    return {
      title,
      description: description || 'No description available',
      category: categoriseEvent(title, description),
      subcategory: undefined,
      subcategories: [],

      startDate: dates.startDate,
      endDate: dates.endDate,

      venue: {
        name: venue.name,
        address: venue.address,
        suburb: venue.suburb,
      },

      priceMin: pricing.priceMin,
      priceMax: pricing.priceMax,
      priceDetails: pricing.priceDetails,
      isFree: pricing.priceMin === 0,

      bookingUrl: url,
      imageUrl: extractImage(structuredData),

      accessibility: extractAccessibility($),
      ageRestriction: extractAgeRestriction($),
      duration: extractDuration($),

      source: 'feverup' as any,
      sourceId: url.match(/\/m\/(\d+)/)?.[1] || url,
      scrapedAt: new Date(),
      lastUpdated: new Date(),
    };

  } catch (error: any) {
    console.log(`[FeverUp] Error for ${url}:`, error.message);
    return null;
  }
}

/**
 * Extracts JSON-LD structured data from page.
 */
function extractStructuredData($: any): any | null {
  let data: any = null;
  $('script[type="application/ld+json"]').each((_: number, el: any) => {
    try {
      const parsed = JSON.parse($(el).html() || '{}');
      if (parsed['@type'] === 'Product' || parsed['@type'] === 'Event') {
        data = parsed;
        return false;
      }
    } catch { }
  });
  return data;
}

/**
 * Extracts main image URL.
 */
function extractImage(data: any): string | undefined {
  if (data.image?.contentUrl) return data.image.contentUrl;
  if (Array.isArray(data.images) && data.images[0]) {
    return typeof data.images[0] === 'string' ? data.images[0] : data.images[0].url;
  }
  if (typeof data.image === 'string') return data.image;
  return undefined;
}

/**
 * Extracts pricing information from structured data.
 * Note: FeverUp only includes base ticket price in structured data.
 */
function extractPricing(data: any): {
  priceMin?: number;
  priceMax?: number;
  priceDetails?: string;
} {
  const tickets: Array<{ name: string; price: number }> = [];
  const prices: number[] = [];

  if (Array.isArray(data.offers)) {
    data.offers.forEach((offer: any) => {
      if (offer.price && offer.price > 0) {
        prices.push(offer.price);
        if (offer.name) {
          const name = offer.name.includes(' - ')
            ? offer.name.split(' - ').pop()!
            : offer.name;
          tickets.push({ name, price: offer.price });
        }
      }
    });
  }

  return {
    priceMin: prices.length > 0 ? Math.min(...prices) : undefined,
    priceMax: prices.length > 1 ? Math.max(...prices) : undefined,
    priceDetails: tickets.length > 0
      ? tickets.map(t => `${t.name}: $${t.price.toFixed(2)}`).join('; ')
      : undefined,
  };
}

/**
 * Extracts venue information.
 */
function extractVenue(data: any, $: any): {
  name: string;
  address: string;
  suburb: string;
} {
  let name = 'Venue TBA';
  let address = 'Melbourne VIC';

  // Try structured data first
  const location = data.location || data.offers?.[0]?.areaServed;
  if (location) {
    if (location.name) name = location.name;
    if (location.address) {
      const parts = [
        location.name,
        location.address.line1,
        location.address.line2,
        location.address.addressLocality
      ].filter(Boolean);
      if (parts.length > 0) address = parts.join(', ');
    }
  }

  // Fallback to HTML
  if (name === 'Venue TBA' || name.includes('Secret Location')) {
    const htmlName = $('[data-testid="plan-location-name"]').first().text().trim();
    const htmlAddress = $('[data-testid="plan-location-address"]').first().text().trim();
    if (htmlName) name = htmlName;
    if (htmlAddress) address = htmlAddress;
  }

  return {
    name,
    address,
    suburb: extractSuburb(address),
  };
}

/**
 * Extracts start and end dates.
 */
function extractDates(data: any, $: any): { startDate?: Date; endDate?: Date } {
  // Try structured data first
  if (data.startDate) {
    const start = new Date(data.startDate);
    const end = data.endDate ? new Date(data.endDate) : undefined;
    if (!isNaN(start.getTime())) {
      return {
        startDate: start,
        endDate: end && !isNaN(end.getTime()) ? end : undefined,
      };
    }
  }

  // Extract from HTML date elements
  const dates: string[] = [];
  $('[class*="date"]').each((_: number, el: any) => {
    const text = $(el).text().trim();
    if (/^[A-Z][a-z]{2,8}\s+\d{4}$/.test(text)) dates.push(text);
  });

  if (dates.length > 0) {
    const unique = [...new Set(dates)].sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    );

    const start = new Date(`${unique[0]} 1`);
    const end = new Date(`${unique[unique.length - 1]} 1`);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);

    return { startDate: start, endDate: end };
  }

  return {};
}

/**
 * Extracts accessibility features.
 */
function extractAccessibility($: any): string[] {
  const features: string[] = [];
  const text = $('#plan-description').text();

  if (/wheelchair accessible/i.test(text)) features.push('Wheelchair accessible');
  if (/audio guide/i.test(text)) features.push('Audio guide available');
  if (/hearing loop/i.test(text)) features.push('Hearing loop available');
  if (/accessible parking/i.test(text)) features.push('Accessible parking');

  return features;
}

/**
 * Extracts age restriction.
 */
function extractAgeRestriction($: any): string | undefined {
  const text = $('#plan-description').text();

  const patterns = [
    /👤\s*Age requirement:\s*([^👤📍⏳♿🎁📅\n]+)/i,
    /(all ages are welcome[^👤📍⏳♿\n.]{0,100})/i,
    /(minimum age[:\s]+\d+[^👤📍⏳♿\n.]{0,80})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      let result = match[1].trim().replace(/\s+/g, ' ');

      if (result.length > 100 && !result.endsWith('.')) {
        const lastPeriod = result.substring(0, 120).lastIndexOf('.');
        result = lastPeriod > 50
          ? result.substring(0, lastPeriod + 1)
          : result.substring(0, 100) + '...';
      }

      return result.substring(0, 150);
    }
  }

  return undefined;
}

/**
 * Extracts duration.
 */
function extractDuration($: any): string | undefined {
  const text = $('#plan-description').text();
  const match = text.match(/⏳\s*Duration:\s*([^\n📍]+)/i) ||
    text.match(/duration[:\s]+([^\n📍]+)/i) ||
    text.match(/(\d+)\s*(?:hour|hr|minute|min)s?/i);

  return match?.[1]?.trim() || match?.[0]?.replace(/^⏳\s*Duration:\s*/i, '').trim();
}

/**
 * Extracts suburb from address.
 */
function extractSuburb(address: string): string {
  const suburbs = [
    'Melbourne', 'Carlton', 'Fitzroy', 'Collingwood', 'Richmond',
    'Southbank', 'St Kilda', 'South Yarra', 'Docklands', 'CBD',
    'Brunswick', 'Northcote', 'Prahran', 'South Melbourne', 'Port Melbourne',
  ];

  return suburbs.find(s => address.includes(s)) || 'Melbourne';
}

/**
 * Categorises event based on title and description.
 */
function categoriseEvent(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (text.match(/\b(candlelight|concert|music|symphony|orchestra|jazz|rock|pop|band|classical|tribute)\b/)) {
    return 'music';
  }
  if (text.match(/\b(theatre|musical|play|opera|ballet|performance|show|dance)\b/)) {
    return 'theatre';
  }
  if (text.match(/\b(exhibition|gallery|art|museum|immersive|experience)\b/)) {
    return 'arts';
  }
  if (text.match(/\b(family|kids|children|interactive|workshop)\b/)) {
    return 'family';
  }
  if (text.match(/\b(sport|game|match|race|tournament)\b/)) {
    return 'sports';
  }

  return 'other';
}

/**
 * Cleans text by removing HTML and limiting length.
 */
function cleanText(text: string, maxLength: number): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\\r\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

/**
 * Polite delay for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}