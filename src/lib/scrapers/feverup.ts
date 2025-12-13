import { load } from 'cheerio';
import type { NormalisedEvent } from './types';
import { normalisePrice } from '../utils/price-utils';
import { canScrape } from '../utils/robots-checker';

const BASE_URL = 'https://feverup.com';
const MELBOURNE_URL = `${BASE_URL}/en/melbourne/things-to-do`;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Referer': 'https://feverup.com/en/melbourne',
};

export interface FeverUpScrapeOptions {
  maxEvents?: number;
  detailFetchDelay?: number;
  usePuppeteer?: boolean;
}

/**
 * Scrapes events from FeverUp Melbourne.
 * Uses Puppeteer to scroll and load all events, then Cheerio for detail pages.
 */
export async function scrapeFeverUpMelbourne(opts: FeverUpScrapeOptions = {}): Promise<NormalisedEvent[]> {
  const { maxEvents = 50, detailFetchDelay = 1500, usePuppeteer = true } = opts;

  console.log('[FeverUp] Checking robots.txt compliance');
  if (!await canScrape(MELBOURNE_URL)) {
    console.log('[FeverUp] Scraping disallowed by robots.txt');
    return [];
  }

  console.log('[FeverUp] Fetching event URLs');
  const urls = usePuppeteer
    ? await fetchUrlsWithPuppeteer(maxEvents)
    : await fetchUrlsWithCheerio();

  console.log(`[FeverUp] Found ${urls.length} unique event URLs`);

  const allEvents: NormalisedEvent[] = [];
  const fetchLimit = maxEvents === Infinity ? urls.length : Math.min(maxEvents, urls.length);

  for (let i = 0; i < fetchLimit; i++) {
    const url = urls[i];

    if (!await canScrape(url)) {
      console.log(`[FeverUp] Skipping ${url} - disallowed by robots.txt`);
      continue;
    }

    const event = await fetchAndNormaliseEvent(url);
    if (event) {
      allEvents.push(event);
      console.log(`[FeverUp] Processed ${i + 1}/${fetchLimit}: ${event.title}`);
    }

    await delay(detailFetchDelay);
  }

  console.log(`[FeverUp] Total: ${allEvents.length} events scraped`);
  return allEvents;
}

/** Uses Puppeteer to scroll the listing page and collect event URLs */
async function fetchUrlsWithPuppeteer(maxEvents: number): Promise<string[]> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(HEADERS['User-Agent']);
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('[FeverUp] Loading page...');
  await page.goto(MELBOURNE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  const urls = new Set<string>();
  let noChangeCount = 0;
  let scrollAttempts = 0;
  const maxScrolls = maxEvents === Infinity ? 100 : 30;

  console.log('[FeverUp] Scrolling to load events...');

  while (noChangeCount < 5 && scrollAttempts < maxScrolls) {
    const prevSize = urls.size;

    // Extract event URLs from current page
    const found = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/m/"]'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(h => h.includes('/m/') && !h.endsWith('/things-to-do'));
    });

    found.forEach(url => urls.add(url));

    if (urls.size === prevSize) {
      noChangeCount++;
    } else {
      noChangeCount = 0;
      console.log(`[FeverUp] Scroll ${scrollAttempts + 1}: ${urls.size} URLs (+${urls.size - prevSize})`);
    }

    // Scroll and wait for new content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    try {
      await page.waitForNetworkIdle({ timeout: 3000, idleTime: 500 });
    } catch { }
    await delay(2000);
    scrollAttempts++;

    if (noChangeCount >= 3 && urls.size > 50) break;
  }

  await browser.close();
  const result = Array.from(urls);
  console.log(`[FeverUp] Collected ${urls.size} URLs after ${scrollAttempts} scrolls`);

  return maxEvents === Infinity ? result : result.slice(0, maxEvents);
}

