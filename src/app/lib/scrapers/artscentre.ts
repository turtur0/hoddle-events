import puppeteer, { Page } from 'puppeteer';
import { NormalisedEvent } from '../types';

const ARTS_CENTRE_URL = 'https://www.artscentremelbourne.com.au/whats-on/event-calendar';

interface ArtsEventRaw {
    title: string;
    url: string;
    genre: string;
    time?: string;
    venue: string;
    imageUrl?: string;
    date: string; // Section heading like "Today", "Tomorrow", "Friday 21st November"
}

export async function scrapeArtsCentre(): Promise<NormalisedEvent[]> {
    console.log('Scraping Arts Centre Melbourne...');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // Set realistic browser properties
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log('   Navigating to Arts Centre...');
        await page.goto(ARTS_CENTRE_URL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for event tiles to load
        await page.waitForSelector('.event-tile', { timeout: 10000 });

        // Optional: Click "Load More" button if you want all events
        // await clickLoadMore(page);

        console.log('   Extracting events...');

        // Extract all event data from the page
        const events: ArtsEventRaw[] = await page.evaluate(() => {
            const results: ArtsEventRaw[] = [];

            // Find all event sections (Today, Tomorrow, etc.)
            const sections = document.querySelectorAll('.event-section');

            sections.forEach(section => {
                // Get the date heading for this section
                const dateHeadingEl = section.querySelector('.section-title, h2, h3');
                const dateHeading = dateHeadingEl?.textContent?.trim() || '';

                // Find all event tiles in this section
                const tiles = section.querySelectorAll('.event-tile');

                tiles.forEach(tile => {
                    // Extract title and URL
                    const titleLink = tile.querySelector('.title a, .event-tile__info a, h3 a, h2 a');
                    const title = titleLink?.textContent?.trim() || '';
                    const url = (titleLink as HTMLAnchorElement)?.href || '';

                    // Extract genre/category
                    const genreEl = tile.querySelector('.genre, .event-genre, .category');
                    const genre = genreEl?.textContent?.trim() || '';

                    // Extract time
                    const timeEl = tile.querySelector('.time, .event-time, time');
                    const time = timeEl?.textContent?.trim();

                    // Extract venue
                    const venueEl = tile.querySelector('.venue, .event-venue, .venue span');
                    const venue = venueEl?.textContent?.trim() || 'Arts Centre Melbourne';

                    // Extract image
                    const imgEl = tile.querySelector('img, .event-tile__img img');
                    let imageUrl = (imgEl as HTMLImageElement)?.src || '';

                    // Ensure full URL for image
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = `https://www.artscentremelbourne.com.au${imageUrl}`;
                    }

                    // Only add if we have minimum required data
                    if (title && url) {
                        results.push({
                            title,
                            url,
                            genre,
                            time,
                            venue,
                            imageUrl: imageUrl || undefined,
                            date: dateHeading,
                        });
                    }
                });
            });

            return results;
        });

        console.log(`   Found ${events.length} raw events`);

        await browser.close();

        // Normalize events
        const normalized = events.map(event => normalizeArtsEvent(event));

        // Filter out past events and invalid ones
        const now = new Date();
        const upcoming = normalized.filter(e => e.startDate >= now);

        console.log(`   Returning ${upcoming.length} upcoming events`);
        return upcoming;

    } catch (error) {
        console.error('Arts Centre scraping error:', error);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

/**
 * Optional: Click "Load More" button to get all events
 */
async function clickLoadMore(page: Page): Promise<void> {
    try {
        const loadMoreButton = await page.$('.load-more-events');
        if (loadMoreButton) {
            console.log('   Clicking "Load More" button...');
            await loadMoreButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for new events to load
        }
    } catch (error) {
        console.log('   No "Load More" button found or already loaded all events');
    }
}

function normalizeArtsEvent(raw: ArtsEventRaw): NormalisedEvent {
    // Parse the date from section heading
    const startDate = parseDateHeading(raw.date, raw.time);

    // Map genre to our categories
    const category = mapGenreToCategory(raw.genre);

    // Extract venue info
    const venueInfo = {
        name: raw.venue || 'Arts Centre Melbourne',
        address: '100 St Kilda Road',
        suburb: 'Melbourne',
    };

    // Extract event ID from URL (include date for uniqueness)
    const sourceId = extractEventId(raw.url, startDate);

    return {
        title: raw.title,
        description: raw.genre ? `${raw.genre} at Arts Centre Melbourne` : undefined,
        category,
        subcategory: raw.genre || undefined,

        startDate,
        endDate: undefined,

        venue: venueInfo,

        priceMin: undefined, // Would need detailed page scraping
        priceMax: undefined,
        isFree: false, // Arts Centre events are typically paid

        bookingUrl: raw.url,
        imageUrl: raw.imageUrl,

        source: 'artscentre',
        sourceId,
        scrapedAt: new Date(),
    };
}

function parseDateHeading(heading: string, time?: string): Date {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Handle relative dates
    if (heading.toLowerCase() === 'today') {
        return parseTime(today, time);
    }

    if (heading.toLowerCase() === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return parseTime(tomorrow, time);
    }

    // Parse formatted dates like "Friday 21st November"
    // Remove day name and ordinal suffixes
    const dateStr = heading
        .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*/i, '')
        .replace(/(\d+)(st|nd|rd|th)/g, '$1');

    try {
        // Try to parse the date
        const parsed = new Date(`${dateStr} ${now.getFullYear()}`);

        // If the parsed date is in the past, it must be next year
        if (parsed < today) {
            parsed.setFullYear(now.getFullYear() + 1);
        }

        return parseTime(parsed, time);
    } catch {
        // Fallback to today if parsing fails
        return today;
    }
}

function parseTime(date: Date, timeStr?: string): Date {
    if (!timeStr) return date;

    // Extract first time if multiple times (e.g., "2:00 PM & 7:30 PM")
    const firstTime = timeStr.split('&')[0].trim();

    // Parse time like "7:30 PM"
    const match = firstTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return date;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const meridiem = match[3].toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}

function mapGenreToCategory(genre: string): string {
    const genreLower = genre.toLowerCase();

    if (genreLower.includes('theatre') || genreLower.includes('drama')) return 'theatre';
    if (genreLower.includes('music') || genreLower.includes('orchestra') || genreLower.includes('classical')) return 'music';
    if (genreLower.includes('dance') || genreLower.includes('ballet')) return 'arts';
    if (genreLower.includes('comedy')) return 'arts';
    if (genreLower.includes('opera')) return 'theatre';
    if (genreLower.includes('musical')) return 'theatre';
    if (genreLower.includes('circus') || genreLower.includes('magic')) return 'arts';
    if (genreLower.includes('kids') || genreLower.includes('family')) return 'family';
    if (genreLower.includes('tour') || genreLower.includes('exhibition')) return 'arts';
    if (genreLower.includes('talks') || genreLower.includes('ideas')) return 'arts';

    return 'other';
}

function extractEventId(url: string, date: Date): string {
    // Extract unique ID from URL like "/whats-on/2025/theatre/the-talented-mr-ripley"
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const parts = pathname.split('/').filter(Boolean);
        const slug = parts[parts.length - 1] || 'unknown';

        // Add date and time to make it unique (same event can have multiple showtimes)
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = date.toTimeString().substring(0, 5).replace(':', ''); // HHMM

        return `${slug}-${dateStr}-${timeStr}`;
    } catch {
        // Fallback: use timestamp
        return `event-${Date.now()}`;
    }
}