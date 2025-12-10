import { scrapeFeverUpMelbourne } from '@/lib/scrapers/feverup';

/**
 * Tests FeverUp scraper and logs results without saving to database.
 */
async function testFeverUpScraper() {
    console.log('='.repeat(70));
    console.log('FeverUp Scraper Test');
    console.log('='.repeat(70));
    console.log('Testing scraper without database writes\n');

    try {
        const startTime = Date.now();

        // Test with limited events
        const events = await scrapeFeverUpMelbourne({
            maxEvents: 10,
            fetchDetails: true,
            detailFetchDelay: 1500,
        });

        const duration = Date.now() - startTime;

        console.log('\n' + '='.repeat(70));
        console.log('Scrape Results');
        console.log('='.repeat(70));
        console.log(`Total events scraped: ${events.length}`);
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`Average time per event: ${(duration / events.length / 1000).toFixed(1)}s\n`);

        // Display sample events with full details
        if (events.length > 0) {
            console.log('Sample Events:');
            console.log('-'.repeat(70));

            events.slice(0, 3).forEach((event, i) => {
                console.log(`\n${i + 1}. ${event.title}`);
                console.log(`   Category: ${event.category}`);
                console.log(`   Venue: ${event.venue.name}`);
                console.log(`   Address: ${event.venue.address}`);
                console.log(`   Suburb: ${event.venue.suburb}`);

                // Date information
                console.log(`   Start Date: ${event.startDate.toLocaleDateString('en-AU')}`);
                if (event.endDate) {
                    console.log(`   End Date: ${event.endDate.toLocaleDateString('en-AU')}`);
                }

                // Price information - show all details
                if (event.isFree) {
                    console.log(`   Price: Free`);
                } else {
                    const priceRange = event.priceMax
                        ? `$${event.priceMin} - $${event.priceMax}`
                        : `$${event.priceMin}`;
                    console.log(`   Price Range: ${priceRange}`);
                    if (event.priceDetails) {
                        console.log(`   Ticket Types: ${event.priceDetails}`);
                    }
                }

                // Additional details
                if (event.duration) {
                    console.log(`   Duration: ${event.duration}`);
                }
                if (event.ageRestriction) {
                    console.log(`   Age Restriction: ${event.ageRestriction}`);
                }
                if (event.accessibility && event.accessibility.length > 0) {
                    console.log(`   Accessibility: ${event.accessibility.join(', ')}`);
                }

                // Image information
                if (event.imageUrl) {
                    console.log(`   Image URL: ${event.imageUrl}`);
                }

                console.log(`   Booking URL: ${event.bookingUrl}`);
                console.log(`   Description: ${event.description.substring(0, 100)}...`);
            });

            // Category breakdown
            console.log('\n' + '-'.repeat(70));
            console.log('Category Breakdown:');
            const categoryCount: Record<string, number> = {};
            events.forEach(event => {
                categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
            });
            Object.entries(categoryCount).forEach(([category, count]) => {
                console.log(`   ${category}: ${count}`);
            });

            // Date range analysis
            console.log('\n' + '-'.repeat(70));
            console.log('Date Range Analysis:');
            const eventsWithEndDate = events.filter(e => e.endDate).length;
            const eventsWithoutEndDate = events.length - eventsWithEndDate;
            console.log(`   Events with end date: ${eventsWithEndDate}`);
            console.log(`   Events without end date: ${eventsWithoutEndDate}`);
            if (eventsWithEndDate > 0) {
                const avgDuration = events
                    .filter(e => e.endDate)
                    .map(e => {
                        const days = Math.ceil(
                            (e.endDate!.getTime() - e.startDate.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return days;
                    })
                    .reduce((a, b) => a + b, 0) / eventsWithEndDate;
                console.log(`   Average event duration: ${avgDuration.toFixed(0)} days`);
            }

            // Price analysis
            console.log('\n' + '-'.repeat(70));
            console.log('Price Analysis:');
            const freeEvents = events.filter(e => e.isFree).length;
            const paidEvents = events.filter(e => !e.isFree).length;
            const eventsWithPriceDetails = events.filter(e => e.priceDetails).length;
            const eventsWithPriceRange = events.filter(e => e.priceMax).length;
            const prices = events.filter(e => e.priceMin).map(e => e.priceMin!);

            console.log(`   Free events: ${freeEvents}`);
            console.log(`   Paid events: ${paidEvents}`);
            console.log(`   Events with ticket type details: ${eventsWithPriceDetails}`);
            console.log(`   Events with price range: ${eventsWithPriceRange}`);

            if (prices.length > 0) {
                console.log(`   Price range: $${Math.min(...prices)} - $${Math.max(...prices)}`);
                console.log(`   Average price: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`);
            }

            // Venue analysis
            console.log('\n' + '-'.repeat(70));
            console.log('Venue Analysis:');
            const venues = new Set(events.map(e => e.venue.name));
            const suburbs = new Set(events.map(e => e.venue.suburb));
            console.log(`   Unique venues: ${venues.size}`);
            console.log(`   Unique suburbs: ${suburbs.size}`);
            console.log(`   Top suburbs: ${Array.from(suburbs).slice(0, 5).join(', ')}`);

            // Additional details analysis
            console.log('\n' + '-'.repeat(70));
            console.log('Additional Details Analysis:');
            const withDuration = events.filter(e => e.duration).length;
            const withAgeRestriction = events.filter(e => e.ageRestriction).length;
            const withAccessibility = events.filter(e => e.accessibility && e.accessibility.length > 0).length;
            const withImages = events.filter(e => e.imageUrl).length;

            console.log(`   Events with duration info: ${withDuration}`);
            console.log(`   Events with age restrictions: ${withAgeRestriction}`);
            console.log(`   Events with accessibility info: ${withAccessibility}`);
            console.log(`   Events with images: ${withImages}`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('Test completed successfully!');
        console.log('='.repeat(70) + '\n');

    } catch (error) {
        console.error('\nTest failed:', error);
        process.exit(1);
    }
}

// Run test
if (require.main === module) {
    testFeverUpScraper()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}