/** Fallback: Fetches URLs using Cheerio (no scrolling, limited to ~48 events) */
async function fetchUrlsWithCheerio(): Promise<string[]> {
  await delay(1000);
  const response = await fetch(MELBOURNE_URL, { headers: HEADERS, signal: AbortSignal.timeout(20000) });

  if (!response.ok) {
    console.error(`[FeverUp] Listing fetch failed: ${response.status}`);
    return [];
  }

  const $ = load(await response.text());
  const urls: string[] = [];

  // Try JSON-LD structured data first
  $('script[type="application/ld+json"]').each((_: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
        data.itemListElement.forEach((item: any) => {
          if (item.url?.includes('/m/')) {
            urls.push(item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`);
          }
        });
      }
    } catch { }
  });

  // Fallback to HTML links
  if (urls.length === 0) {
    $('a[href*="/m/"]').each((_: number, el: any) => {
      const href = $(el).attr('href');
      if (href?.includes('/m/')) {
        urls.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
      }
    });
  }

  return [...new Set(urls)];
}

/** Fetches and normalises a single event page */
async function fetchAndNormaliseEvent(url: string): Promise<NormalisedEvent | null> {
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;

    const $ = load(await response.text());
    const data = extractStructuredData($);

    if (!data) {
      console.log(`[FeverUp] No structured data for ${url}`);
      return null;
    }

    const title = data.name || '';
    if (title.toLowerCase().includes('gift card')) {
      console.log(`[FeverUp] Skipping gift card: ${title}`);
      return null;
    }

    const dates = extractDates(data, $);
    if (!dates.startDate) {
      console.log('[FeverUp] Skipping - missing start date');
      return null;
    }

    const venue = extractVenue(data, $);
    const pricing = extractPricing(data);
    const description = cleanText(data.description || '', 500);

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
      imageUrl: extractImage(data),
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

// Extraction functions
function extractStructuredData($: any): any | null {
  let result: any = null;
  $('script[type="application/ld+json"]').each((_: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'Product' || data['@type'] === 'Event') {
        result = data;
        return false;
      }
    } catch { }
  });
  return result;
}

function extractImage(data: any): string | undefined {
  if (data.image?.contentUrl) return data.image.contentUrl;
  if (Array.isArray(data.images) && data.images[0]) {
    return typeof data.images[0] === 'string' ? data.images[0] : data.images[0].url;
  }
  if (typeof data.image === 'string') return data.image;
  return undefined;
}

function extractPricing(data: any) {
  const prices: number[] = [];
  const tickets: Array<{ name: string; price: number }> = [];

  if (Array.isArray(data.offers)) {
    data.offers.forEach((offer: any) => {
      if (offer.price && offer.price > 0) {
        prices.push(offer.price);
        if (offer.name) {
          const name = offer.name.includes(' - ') ? offer.name.split(' - ').pop()! : offer.name;
          tickets.push({ name, price: offer.price });
        }
      }
    });
  }

  return {
    priceMin: prices.length > 0 ? normalisePrice(Math.min(...prices)) : undefined,
    priceMax: prices.length > 1 ? normalisePrice(Math.max(...prices)) : undefined,
    priceDetails: tickets.length > 0
      ? tickets.map(t => `${t.name}: $${normalisePrice(t.price)?.toFixed(2)}`).join('; ')
      : undefined,
  };
}

function extractVenue(data: any, $: any) {
  let name = 'Venue TBA';
  let address = 'Melbourne VIC';

  // Try structured data
  const location = data.location || data.offers?.[0]?.areaServed;
  if (location) {
    if (location.name) name = location.name;
    if (location.address) {
      const parts = [location.name, location.address.line1, location.address.line2,
      location.address.addressLocality].filter(Boolean);
      if (parts.length > 0) address = parts.join(', ');
    }
  }

  // Fallback to HTML
  if (name === 'Venue TBA' || name.includes('Secret Location')) {
    const htmlName = $('[data-testid="plan-location-name"]').first().text().trim();
    const htmlAddr = $('[data-testid="plan-location-address"]').first().text().trim();
    if (htmlName) name = htmlName;
    if (htmlAddr) address = htmlAddr;
  }

  return { name, address, suburb: extractSuburb(address) };
}

function extractDates(data: any, $: any) {
  // Try structured data first
  if (data.startDate) {
    const start = new Date(data.startDate);
    const end = data.endDate ? new Date(data.endDate) : undefined;
    if (!isNaN(start.getTime())) {
      return {
        startDate: start,
        endDate: end && !isNaN(end.getTime()) ? end : undefined
      };
    }
  }

  // Fallback: extract from HTML
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

function extractAccessibility($: any): string[] {
  const features: string[] = [];
  const text = $('#plan-description').text();

  if (/wheelchair accessible/i.test(text)) features.push('Wheelchair accessible');
  if (/audio guide/i.test(text)) features.push('Audio guide available');
  if (/hearing loop/i.test(text)) features.push('Hearing loop available');
  if (/accessible parking/i.test(text)) features.push('Accessible parking');

  return features;
}

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

      // Trim to sentence boundary if needed
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

function extractDuration($: any): string | undefined {
  const text = $('#plan-description').text();
  const match = text.match(/⏳\s*Duration:\s*([^\n📍]+)/i) ||
    text.match(/duration[:\s]+([^\n📍]+)/i) ||
    text.match(/(\d+)\s*(?:hour|hr|minute|min)s?/i);

  return match?.[1]?.trim() || match?.[0]?.replace(/^⏳\s*Duration:\s*/i, '').trim();
}

function extractSuburb(address: string): string {
  const suburbs = ['Melbourne', 'Carlton', 'Fitzroy', 'Collingwood', 'Richmond',
    'Southbank', 'St Kilda', 'South Yarra', 'Docklands', 'CBD', 'Brunswick',
    'Northcote', 'Prahran', 'South Melbourne', 'Port Melbourne'];
  return suburbs.find(s => address.includes(s)) || 'Melbourne';
}

function categoriseEvent(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (text.match(/\b(candlelight|concert|music|symphony|orchestra|jazz|rock|pop|band|classical|tribute)\b/)) return 'music';
  if (text.match(/\b(theatre|musical|play|opera|ballet|performance|show|dance)\b/)) return 'theatre';
  if (text.match(/\b(exhibition|gallery|art|museum|immersive|experience)\b/)) return 'arts';
  if (text.match(/\b(family|kids|children|interactive|workshop)\b/)) return 'family';
  if (text.match(/\b(sport|game|match|race|tournament)\b/)) return 'sports';

  return 'other';
}

function cleanText(text: string, maxLength: number): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\\r\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}