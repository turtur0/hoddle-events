import {
    extractEventFeatures,
    cosineSimilarity,
} from '@/lib/ml';
import type { IEvent } from '@/lib/models';

describe('Vector Service', () => {
    // ============================================================================
    // Helper Functions
    // ============================================================================
    const createMockEvent = (overrides: Partial<IEvent> = {}): IEvent => ({
        _id: 'test-id',
        title: 'Test Event',
        description: 'Test description',
        category: 'music',
        subcategories: [],
        startDate: new Date('2025-01-01'),
        venue: {
            name: 'Test Venue',
            address: '123 Test St',
            suburb: 'Melbourne',
        },
        isFree: false,
        bookingUrl: 'https://example.com',
        bookingUrls: {},
        sources: ['ticketmaster'],
        primarySource: 'ticketmaster',
        sourceIds: {},
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        isArchived: false,
        stats: {
            viewCount: 0,
            favouriteCount: 0,
            clickthroughCount: 0,
        },
        ...overrides,
    });

    // ============================================================================
    // Cosine Similarity Tests
    // ============================================================================
    describe('cosineSimilarity', () => {
        it('should return 1.0 for identical vectors', () => {
            const vector = [1, 2, 3, 4, 5];
            expect(cosineSimilarity(vector, vector)).toBe(1.0);
        });

        it('should return 0 for orthogonal vectors', () => {
            expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
        });

        it('should handle zero vectors', () => {
            expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
            expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
        });

        it('should throw error for mismatched vector lengths', () => {
            expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow();
        });

        it('should calculate correct similarity for known angles', () => {
            const vectorA = [1, 0];
            const vectorB = [0.5, Math.sqrt(3) / 2]; // 60 degrees
            expect(cosineSimilarity(vectorA, vectorB)).toBeCloseTo(0.5, 5);
        });
    });

    // ============================================================================
    // Category Encoding Tests
    // ============================================================================
    describe('extractEventFeatures - Category Encoding', () => {
        it('should one-hot encode categories at correct positions', () => {
            const categories = [
                { value: 'music', index: 0 },
                { value: 'theatre', index: 1 },
                { value: 'sports', index: 2 },
                { value: 'arts', index: 3 },
                { value: 'family', index: 4 },
                { value: 'other', index: 5 },
            ];

            categories.forEach(({ value, index }) => {
                const event = createMockEvent({ category: value });
                const features = extractEventFeatures(event);

                expect(features.categoryVector[index]).toBe(10.0);
                expect(features.categoryVector.filter(v => v !== 0).length).toBe(1);
            });
        });
    });

    // ============================================================================
    // Subcategory Encoding Tests
    // ============================================================================
    describe('extractEventFeatures - Subcategory Encoding', () => {
        it('should multi-hot encode subcategories with correct weight', () => {
            const event = createMockEvent({
                category: 'music',
                subcategories: ['Rock & Alternative', 'Pop & Electronic', 'Hip Hop & R&B'],
            });
            const features = extractEventFeatures(event);

            expect(features.subcategoryVector.filter(v => v === 5.0).length).toBe(3);
        });

        it('should only encode subcategories within event category', () => {
            const event = createMockEvent({
                category: 'music',
                subcategories: ['Rock & Alternative', 'Musicals'], // Musicals is theatre
            });
            const features = extractEventFeatures(event);

            expect(features.subcategoryVector.filter(v => v !== 0).length).toBe(1);
        });

        it('should support shortened subcategory names', () => {
            const event = createMockEvent({
                category: 'music',
                subcategories: ['rock'], // Should match 'Rock & Alternative'
            });
            const features = extractEventFeatures(event);

            expect(features.subcategoryVector.filter(v => v === 5.0).length).toBe(1);
        });

        it('should handle empty subcategories', () => {
            const event = createMockEvent({ category: 'music', subcategories: [] });
            const features = extractEventFeatures(event);

            expect(features.subcategoryVector.every(v => v === 0)).toBe(true);
        });
    });

    // ============================================================================
    // Price Normalisation Tests
    // ============================================================================
    describe('extractEventFeatures - Price Normalisation', () => {
        it('should normalise prices using logarithmic scale', () => {
            const cases = [
                { isFree: true, priceMin: undefined, expected: 0 },
                { isFree: false, priceMin: undefined, expected: 0 },
                { isFree: false, priceMin: 50, expected: Math.log10(51) / Math.log10(501) },
                { isFree: false, priceMin: 500, expected: 1.0 },
                { isFree: false, priceMin: 1000, expected: 1.0 }, // Capped
            ];

            cases.forEach(({ isFree, priceMin, expected }) => {
                const event = createMockEvent({ isFree, priceMin });
                const features = extractEventFeatures(event);

                if (expected === 0 || expected === 1.0) {
                    expect(features.priceNormalised).toBeCloseTo(expected, 5);
                } else {
                    expect(features.priceNormalised).toBeCloseTo(expected, 5);
                }
            });
        });

        it('should compress expensive prices logarithmically', () => {
            const event100 = createMockEvent({ isFree: false, priceMin: 100 });
            const event200 = createMockEvent({ isFree: false, priceMin: 200 });

            const features100 = extractEventFeatures(event100);
            const features200 = extractEventFeatures(event200);

            // Difference should be smaller than the lower price (compression)
            const diff = features200.priceNormalised - features100.priceNormalised;
            expect(diff).toBeLessThan(features100.priceNormalised);
        });
    });

    // ============================================================================
    // Venue Tier Tests
    // ============================================================================
    describe('extractEventFeatures - Venue Tier', () => {
        it('should assign correct tiers to known venues', () => {
            const venues = [
                { name: 'MCG', tier: 1.0 },
                { name: 'Princess Theatre', tier: 0.8 },
                { name: 'The Corner Hotel', tier: 0.4 },
                { name: 'Cherry Bar', tier: 0.35 },
            ];

            venues.forEach(({ name, tier }) => {
                const event = createMockEvent({
                    venue: { name, address: 'Test', suburb: 'Melbourne' },
                });
                expect(extractEventFeatures(event).venueTier).toBe(tier);
            });
        });

        it('should use keyword heuristics for unknown venues', () => {
            const heuristics = [
                { name: 'Random Arena', expected: 0.9 },
                { name: 'Some Theatre', expected: 0.7 },
                { name: 'Cool Bar', expected: 0.4 },
                { name: 'Art Gallery', expected: 0.5 },
            ];

            heuristics.forEach(({ name, expected }) => {
                const event = createMockEvent({
                    venue: { name, address: 'Test', suburb: 'Melbourne' },
                });
                expect(extractEventFeatures(event).venueTier).toBe(expected);
            });
        });

        it('should fallback to price/source proxies', () => {
            const fallbacks: Array<{
                priceMin?: number;
                isFree?: boolean;
                primarySource: 'ticketmaster' | 'marriner' | 'whatson';
                expected: number;
            }> = [
                    { priceMin: 250, primarySource: 'whatson', expected: 0.85 },
                    { priceMin: 150, primarySource: 'whatson', expected: 0.7 },
                    { isFree: true, primarySource: 'whatson', expected: 0.3 },
                    { priceMin: 50, primarySource: 'ticketmaster', expected: 0.65 },
                    { priceMin: 50, primarySource: 'marriner', expected: 0.75 },
                    { priceMin: 50, primarySource: 'whatson', expected: 0.5 },
                ];

            fallbacks.forEach(({ priceMin, isFree, primarySource, expected }) => {
                const event = createMockEvent({
                    venue: { name: 'Unknown Venue', address: 'Test', suburb: 'Melbourne' },
                    priceMin,
                    isFree,
                    primarySource,
                });
                expect(extractEventFeatures(event).venueTier).toBe(expected);
            });
        });
    });

    // ============================================================================
    // Popularity Score Tests
    // ============================================================================
    describe('extractEventFeatures - Popularity Score', () => {
        it('should use categoryPopularityPercentile when available', () => {
            const event = createMockEvent({
                stats: {
                    viewCount: 100,
                    favouriteCount: 50,
                    clickthroughCount: 25,
                    categoryPopularityPercentile: 0.8,
                },
            });

            expect(extractEventFeatures(event).popularityScore).toBe(0.8 * 3.0);
        });

        it('should calculate from stats with sigmoid when percentile unavailable', () => {
            const event = createMockEvent({
                stats: {
                    viewCount: 100,
                    favouriteCount: 10,
                    clickthroughCount: 20,
                },
            });

            const rawScore = 100 * 0.1 + 10 * 5 + 20 * 2;
            const sigmoid = 1 / (1 + Math.exp(-rawScore * 0.01));
            const expected = sigmoid * 3.0;

            expect(extractEventFeatures(event).popularityScore).toBeCloseTo(expected, 5);
        });

        it('should weight favourites higher than views', () => {
            const viewEvent = createMockEvent({
                stats: { viewCount: 50, favouriteCount: 0, clickthroughCount: 0 },
            });
            const favouriteEvent = createMockEvent({
                stats: { viewCount: 0, favouriteCount: 10, clickthroughCount: 0 },
            });

            const viewScore = extractEventFeatures(viewEvent).popularityScore;
            const favouriteScore = extractEventFeatures(favouriteEvent).popularityScore;

            expect(favouriteScore).toBeGreaterThan(viewScore);
        });

        it('should cap popularity score at weighted maximum', () => {
            const event = createMockEvent({
                stats: {
                    viewCount: 1000000,
                    favouriteCount: 50000,
                    clickthroughCount: 100000,
                },
            });

            expect(extractEventFeatures(event).popularityScore).toBeLessThanOrEqual(3.0);
        });
    });

    // ============================================================================
    // Full Vector Assembly Tests
    // ============================================================================
    describe('extractEventFeatures - Full Vector Assembly', () => {
        it('should return correct event ID', () => {
            const event = createMockEvent({ _id: 'test-123' });
            expect(extractEventFeatures(event).eventId).toBe('test-123');
        });

        it('should produce consistent 47-dimension vectors', () => {
            const events = [
                createMockEvent({ category: 'music', subcategories: ['Rock & Alternative'] }),
                createMockEvent({ category: 'theatre', subcategories: [] }),
                createMockEvent({ category: 'sports', subcategories: ['AFL', 'Cricket'] }),
            ];

            events.forEach(event => {
                const features = extractEventFeatures(event);
                expect(features.fullVector.length).toBe(47); // 6 + 38 + 1 + 1 + 1
            });
        });

        it('should preserve isFree flag', () => {
            const freeEvent = createMockEvent({ isFree: true });
            const paidEvent = createMockEvent({ isFree: false });

            expect(extractEventFeatures(freeEvent).isFree).toBe(true);
            expect(extractEventFeatures(paidEvent).isFree).toBe(false);
        });

        it('should apply correct feature weights', () => {
            const event = createMockEvent({
                category: 'music',
                subcategories: ['Rock & Alternative'],
                priceMin: 100,
                venue: { name: 'Princess Theatre', address: 'Test', suburb: 'Melbourne' },
                stats: { viewCount: 50, favouriteCount: 5, clickthroughCount: 10 },
            });
            const features = extractEventFeatures(event);

            expect(Math.max(...features.categoryVector)).toBe(10.0);
            expect(Math.max(...features.subcategoryVector)).toBe(5.0);
            expect(features.popularityScore).toBeGreaterThan(0);
            expect(features.popularityScore).toBeLessThanOrEqual(3.0);
        });
    });

    // ============================================================================
    // Edge Cases & Integration
    // ============================================================================
    describe('extractEventFeatures - Edge Cases', () => {
        it('should handle minimal event data without errors', () => {
            const event = createMockEvent({
                stats: { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            });

            expect(() => extractEventFeatures(event)).not.toThrow();
            expect(extractEventFeatures(event).popularityScore).toBeGreaterThan(0);
        });

        it('should handle missing optional stats fields', () => {
            const event = createMockEvent({
                stats: {
                    viewCount: 0,
                    favouriteCount: 0,
                    clickthroughCount: 0,
                    categoryPopularityPercentile: undefined,
                    rawPopularityScore: undefined,
                },
            });

            const features = extractEventFeatures(event);
            expect(features.popularityScore).toBeGreaterThanOrEqual(0);
        });
    });

    describe('extractEventFeatures - Integration', () => {
        it('should produce high similarity for similar events', () => {
            const event1 = createMockEvent({
                category: 'music',
                subcategories: ['rock'],
                priceMin: 50,
                venue: { name: 'Forum Melbourne', address: 'Test', suburb: 'Melbourne' },
                stats: { viewCount: 100, favouriteCount: 10, clickthroughCount: 20 },
            });

            const event2 = createMockEvent({
                category: 'music',
                subcategories: ['rock'],
                priceMin: 60,
                venue: { name: 'The Corner Hotel', address: 'Test', suburb: 'Richmond' },
                stats: { viewCount: 120, favouriteCount: 12, clickthroughCount: 25 },
            });

            const features1 = extractEventFeatures(event1);
            const features2 = extractEventFeatures(event2);
            const similarity = cosineSimilarity(features1.fullVector, features2.fullVector);

            expect(similarity).toBeGreaterThan(0.7);
        });

        it('should produce low similarity for different events', () => {
            const musicEvent = createMockEvent({
                category: 'music',
                subcategories: ['rock'],
                priceMin: 50,
            });

            const sportsEvent = createMockEvent({
                category: 'sports',
                subcategories: ['AFL'],
                priceMin: 100,
            });

            const musicFeatures = extractEventFeatures(musicEvent);
            const sportsFeatures = extractEventFeatures(sportsEvent);
            const similarity = cosineSimilarity(musicFeatures.fullVector, sportsFeatures.fullVector);

            expect(similarity).toBeLessThan(0.3);
        });
    });
});