// ============================================
// whatson.ts - Enhanced What's On Melbourne Scraper
// Extracts prices, accessibility, duration, and more
// Fixed pagination to get all results
// ============================================

import { load, CheerioAPI } from 'cheerio';
import { NormalisedEvent } from './types';
import { mapWhatsOnCategory } from '../utils/category-mapper';

const BASE_URL = 'https://whatson.melbourne.vic.gov.au';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
};

interface RawEvent {
    url: string;
    title: string;
    description?: string;
    venue?: string;
    address?: string;
    startDate?: Date;
    endDate?: Date;
    priceMin?: number;
    priceMax?: number;
    priceDetails?: string;
    isFree: boolean;
    imageUrl?: string;
    accessibility?: string[];
    duration?: string;
}

export interface WhatsOnScrapeOptions {
    categories?: string[];
    maxPages?: number;
    maxEventsPerCategory?: number;
}

export async function scrapeWhatsOnMelbourne(opts: WhatsOnScrapeOptions = {}): Promise<NormalisedEvent[]> {
    const categories = opts.categories || ['theatre', 'music'];
    const allEvents: NormalisedEvent[] = [];
    const seenTitles = new Set<string>(); // Track duplicates across categories

    console.log(`🎭 Scraping What's On: ${categories.join(', ')}`);

    for (const category of categories) {
        console.log(`\n📂 ${category}`);
        const urls = await collectEventUrls(category, opts.maxPages || 10);
        console.log(`   Found ${urls.length} URLs`);

        const limit = opts.maxEventsPerCategory || urls.length;
        let processedCount = 0;
        
        for (let i = 0; i < urls.length && processedCount < limit; i++) {
            const raw = await fetchEventDetails(urls[i]);
            if (raw) {
                // Skip if we've already seen this event (from another category)
                const titleKey = raw.title.toLowerCase().trim();
                if (seenTitles.has(titleKey)) {
                    console.log(`   ⊘ Skipping duplicate: ${raw.title}`);
                    continue;
                }
                
                const event = toNormalisedEvent(raw, category);
                if (event) {
                    allEvents.push(event);
                    seenTitles.add(titleKey);
                    processedCount++;
                    console.log(`   ✓ ${processedCount}/${limit}: ${event.title}`);
                }
            }
            if (i < urls.length - 1) await delay(800);
        }
    }

    console.log(`\n✅ Total: ${allEvents.length} unique events`);
    return allEvents;
}

/**
 * Collect event URLs with proper pagination handling
 * Filters out non-event pages (articles, businesses, category pages)
 */
async function collectEventUrls(category: string, maxPages: number): Promise<string[]> {
    const urls = new Set<string>();
    let consecutiveEmptyPages = 0;

    for (let page = 1; page <= maxPages; page++) {
        try {
            const pageUrl = `${BASE_URL}/tags/${category}${page > 1 ? `/page-${page}` : ''}`;
            const res = await fetch(pageUrl, { headers: HEADERS });

            if (!res.ok) {
                console.log(`   Page ${page}: Failed (${res.status})`);
                break;
            }

            const $ = load(await res.text());
            const prevSize = urls.size;

            // The data-listing-type attribute has escaped quotes in the HTML
            // So we need to check the attribute value which contains the quotes
            $('.page-preview').each((_, el) => {
                const listingType = $(el).attr('data-listing-type');

                // The attribute value is actually '"event"' with quotes included
                if (listingType && listingType.includes('event')) {
                    const link = $(el).find('a.main-link');
                    const href = link.attr('href');

                    if (href &&
                        href.includes('/things-to-do/') &&
                        !href.includes('/tags/') &&
                        !href.includes('/search') &&
                        !href.includes('/article/') &&
                        !href.includes('/shop/')) {
                        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                        urls.add(fullUrl);
                    }
                }
            });

            const newUrlsCount = urls.size - prevSize;
            console.log(`   Page ${page}: +${newUrlsCount} URLs (${urls.size} total)`);

            // If we got no new URLs, increment counter
            if (newUrlsCount === 0) {
                consecutiveEmptyPages++;
                // Stop if we've seen 2 consecutive pages with no new URLs
                if (consecutiveEmptyPages >= 2) {
                    console.log(`   Stopping: ${consecutiveEmptyPages} consecutive empty pages`);
                    break;
                }
            } else {
                consecutiveEmptyPages = 0; // Reset counter when we find URLs
            }

            // Check if there's a "next" page button
            const hasNextPage = $('.pagination a[rel="next"]').length > 0 ||
                $('.pagination .next').length > 0;

            if (!hasNextPage && page > 1) {
                console.log(`   No more pages available`);
                break;
            }

            await delay(800);
        } catch (err) {
            console.error(`   Page ${page} error:`, err);
            break;
        }
    }

    return Array.from(urls);
}

async function fetchEventDetails(url: string): Promise<RawEvent | null> {
    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) {
            console.error(`   ❌ Failed to fetch ${url}: HTTP ${res.status}`);
            return null;
        }

        const $ = load(await res.text());
        const title = $('h1').first().text().trim();
        if (!title) {
            console.error(`   ❌ No title found for ${url}`);
            return null;
        }

        return {
            url,
            title,
            description: extractDescription($),
            venue: extractVenue($),
            address: extractAddress($),
            ...extractDates($),
            ...extractPrices($),
            imageUrl: extractImage($),
            accessibility: extractAccessibility($),
            duration: extractDuration($),
        };
    } catch (err) {
        console.error(`   ❌ Failed to fetch ${url}:`, err);
        return null;
    }
}

