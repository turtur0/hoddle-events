import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { scrapeMarrinerGroup, ScrapeOptions } from '@/app/lib/scrapers/marriner';

const TEST_OPTIONS: ScrapeOptions = {
    maxShows: 10,        // limit number of shows fetched
    maxDetailFetches: 5, // limit detail page fetches
    usePuppeteer: true,  // use Puppeteer for /shows lazy-load
};

(async () => {
    console.log('🎭 Testing Marriner Hybrid Scraper\n');
    console.log('📋 Test Options:', TEST_OPTIONS, '\n');

    try {
        const startTime = Date.now();
        const events = await scrapeMarrinerGroup(TEST_OPTIONS);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n${'='.repeat(70)}`);
        console.log(`✅ Scraping Complete in ${duration}s`);
        console.log(`${'='.repeat(70)}\n`);
        console.log(`📊 Summary: Found ${events.length} upcoming events\n`);

        if (!events.length) return console.log('⚠️  No events found.\n');

        // Category breakdown
        const categoryCount: Record<string, number> = {};
        events.forEach(event => {
            const key = event.subcategory
                ? `${event.category}/${event.subcategory}`
                : event.category;
            categoryCount[key] = (categoryCount[key] || 0) + 1;
        });

        console.log('📊 Category Breakdown:');
        Object.entries(categoryCount).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count}`);
        });
        console.log();

        // Display events
        events.forEach((event, i) => {
            console.log(`${'─'.repeat(70)}`);
            console.log(`EVENT ${i + 1}: ${event.title}`);

            // Category & Subcategory
            const categoryStr = event.subcategory
                ? `${event.category} → ${event.subcategory}`
                : event.category;
            console.log(`🏷️  Category: ${categoryStr}`);

            // Venue
            console.log(`📍 Venue: ${event.venue.name}`);
            console.log(`   Address: ${event.venue.address}, ${event.venue.suburb}`);

            // Dates
            const startStr = event.startDate.toLocaleDateString('en-AU', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            console.log(`📅 Start: ${startStr}`);

            if (event.endDate) {
                const endStr = event.endDate.toLocaleDateString('en-AU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
                console.log(`   End:   ${endStr}`);

                // Calculate duration
                const duration = Math.ceil(
                    (event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                console.log(`   Duration: ${duration} days`);
            }

            // Description
            const desc = event.description?.substring(0, 100);
            console.log(`📝 Description: ${desc}${desc && desc.length === 100 ? '...' : ''}`);

            // Image
            if (event.imageUrl) {
                console.log(`🖼️  Image: ${event.imageUrl.substring(0, 60)}...`);
            }

            // Booking
            console.log(`🔗 Booking: ${event.bookingUrl}`);

            // Source info
            console.log(`📌 Source: ${event.source} (ID: ${event.sourceId})`);
            console.log(`   Scraped: ${event.scrapedAt.toLocaleString('en-AU')}`);
        });

        console.log(`\n${'─'.repeat(70)}\n`);

    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();