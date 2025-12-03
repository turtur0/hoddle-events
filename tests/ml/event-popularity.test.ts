import {
    calculateRawPopularityScore,
    getColdStartPopularityScore,
} from '@/lib/ml/popularity-service';
import { createMockEvent } from '../helpers/factories';

describe('Event Popularity Service', () => {

    // ============================================================================
    // Raw Popularity Score Calculation Tests
    // ============================================================================

    describe('calculateRawPopularityScore', () => {
        it('should calculate score with zero engagement', () => {
            const event = createMockEvent({
                venue: { name: 'MCG', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 0,
                    favouriteCount: 0,
                    clickthroughCount: 0,
                },
            });

            const score = calculateRawPopularityScore(event);
            expect(score).toBeGreaterThan(0);
        });

        it('should weight favourites higher than clickthroughs and views', () => {
            const withFavourites = createMockEvent({
                stats: {
                    viewCount: 0,
                    favouriteCount: 10,
                    clickthroughCount: 0,
                },
            });

            const withClickthroughs = createMockEvent({
                stats: {
                    viewCount: 0,
                    favouriteCount: 0,
                    clickthroughCount: 10,
                },
            });

            const withViews = createMockEvent({
                stats: {
                    viewCount: 10,
                    favouriteCount: 0,
                    clickthroughCount: 0,
                },
            });

            const favouritesScore = calculateRawPopularityScore(withFavourites);
            const clickthroughsScore = calculateRawPopularityScore(withClickthroughs);
            const viewsScore = calculateRawPopularityScore(withViews);

            expect(favouritesScore).toBeGreaterThan(clickthroughsScore);
            expect(clickthroughsScore).toBeGreaterThan(viewsScore);
        });

        it('should apply logarithmic scaling to large venues', () => {
            const smallVenue = createMockEvent({
                venue: { name: 'Small Club', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const largeVenue = createMockEvent({
                venue: { name: 'MCG', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const smallScore = calculateRawPopularityScore(smallVenue);
            const largeScore = calculateRawPopularityScore(largeVenue);

            expect(largeScore).toBeGreaterThan(smallScore);
            expect(largeScore / smallScore).toBeLessThan(10);
        });

        it('should add bonus for premium pricing', () => {
            const lowPrice = createMockEvent({
                priceMax: 50,
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const highPrice = createMockEvent({
                priceMax: 250,
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const lowPriceScore = calculateRawPopularityScore(lowPrice);
            const highPriceScore = calculateRawPopularityScore(highPrice);

            expect(highPriceScore).toBeGreaterThan(lowPriceScore);
        });

        it('should not apply price bonus for events under $100', () => {
            const lowPrice = createMockEvent({
                priceMax: 80,
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const noPrice = createMockEvent({
                priceMax: undefined,
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const lowPriceScore = calculateRawPopularityScore(lowPrice);
            const noPriceScore = calculateRawPopularityScore(noPrice);

            expect(lowPriceScore).toBe(noPriceScore);
        });

        it('should add bonus for multi-source events', () => {
            const singleSource = createMockEvent({
                sources: ['ticketmaster'],
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const multiSource = createMockEvent({
                sources: ['ticketmaster', 'marriner', 'whatson'],
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const singleScore = calculateRawPopularityScore(singleSource);
            const multiScore = calculateRawPopularityScore(multiSource);

            expect(multiScore).toBeGreaterThan(singleScore);
        });

        it('should apply time decay for older events', () => {
            const recentEvent = createMockEvent({
                scrapedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const oldEvent = createMockEvent({
                scrapedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const recentScore = calculateRawPopularityScore(recentEvent);
            const oldScore = calculateRawPopularityScore(oldEvent);

            expect(recentScore).toBeGreaterThan(oldScore);
        });

        it('should estimate venue capacity from name keywords', () => {
            const stadium = createMockEvent({
                venue: { name: 'Unknown Stadium', address: 'Test', suburb: 'Melbourne' },
            });

            const arena = createMockEvent({
                venue: { name: 'Unknown Arena', address: 'Test', suburb: 'Melbourne' },
            });

            const theatre = createMockEvent({
                venue: { name: 'Unknown Theatre', address: 'Test', suburb: 'Melbourne' },
            });

            const club = createMockEvent({
                venue: { name: 'Unknown Club', address: 'Test', suburb: 'Melbourne' },
            });

            const stadiumScore = calculateRawPopularityScore(stadium);
            const arenaScore = calculateRawPopularityScore(arena);
            const theatreScore = calculateRawPopularityScore(theatre);
            const clubScore = calculateRawPopularityScore(club);

            expect(stadiumScore).toBeGreaterThan(arenaScore);
            expect(arenaScore).toBeGreaterThan(theatreScore);
            expect(theatreScore).toBeGreaterThan(clubScore);
        });

        it('should handle missing stats fields gracefully', () => {
            const event = createMockEvent({
                stats: {
                    viewCount: 0,
                    favouriteCount: 0,
                    clickthroughCount: 0,
                },
            });

            expect(() => calculateRawPopularityScore(event)).not.toThrow();
            expect(calculateRawPopularityScore(event)).toBeGreaterThanOrEqual(0);
        });
    });

    // ============================================================================
    // Cold Start Scoring Tests
    // ============================================================================

    describe('getColdStartPopularityScore', () => {
        it('should ignore user engagement stats', () => {
            const event = createMockEvent({
                venue: { name: 'Test Arena', address: 'Test', suburb: 'Melbourne' },
                priceMax: 150,
                sources: ['ticketmaster', 'marriner'],
                stats: {
                    viewCount: 1000,
                    favouriteCount: 100,
                    clickthroughCount: 200,
                },
            });

            const score = getColdStartPopularityScore(event);

            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(100);
        });

        it('should score based on venue capacity', () => {
            const largeVenue = createMockEvent({
                venue: { name: 'MCG', address: 'Test', suburb: 'Melbourne' },
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const smallVenue = createMockEvent({
                venue: { name: 'Small Club', address: 'Test', suburb: 'Melbourne' },
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const largeScore = getColdStartPopularityScore(largeVenue);
            const smallScore = getColdStartPopularityScore(smallVenue);

            expect(largeScore).toBeGreaterThan(smallScore);
        });

        it('should score based on price tier', () => {
            const premium = createMockEvent({
                priceMax: 250,
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const budget = createMockEvent({
                priceMax: 50,
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const premiumScore = getColdStartPopularityScore(premium);
            const budgetScore = getColdStartPopularityScore(budget);

            expect(premiumScore).toBeGreaterThan(budgetScore);
        });

        it('should score based on number of sources', () => {
            const multiSource = createMockEvent({
                sources: ['ticketmaster', 'marriner', 'whatson'],
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const singleSource = createMockEvent({
                sources: ['ticketmaster'],
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const multiScore = getColdStartPopularityScore(multiSource);
            const singleScore = getColdStartPopularityScore(singleSource);

            expect(multiScore).toBeGreaterThan(singleScore);
        });

        it('should not apply time decay', () => {
            const recentEvent = createMockEvent({
                venue: { name: 'Test Arena', address: 'Test', suburb: 'Melbourne' },
                scrapedAt: new Date(),
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const oldEvent = createMockEvent({
                venue: { name: 'Test Arena', address: 'Test', suburb: 'Melbourne' },
                scrapedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const recentScore = getColdStartPopularityScore(recentEvent);
            const oldScore = getColdStartPopularityScore(oldEvent);

            expect(recentScore).toBe(oldScore);
        });
    });

    // ============================================================================
    // Integration Tests
    // ============================================================================

    describe('Full popularity workflow', () => {
        it('should correctly rank diverse events within a category', () => {
            const highEngagement = createMockEvent({
                category: 'music',
                venue: { name: 'Small Club', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 500,
                    favouriteCount: 50,
                    clickthroughCount: 100,
                },
                scrapedAt: new Date(),
            });

            const largeVenue = createMockEvent({
                category: 'music',
                venue: { name: 'MCG', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
                scrapedAt: new Date(),
            });

            const premium = createMockEvent({
                category: 'music',
                venue: { name: 'Test Theatre', address: 'Test', suburb: 'Melbourne' },
                priceMax: 300,
                sources: ['ticketmaster', 'marriner'],
                stats: {
                    viewCount: 200,
                    favouriteCount: 20,
                    clickthroughCount: 40,
                },
                scrapedAt: new Date(),
            });

            const oldEvent = createMockEvent({
                category: 'music',
                venue: { name: 'Test Arena', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 400,
                    favouriteCount: 40,
                    clickthroughCount: 80,
                },
                scrapedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            });

            const scores = {
                highEngagement: calculateRawPopularityScore(highEngagement),
                largeVenue: calculateRawPopularityScore(largeVenue),
                premium: calculateRawPopularityScore(premium),
                oldEvent: calculateRawPopularityScore(oldEvent),
            };

            expect(scores.highEngagement).toBeGreaterThan(scores.largeVenue);
            expect(scores.highEngagement).toBeGreaterThan(scores.oldEvent);
        });

        it('should balance engagement signals with venue characteristics', () => {
            const highEngagementSmallVenue = createMockEvent({
                venue: { name: 'Small Club', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 1000,
                    favouriteCount: 100,
                    clickthroughCount: 200,
                },
            });

            const lowEngagementLargeVenue = createMockEvent({
                venue: { name: 'MCG', address: 'Test', suburb: 'Melbourne' },
                stats: {
                    viewCount: 10,
                    favouriteCount: 1,
                    clickthroughCount: 2,
                },
            });

            const score1 = calculateRawPopularityScore(highEngagementSmallVenue);
            const score2 = calculateRawPopularityScore(lowEngagementLargeVenue);

            expect(score1).toBeGreaterThan(score2);
        });

        it('should demonstrate cold start vs engaged event scoring', () => {
            const newEvent = createMockEvent({
                venue: { name: 'Rod Laver Arena', address: 'Test', suburb: 'Melbourne' },
                priceMax: 200,
                sources: ['ticketmaster', 'marriner'],
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            const engagedEvent = createMockEvent({
                venue: { name: 'Rod Laver Arena', address: 'Test', suburb: 'Melbourne' },
                priceMax: 200,
                sources: ['ticketmaster', 'marriner'],
                stats: { viewCount: 500, favouriteCount: 50, clickthroughCount: 100 },
            });

            const coldStartScore = getColdStartPopularityScore(newEvent);
            const engagedScore = calculateRawPopularityScore(engagedEvent);

            expect(engagedScore).toBeGreaterThan(coldStartScore);
        });
    });
});