function extractDescription($: CheerioAPI): string {
    return $('meta[name="description"]').attr('content')?.trim() ||
        $('meta[property="og:description"]').attr('content')?.trim() ||
        $('.listing-description .contents').text().trim().substring(0, 500) ||
        'No description available';
}

function extractVenue($: CheerioAPI): string {
    const locationWidget = $('.location.details-widget p').first().text().trim();
    if (locationWidget) return locationWidget.split('\n')[0].trim();
    return $('[class*="venue"]').first().text().trim().split('\n')[0] || 'Venue TBA';
}

function extractAddress($: CheerioAPI): string {
    const lines = $('.location.details-widget p').text().trim().split('\n').map(l => l.trim()).filter(Boolean);
    return lines.slice(1).join(', ') || 'Melbourne VIC';
}

function extractDates($: CheerioAPI): { startDate?: Date; endDate?: Date } {
    const times = $('time[datetime]').map((_, el) => {
        const dt = $(el).attr('datetime');
        return dt ? new Date(dt) : null;
    }).get().filter((d): d is Date => d !== null && !isNaN(d.getTime()));

    if (times.length > 0) {
        times.sort((a, b) => a.getTime() - b.getTime());
        return { startDate: times[0], endDate: times.length > 1 ? times[times.length - 1] : undefined };
    }
    return {};
}

function extractPrices($: CheerioAPI): { priceMin?: number; priceMax?: number; priceDetails?: string; isFree: boolean } {
    const widget = $('.price-and-bookings').text();
    const isFree = /\bfree\b/i.test(widget);
    if (isFree) return { priceMin: 0, priceMax: 0, isFree: true };

    // Extract price range (e.g., "From $78 to $209.05")
    const rangeMatch = widget.match(/From\s*\$(\d+(?:\.\d+)?)\s*to\s*\$(\d+(?:\.\d+)?)/i);
    if (rangeMatch) {
        return {
            priceMin: parseFloat(rangeMatch[1]),
            priceMax: parseFloat(rangeMatch[2]),
            priceDetails: extractPriceTable($),
            isFree: false,
        };
    }

    // Extract individual prices
    const prices = widget.match(/\$(\d+(?:\.\d+)?)/g)?.map(p => parseFloat(p.replace('$', ''))).filter(p => p > 0) || [];
    if (prices.length > 0) {
        return {
            priceMin: Math.min(...prices),
            priceMax: prices.length > 1 ? Math.max(...prices) : undefined,
            priceDetails: extractPriceTable($),
            isFree: false,
        };
    }

    return { isFree: false };
}

function extractPriceTable($: CheerioAPI): string | undefined {
    const rows = $('.price-table tr td').map((_, el) => $(el).text().trim()).get();
    return rows.length > 0 ? rows.join('; ') : undefined;
}

function extractImage($: CheerioAPI): string | undefined {
    const img = $('meta[property="og:image"]').attr('content') ||
        $('.carousel-item img').first().attr('src');
    return img?.startsWith('http') ? img : img ? `${BASE_URL}${img}` : undefined;
}

function extractAccessibility($: CheerioAPI): string[] {
    return $('.accessibility-feature__link').map((_, el) => $(el).text().trim()).get();
}

function extractDuration($: CheerioAPI): string | undefined {
    const times = $('#date-times-table tbody tr:first-child td li span[aria-hidden="true"]').first().text().trim();
    if (times && times.includes('-')) {
        const [start, end] = times.split('-').map(t => t.trim());
        // Could calculate duration from times if needed
    }
    return undefined;
}

function toNormalisedEvent(raw: RawEvent, categoryTag: string): NormalisedEvent | null {
    if (!raw.startDate) {
        console.log(`   ⚠️  Skipping "${raw.title}" - no start date`);
        return null;
    }

    const { category, subcategory } = mapWhatsOnCategory(categoryTag, raw.title);
    const suburb = extractSuburb(raw.address || '');

    return {
        title: raw.title,
        description: raw.description || 'No description available',
        category,
        subcategory,
        startDate: raw.startDate,
        endDate: raw.endDate,
        venue: { name: raw.venue || 'Venue TBA', address: raw.address || 'Melbourne VIC', suburb },
        priceMin: raw.priceMin,
        priceMax: raw.priceMax,
        priceDetails: raw.priceDetails,
        isFree: raw.isFree,
        bookingUrl: raw.url,
        imageUrl: raw.imageUrl,
        accessibility: raw.accessibility,
        source: 'whatson',
        sourceId: slugify(raw.title),
        scrapedAt: new Date(),
        lastUpdated: new Date(),
    };
}

function extractSuburb(address: string): string {
    const suburbs = ['Melbourne', 'Carlton', 'Fitzroy', 'Collingwood', 'Richmond', 'Southbank', 'St Kilda', 'South Yarra', 'Docklands'];
    for (const s of suburbs) if (address.includes(s)) return s;
    return 'Melbourne';
}

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }