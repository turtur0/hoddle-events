import { scrapeArtsCentre } from "@/app/lib/scrapers/artscentre";

describe('Arts Centre Scraper (Puppeteer)', () => {
    // Increase timeout for Puppeteer operations (browser launch + scraping)
    jest.setTimeout(60000); // 60 seconds for browser operations

    it('should scrape events from Arts Centre Melbourne', async () => {
        const events = await scrapeArtsCentre();

        // Basic assertions
        expect(events).toBeDefined();
        expect(Array.isArray(events)).toBe(true);
        expect(events.length).toBeGreaterThan(0);

        console.log(`\n Scraped ${events.length} events from Arts Centre`);
        console.log(`Sample events:`);
        events.slice(0, 3).forEach((event, i) => {
            console.log(`   ${i + 1}. ${event.title} - ${event.category}/${event.subcategory}`);
        });
    });

    it('should return events with required fields', async () => {
        const events = await scrapeArtsCentre();

        // Ensure we have events to test
        expect(events.length).toBeGreaterThan(0);

        // Take first event to check structure
        const firstEvent = events[0];

        // Required fields
        expect(firstEvent).toHaveProperty('title');
        expect(firstEvent.title).toBeTruthy();
        expect(typeof firstEvent.title).toBe('string');

        expect(firstEvent).toHaveProperty('category');
        expect(firstEvent.category).toBeTruthy();

        expect(firstEvent).toHaveProperty('startDate');
        expect(firstEvent.startDate).toBeInstanceOf(Date);

        expect(firstEvent).toHaveProperty('venue');
        expect(firstEvent.venue).toBeDefined();
        expect(firstEvent.venue.name).toBeTruthy();

        expect(firstEvent).toHaveProperty('bookingUrl');
        expect(firstEvent.bookingUrl).toBeTruthy();

        expect(firstEvent).toHaveProperty('source', 'artscentre');

        expect(firstEvent).toHaveProperty('sourceId');
        expect(firstEvent.sourceId).toBeTruthy();

        expect(firstEvent).toHaveProperty('isFree');
        expect(typeof firstEvent.isFree).toBe('boolean');

        expect(firstEvent).toHaveProperty('scrapedAt');
        expect(firstEvent.scrapedAt).toBeInstanceOf(Date);

        console.log('\n First event structure:');
        console.log({
            title: firstEvent.title,
            category: firstEvent.category,
            subcategory: firstEvent.subcategory,
            date: firstEvent.startDate.toISOString(),
            venue: firstEvent.venue.name,
            bookingUrl: firstEvent.bookingUrl.substring(0, 60) + '...',
            hasImage: !!firstEvent.imageUrl,
        });
    });

    it('should have valid venue information', async () => {
        const events = await scrapeArtsCentre();

        expect(events.length).toBeGreaterThan(0);

        events.forEach(event => {
            expect(event.venue).toBeDefined();
            expect(event.venue.name).toBeTruthy();
            expect(typeof event.venue.name).toBe('string');

            // Check that venue has proper structure
            expect(event.venue).toHaveProperty('name');
            expect(event.venue).toHaveProperty('address');
            expect(event.venue).toHaveProperty('suburb');

            // Arts Centre events should be in Melbourne
            expect(event.venue.suburb).toBe('Melbourne');
        });

        console.log(`\n All ${events.length} events have valid venue information`);
    });

    it('should have valid dates (not in the past)', async () => {
        const events = await scrapeArtsCentre();
        const now = new Date();
        // Allow events from start of today
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        expect(events.length).toBeGreaterThan(0);

        events.forEach(event => {
            expect(event.startDate).toBeInstanceOf(Date);
            expect(event.startDate.getTime()).toBeGreaterThanOrEqual(startOfToday.getTime());
        });

        console.log(`\n All ${events.length} events are upcoming or today`);

        // Show date range
        const dates = events.map(e => e.startDate);
        const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
        const latest = new Date(Math.max(...dates.map(d => d.getTime())));

        console.log(`   Date range: ${earliest.toLocaleDateString()} to ${latest.toLocaleDateString()}`);
    });

    it('should have valid booking URLs', async () => {
        const events = await scrapeArtsCentre();

        expect(events.length).toBeGreaterThan(0);

        events.forEach(event => {
            expect(event.bookingUrl).toBeTruthy();
            expect(event.bookingUrl).toMatch(/^https?:\/\//);
            expect(event.bookingUrl).toContain('artscentremelbourne.com.au');
        });

        console.log(`\n All ${events.length} events have valid booking URLs`);
    });

    it('should map genres to categories correctly', async () => {
        const events = await scrapeArtsCentre();

        const validCategories = ['music', 'theatre', 'sports', 'arts', 'family', 'other'];

        expect(events.length).toBeGreaterThan(0);

        events.forEach(event => {
            expect(validCategories).toContain(event.category);
        });

        // Show category distribution
        const categoryCount: Record<string, number> = {};
        events.forEach(event => {
            categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
        });

        console.log('\n Category distribution:');
        Object.entries(categoryCount).forEach(([category, count]) => {
            console.log(`   ${category}: ${count} events`);
        });
    });

    it('should have unique source IDs', async () => {
        const events = await scrapeArtsCentre();

        expect(events.length).toBeGreaterThan(0);

        const sourceIds = events.map(e => e.sourceId);
        const uniqueIds = new Set(sourceIds);

        expect(uniqueIds.size).toBe(sourceIds.length);

        console.log(`\n All ${events.length} events have unique source IDs`);
    });

    it('should extract event images when available', async () => {
        const events = await scrapeArtsCentre();

        expect(events.length).toBeGreaterThan(0);

        const eventsWithImages = events.filter(e => e.imageUrl);
        const imagePercentage = (eventsWithImages.length / events.length * 100).toFixed(1);

        console.log(`\n ${eventsWithImages.length}/${events.length} events (${imagePercentage}%) have images`);

        // Check that images have valid URLs
        eventsWithImages.forEach(event => {
            expect(event.imageUrl).toMatch(/^https?:\/\//);
        });
    });

    it('should handle subcategories when present', async () => {
        const events = await scrapeArtsCentre();

        expect(events.length).toBeGreaterThan(0);

        const eventsWithSubcategory = events.filter(e => e.subcategory);

        console.log(`\n ${eventsWithSubcategory.length}/${events.length} events have subcategories`);

        if (eventsWithSubcategory.length > 0) {
            const subcategories = new Set(eventsWithSubcategory.map(e => e.subcategory));
            console.log(`   Unique subcategories: ${Array.from(subcategories).join(', ')}`);
        }
    });

    it('should properly set isFree flag', async () => {
        const events = await scrapeArtsCentre();

        expect(events.length).toBeGreaterThan(0);

        // Arts Centre events are typically not free
        events.forEach(event => {
            expect(typeof event.isFree).toBe('boolean');
            // Most Arts Centre events are paid
            expect(event.isFree).toBe(false);
        });

        console.log(`\n isFree flag properly set for all ${events.length} events`);
    });

    it('should have recent scrapedAt timestamps', async () => {
        const events = await scrapeArtsCentre();
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        expect(events.length).toBeGreaterThan(0);

        events.forEach(event => {
            expect(event.scrapedAt).toBeInstanceOf(Date);
            expect(event.scrapedAt.getTime()).toBeGreaterThanOrEqual(fiveMinutesAgo.getTime());
            expect(event.scrapedAt.getTime()).toBeLessThanOrEqual(now.getTime() + 1000);
        });

        console.log(`\n All events have recent scrapedAt timestamps`);
    });
});