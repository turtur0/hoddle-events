import { load, CheerioAPI } from 'cheerio';
import { NormalisedEvent } from './types';
import { mapMarrinerCategory } from '../utils/category-mapper';

const BASE_URL = 'https://marrinergroup.com.au';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

interface RawShow {
  url: string;
  title: string;
  dateText: string;
  venue: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  bookingInfo?: string;
}

export interface ScrapeOptions {
  maxShows?: number;
  maxDetailFetches?: number;
  usePuppeteer?: boolean;
}

export async function scrapeMarrinerGroup(opts: ScrapeOptions = {}): Promise<NormalisedEvent[]> {
  console.log('[Marriner] Fetching show URLs');

  const urls = opts.usePuppeteer !== false ? await fetchShowUrls(opts.maxShows || 50) : [];
  console.log(`[Marriner] Found ${urls.length} unique show URLs`);

  const rawShows: RawShow[] = [];
  const fetchLimit = opts.maxDetailFetches || urls.length;

  for (let i = 0; i < Math.min(fetchLimit, urls.length); i++) {
    const raw = await fetchShowDetails(urls[i]);
    if (raw) {
      rawShows.push(raw);
      console.log(`[Marriner] Processed ${i + 1}/${Math.min(fetchLimit, urls.length)}: ${raw.title}`);
    }
    await delay(800);
  }

  const events = rawShows.map(toNormalisedEvent).filter((e): e is NormalisedEvent => e !== null);
  console.log(`[Marriner] Processed ${events.length} events`);
  return events;
}

