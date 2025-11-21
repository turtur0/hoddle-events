import { load } from 'cheerio';
import { NormalisedEvent } from './types';

const BASE_URL = 'https://marrinergroup.com.au';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' };

interface RawShow {
    url: string;
    title: string;
    dateText: string;
    venue: string;
    description?: string;
    imageUrl?: string;
}

export interface ScrapeOptions {
    maxShows?: number;
    maxDetailFetches?: number;
    usePuppeteer?: boolean;
}

/**
 * Main scraper
 */
export async function scrapeMarrinerGroup(opts: ScrapeOptions = {}): Promise<NormalisedEvent[]> {
    console.log('🎭 Scraping Marriner Group (/shows hybrid)...');

    // Step 1: Puppeteer to get all show URLs
    const showUrls = opts.usePuppeteer !== false
        ? await fetchShowUrls(opts.maxShows || 50)
        : [];

    console.log(`📦 Found ${showUrls.length} show URLs`);

    // Step 2: Fetch each show page with Cheerio
    const rawShows: RawShow[] = [];
    const fetchLimit = Math.min(opts.maxDetailFetches || showUrls.length, showUrls.length);
    
    console.log(`🔍 Fetching details for ${fetchLimit} shows...`);
    
    for (let i = 0; i < fetchLimit; i++) {
        console.log(`  Fetching ${i + 1}/${fetchLimit}: ${showUrls[i]}`);
        const raw = await fetchShowDetails(showUrls[i]);
        if (raw) rawShows.push(raw);
        await new Promise(r => setTimeout(r, 800));
    }

    // Step 3: Convert to NormalisedEvent
    const events = rawShows
        .map(toNormalisedEvent)
        .filter((e): e is NormalisedEvent => e !== null);

    console.log(`✅ Total upcoming events: ${events.length}`);
    return events;
}

/**
 * Puppeteer fetch of /shows URLs
 */
async function fetchShowUrls(maxShows: number): Promise<string[]> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent(HEADERS['User-Agent']);
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('🌐 Loading /shows page...');
    await page.goto(`${BASE_URL}/shows`, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
    });

    await new Promise(r => setTimeout(r, 2000));

    const urls = new Set<string>();
    let consecutiveNoChange = 0;
    const maxScrollAttempts = 20;
    let scrollAttempts = 0;

    console.log('📜 Scrolling to load all shows...');

    while (consecutiveNoChange < 4 && scrollAttempts < maxScrollAttempts) {
        const prevSize = urls.size;

        const newUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/shows/"]'));
            return links
                .map(a => (a as HTMLAnchorElement).href)
                .filter(href => {
                    const path = href.replace('https://marrinergroup.com.au', '');
                    return path.startsWith('/shows/') && path.length > '/shows/'.length;
                });
        });

        newUrls.forEach(url => urls.add(url));

        console.log(`  Scroll ${scrollAttempts + 1}: Found ${urls.size} unique shows (${newUrls.length} new)`);

        if (urls.size === prevSize) {
            consecutiveNoChange++;
        } else {
            consecutiveNoChange = 0;
        }

        await page.evaluate(() => {
            window.scrollBy({
                top: window.innerHeight * 0.8,
                behavior: 'smooth'
            });
        });

        await new Promise(r => setTimeout(r, 2000));
        scrollAttempts++;

        if (maxShows && urls.size >= maxShows) {
            console.log(`  Reached maxShows limit (${maxShows})`);
            break;
        }
    }

    await browser.close();

    const urlArray = Array.from(urls);
    console.log(`✅ Collected ${urlArray.length} total show URLs`);
    
    return maxShows ? urlArray.slice(0, maxShows) : urlArray;
}

/**
 * Fetch individual show page details
 */
async function fetchShowDetails(url: string): Promise<RawShow | null> {
    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) {
            console.warn(`  ⚠️  Failed to fetch ${url}: ${res.status}`);
            return null;
        }
        
        const html = await res.text();
        const $ = load(html);

        // Extract title (h1 is most reliable)
        const title = $('h1').first().text().trim();
        if (!title) {
            console.warn(`  ⚠️  No title found for ${url}`);
            return null;
        }

        // Extract date (.dates class is consistent)
        const dateText = $('.dates').first().text().trim();
        if (!dateText) {
            console.warn(`  ⚠️  No date found for ${url}`);
            return null;
        }

        // Extract venue (.location class is consistent)
        const venue = $('.location').first().text().trim() || 
                     extractVenueFromTitle(title);

        // Extract description (meta description is best)
        const description = $('meta[name="description"]').attr('content')?.trim() ||
                          title;

        // Extract image (look for show images, excluding logos)
        let imageUrl: string | undefined;
        
        // Try og:image first
        imageUrl = $('meta[property="og:image"]').attr('content');
        
        // If no og:image, look for images in content area
        if (!imageUrl) {
            const contentImages = $('img').toArray();
            for (const img of contentImages) {
                const src = $(img).attr('src') || '';
                const alt = $(img).attr('alt') || '';
                
                // Skip logos, icons, and navigation images
                if (!src.includes('logo') && 
                    !src.includes('icon') && 
                    !src.includes('nav') &&
                    !alt.toLowerCase().includes('logo')) {
                    imageUrl = src;
                    break;
                }
            }
        }
        
        // Convert relative URLs to absolute
        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = imageUrl.startsWith('/') 
                ? `${BASE_URL}${imageUrl}` 
                : `${BASE_URL}/${imageUrl}`;
        }

        return { 
            url, 
            title, 
            dateText, 
            venue, 
            description,
            imageUrl
        };
    } catch (err) {
        console.error(`  ❌ Error fetching ${url}:`, err);
        return null;
    }
}