async function fetchShowUrls(maxShows: number): Promise<string[]> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setUserAgent(HEADERS['User-Agent']);
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/shows`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);

  const urls = new Set<string>();
  let noChange = 0;
  let attempts = 0;

  console.log('[Marriner] Collecting show URLs');

  while (noChange < 4 && attempts < 20 && urls.size < maxShows * 2) {
    const prevSize = urls.size;
    
    const found = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/shows/"]'));
      return links
        .map(a => (a as HTMLAnchorElement).href)
        .filter(h => h.includes('/shows/') && h !== 'https://marrinergroup.com.au/shows');
    });

    found.forEach(url => urls.add(url));
    noChange = urls.size === prevSize ? noChange + 1 : 0;
    
    console.log(`[Marriner] Scroll ${attempts + 1}: ${urls.size} URLs found`);
    
    await page.evaluate(() => window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' }));
    await delay(2000);
    attempts++;
  }

  await browser.close();
  
  const uniqueShows = deduplicateBySlug(Array.from(urls));
  const result = uniqueShows.slice(0, maxShows);
  
  console.log(`[Marriner] Collected ${urls.size} URLs, ${uniqueShows.length} unique shows, taking ${result.length}`);
  return result;
}

function deduplicateBySlug(urls: string[]): string[] {
  const seenSlugs = new Map<string, string>();
  
  for (const url of urls) {
    const slug = extractShowSlug(url);
    if (slug && !seenSlugs.has(slug)) {
      seenSlugs.set(slug, url);
    }
  }
  
  return Array.from(seenSlugs.values());
}

function extractShowSlug(url: string): string {
  try {
    const path = new URL(url).pathname;
    const lastSegment = path.split('/').pop() || '';
    
    const cleaned = lastSegment
      .replace(/-\d{2,4}$/g, '')
      .replace(/-on-\d+.*$/g, '')
      .replace(/-\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*$/gi, '');
    
    return cleaned;
  } catch {
    return url;
  }
}

async function fetchShowDetails(url: string): Promise<RawShow | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;

    const $ = load(await res.text());
    const title = $('h1').first().text().trim();
    if (!title) return null;

    const dateText = $('.dates').first().text().trim();
    if (!dateText) return null;

    const venueText = $('h2').first().text().trim();
    const venue = extractVenueFromText(venueText) || extractVenueFromTitle(title);

    const descParagraphs = $('.description p').map((_, el) => $(el).text().trim()).get();
    const description = descParagraphs
      .filter(p => p.length > 0 && !p.startsWith('---'))
      .join('\n\n')
      .substring(0, 1500);

    const videoUrl = $('.videos iframe').first().attr('src');
    const bookingInfo = $('.info').text().trim().substring(0, 500);
    const imageUrl = extractImage($);

    return { url, title, dateText, venue, description, imageUrl, videoUrl, bookingInfo };
  } catch (err) {
    console.error(`[Marriner] Failed to fetch ${url}:`, err);
    return null;
  }
}

function extractVenueFromText(text: string): string | null {
  const match = text.match(/at\s+(?:the\s+)?(.+?),?\s*Melbourne/i);
  if (match) return match[1].trim();

  const venues = ['Princess Theatre', 'Comedy Theatre', 'Regent Theatre', 'Forum Melbourne'];
  for (const v of venues) {
    if (text.toLowerCase().includes(v.toLowerCase())) return v;
  }
  return null;
}

function extractVenueFromTitle(title: string): string {
  const venues = ['Princess Theatre', 'Comedy Theatre', 'Regent Theatre', 'Forum Melbourne'];
  for (const v of venues) {
    if (title.toLowerCase().includes(v.toLowerCase())) return v;
  }
  return 'Marriner Venue';
}

function extractImage($: CheerioAPI): string | undefined {
  let img = $('meta[property="og:image"]').attr('content');
  
  if (!img) {
    const contentImgs = $('img').toArray();
    for (const el of contentImgs) {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt') || '';
      if (!src.includes('logo') && !src.includes('icon') && !alt.toLowerCase().includes('logo')) {
        img = src;
        break;
      }
    }
  }
  
  if (img && !img.startsWith('http')) {
    img = `${BASE_URL}${img.startsWith('/') ? '' : '/'}${img}`;
  }
  
  return img;
}

function toNormalisedEvent(raw: RawShow): NormalisedEvent | null {
  const dates = parseDateRange(raw.dateText);
  if (!dates.startDate) return null;

  const { category, subcategory } = mapMarrinerCategory(raw.title, raw.venue);

  return {
    title: raw.title,
    description: raw.description || raw.title,
    category,
    subcategory,
    startDate: dates.startDate,
    endDate: dates.endDate,
    venue: { 
      name: raw.venue, 
      address: getVenueAddress(raw.venue), 
      suburb: 'Melbourne' 
    },
    isFree: false,
    bookingUrl: raw.url,
    imageUrl: raw.imageUrl,
    videoUrl: raw.videoUrl,
    source: 'marriner',
    sourceId: slugify(raw.title),
    scrapedAt: new Date(),
    lastUpdated: new Date(),
  };
}

function getVenueAddress(venue: string): string {
  const addrs: Record<string, string> = {
    'Princess Theatre': '163 Spring St, Melbourne VIC 3000',
    'Regent Theatre': '191 Collins St, Melbourne VIC 3000',
    'Comedy Theatre': '240 Exhibition St, Melbourne VIC 3000',
    'Forum Melbourne': '154 Flinders St, Melbourne VIC 3000',
  };
  return addrs[venue] || 'Melbourne CBD';
}

function parseDateRange(text: string): { startDate: Date | null; endDate?: Date } {
  if (!text || text === 'TBA') return { startDate: null };

  const year = new Date().getFullYear();
  const next = year + 1;

  if (text.includes('&')) {
    const [first, rest] = text.split('&').map(s => s.trim());
    if (/^\d{1,2}$/.test(first) && rest) {
      const tokens = rest.split(/\s+/);
      if (tokens.length >= 3) {
        const [day, month, yr] = [tokens[0], tokens[1], tokens[2]];
        return {
          startDate: parseDate(`${first} ${month} ${yr}`, year, next),
          endDate: parseDate(`${day} ${month} ${yr}`, year, next) ?? undefined,
        };
      }
    }
  }

  const parts = text.split(/\s*[—–\-]\s*/).map(s => s.trim());
  const start = parseDate(parts[0], year, next);
  const end = parts[1] ? parseDate(parts[1], year, next) : undefined;
  return { startDate: start, endDate: end ?? undefined };
}

function parseDate(str: string, year: number, next: number): Date | null {
  if (!str) return null;
  
  let d = new Date(str);
  if (isNaN(d.getTime()) && !str.match(/\d{4}/)) {
    d = new Date(`${str} ${year}`);
    if (d < new Date()) d = new Date(`${str} ${next}`);
  }
  
  return isNaN(d.getTime()) ? null : d;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}