/**
 * Extract venue from title (fallback)
 */
function extractVenueFromTitle(title: string): string {
    const venues = ['Princess Theatre', 'Comedy Theatre', 'Regent Theatre', 'Forum Melbourne'];
    for (const venue of venues) {
        if (title.toLowerCase().includes(venue.toLowerCase())) {
            return venue;
        }
    }
    return 'Marriner Venue';
}

/**
 * Map Marriner shows to category/subcategory
 */
function mapMarrinerCategory(title: string, venue: string): { category: string; subcategory?: string } {
    const combined = `${title} ${venue}`.toLowerCase();

    // Opera
    if (combined.includes('opera')) {
        return { category: 'theatre', subcategory: 'Opera' };
    }

    // Musicals
    if (combined.includes('musical') || 
        /christmas carol|anastasia|wicked|hamilton/i.test(title)) {
        return { category: 'theatre', subcategory: 'Musicals' };
    }

    // Ballet/Dance
    if (combined.includes('ballet') || combined.includes('dance')) {
        return { category: 'theatre', subcategory: 'Ballet & Dance' };
    }

    // Comedy
    if (combined.includes('comedy')) {
        return { category: 'theatre', subcategory: 'Comedy Shows' };
    }

    // Music concerts (Forum Melbourne is primarily a music venue)
    if (venue === 'Forum Melbourne' && 
        !combined.includes('opera') && 
        !combined.includes('theatre')) {
        return { category: 'music', subcategory: undefined };
    }

    // Default to theatre for Princess/Regent/Comedy theatres
    return { category: 'theatre', subcategory: undefined };
}

/**
 * Convert RawShow → NormalisedEvent
 */
function toNormalisedEvent(raw: RawShow): NormalisedEvent | null {
    const dates = parseDateRange(raw.dateText);
    if (!dates.startDate) {
        console.warn(`  ⚠️  Could not parse date: "${raw.dateText}"`);
        return null;
    }

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
        
        priceMin: undefined,
        priceMax: undefined,
        isFree: false,
        
        bookingUrl: raw.url,
        imageUrl: raw.imageUrl,
        
        source: 'marriner',
        sourceId: slugify(raw.title),
        scrapedAt: new Date(),
        lastUpdated: new Date(),
    };
}

/**
 * Get venue address
 */
function getVenueAddress(venueName: string): string {
    const addresses: Record<string, string> = {
        'Princess Theatre': '163 Spring St, Melbourne VIC 3000',
        'Regent Theatre': '191 Collins St, Melbourne VIC 3000',
        'Comedy Theatre': '240 Exhibition St, Melbourne VIC 3000',
        'Forum Melbourne': '154 Flinders St, Melbourne VIC 3000',
    };
    return addresses[venueName] || 'Melbourne CBD';
}

/**
 * Parse date range from text
 * Examples: "15 Nov 2025 — 25 Nov 2025", "21 Nov 2025", "22 & 23 Nov 2025", "24 & 27 Nov 2025"
 */
function parseDateRange(text: string): { startDate: Date | null; endDate?: Date } {
    if (!text || text === 'TBA') return { startDate: null };
    
    const year = new Date().getFullYear();
    const nextYear = year + 1;
    
    // Handle "&" separator (e.g., "22 & 23 Nov 2025")
    if (text.includes('&')) {
        const parts = text.split('&').map(p => p.trim());
        
        // Check if first part is just a day number (e.g., "22")
        // and second part has the full date info (e.g., "23 Nov 2025")
        if (/^\d{1,2}$/.test(parts[0]) && parts[1]) {
            const firstDay = parts[0];
            const secondPart = parts[1].trim();
            
            // Extract month and year from second part
            const secondTokens = secondPart.split(/\s+/);
            if (secondTokens.length >= 3) {
                // secondTokens = ["23", "Nov", "2025"]
                const secondDay = secondTokens[0];
                const month = secondTokens[1];
                const yearStr = secondTokens[2];
                
                // Construct both dates
                const firstDateStr = `${firstDay} ${month} ${yearStr}`;
                const secondDateStr = `${secondDay} ${month} ${yearStr}`;
                
                const firstDate = parseDate(firstDateStr, parseInt(yearStr), parseInt(yearStr) + 1);
                const secondDate = parseDate(secondDateStr, parseInt(yearStr), parseInt(yearStr) + 1);
                
                return { startDate: firstDate, endDate: secondDate ?? undefined };
            }
        }
        
        // Fallback: try parsing both parts as complete dates
        const firstDate = parseDate(parts[0], year, nextYear);
        const secondDate = parseDate(parts[1], year, nextYear);
        return { startDate: firstDate, endDate: secondDate ?? undefined };
    }
    
    // Handle em dash or hyphen separator
    const parts = text.split(/\s*[—–\-]\s*/).map(p => p.trim());
    const startDate = parseDate(parts[0], year, nextYear);
    const endDate = parts[1] ? parseDate(parts[1], year, nextYear) : undefined;
    
    return { startDate, endDate: endDate ?? undefined };
}

/**
 * Parse single date string
 */
function parseDate(dateStr: string, currentYear: number, nextYear: number): Date | null {
    if (!dateStr) return null;
    
    let d = new Date(dateStr);
    
    // If parsing failed and no year present, try adding year
    if (isNaN(d.getTime()) && !dateStr.match(/\d{4}/)) {
        d = new Date(`${dateStr} ${currentYear}`);
        
        // If date is in the past, try next year
        if (d < new Date()) {
            d = new Date(`${dateStr} ${nextYear}`);
        }
    }
    
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Create URL-safe slug
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}