// tests/ml/vectorService.test.ts
import { extractEventFeatures, cosineSimilarity, FEATURE_WEIGHTS } from '@/lib/ml/vectorService';
import { IEvent } from '@/lib/models/Event';
import mongoose from 'mongoose';

describe('Vector Service', () => {
    const mockEvent: IEvent = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        title: 'Hamilton',
        description: 'An American Musical',
        category: 'theatre',
        subcategories: ['Musicals'],

        startDate: new Date('2025-12-15T19:30:00'),
        endDate: new Date('2025-12-15T22:00:00'),

        venue: {
            name: 'Princess Theatre',
            address: '163 Spring St',
            suburb: 'Melbourne',
        },

        priceMin: 150,
        priceMax: 299,
        priceDetails: 'Adult $150-299',
        isFree: false,

        bookingUrl: 'https://example.com/hamilton',
        bookingUrls: { ticketmaster: 'https://ticketmaster.com/hamilton' },
        imageUrl: 'https://example.com/hamilton.jpg',
        videoUrl: undefined,

        sources: ['ticketmaster'],
        primarySource: 'ticketmaster',
        sourceIds: { ticketmaster: 'tm123' },

        accessibility: ['Wheelchair accessible'],
        ageRestriction: 'PG',
        duration: '2h 30m',

        scrapedAt: new Date('2025-01-01'),
        lastUpdated: new Date('2025-01-01'),
        mergedFrom: [],

        stats: {
            viewCount: 100,
            favouriteCount: 20,
            clickthroughCount: 10,
        },
    };

    describe('extractEventFeatures', () => {
        it('should extract features correctly', () => {
            const vector = extractEventFeatures(mockEvent);

            // Check category encoding (theatre should be at index 1)
            expect(vector.categoryVector).toHaveLength(6);
            expect(vector.categoryVector[1]).toBe(FEATURE_WEIGHTS.category); // Theatre is weighted

            // Only theatre category should be active
            const activeCategories = vector.categoryVector.filter(v => v > 0);
            expect(activeCategories.length).toBe(1);
        });

        it('should calculate venue tier correctly for known venues', () => {
            const vector = extractEventFeatures(mockEvent);
            expect(vector.venueTier).toBeCloseTo(0.8); // Princess Theatre
        });

        it('should handle free events', () => {
            const freeEvent: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                isFree: true,
                priceMin: undefined,
                priceMax: undefined,
            };

            const vector = extractEventFeatures(freeEvent);
            expect(vector.priceNormalised).toBe(0);
            expect(vector.isFree).toBe(true);
        });

        it('should normalize prices on log scale', () => {
            const cheapEvent: IEvent = { ...mockEvent, _id: new mongoose.Types.ObjectId(), priceMin: 35 };
            const midEvent: IEvent = { ...mockEvent, _id: new mongoose.Types.ObjectId(), priceMin: 85 };
            const expensiveEvent: IEvent = { ...mockEvent, _id: new mongoose.Types.ObjectId(), priceMin: 250 };

            const cheapVector = extractEventFeatures(cheapEvent);
            const midVector = extractEventFeatures(midEvent);
            const expensiveVector = extractEventFeatures(expensiveEvent);

            expect(cheapVector.priceNormalised).toBeLessThan(midVector.priceNormalised);
            expect(midVector.priceNormalised).toBeLessThan(expensiveVector.priceNormalised);
            expect(expensiveVector.priceNormalised).toBeLessThanOrEqual(1);
        });

        it('should handle unknown venues with fallback logic', () => {
            const unknownVenue: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                venue: { name: 'Unknown Stadium', address: '123 St', suburb: 'Melbourne' },
            };

            const vector = extractEventFeatures(unknownVenue);
            expect(vector.venueTier).toBeGreaterThan(0.5); // Stadium keyword → high tier
            expect(vector.venueTier).toBeLessThanOrEqual(1);
        });

        it('should create valid full vector', () => {
            const vector = extractEventFeatures(mockEvent);

            expect(vector.fullVector).toBeDefined();
            expect(vector.fullVector.length).toBeGreaterThan(0);
            expect(vector.fullVector.every(val => typeof val === 'number')).toBe(true);
            expect(vector.fullVector.every(val => !isNaN(val))).toBe(true);
        });

        it('should handle multiple subcategories', () => {
            const multiSubEvent: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                subcategories: ['Musicals', 'Drama'],
            };

            const vector = extractEventFeatures(multiSubEvent);
            const activeSubcats = vector.subcategoryVector.filter(v => v > 0);

            expect(activeSubcats.length).toBe(2); // Two subcategories active
            expect(activeSubcats[0]).toBe(FEATURE_WEIGHTS.subcategory); // Each is weighted
        });

        it('should weight features according to importance hierarchy', () => {
            const vector = extractEventFeatures(mockEvent);

            // Category features should be most heavily weighted
            const maxCategoryWeight = Math.max(...vector.categoryVector);

            // Subcategory weights should be less than category
            const maxSubcategoryWeight = Math.max(...vector.subcategoryVector);

            // Verify weight hierarchy: category > subcategory
            expect(maxCategoryWeight).toBeGreaterThan(maxSubcategoryWeight);
            expect(maxSubcategoryWeight).toBeGreaterThan(0); // Should have at least one subcategory
        });
    });

    describe('cosineSimilarity', () => {
        it('should return 1 for identical vectors', () => {
            const vectorA = [1, 0, 0.5, 0.8];
            const vectorB = [1, 0, 0.5, 0.8];

            const similarity = cosineSimilarity(vectorA, vectorB);

            expect(similarity).toBeCloseTo(1, 5);
        });

        it('should return 0 for orthogonal vectors', () => {
            const vectorA = [1, 0, 0, 0];
            const vectorB = [0, 1, 0, 0];

            const similarity = cosineSimilarity(vectorA, vectorB);

            expect(similarity).toBeCloseTo(0, 5);
        });

        it('should calculate similarity for similar vectors', () => {
            const vectorA = [1, 0, 0.5, 0.8];
            const vectorB = [1, 0, 0.6, 0.7];

            const similarity = cosineSimilarity(vectorA, vectorB);

            expect(similarity).toBeGreaterThan(0.9); // Very similar
            expect(similarity).toBeLessThanOrEqual(1);
        });

        it('should calculate similarity for different vectors', () => {
            const vectorA = [1, 0, 0, 0]; // Music
            const vectorB = [0, 1, 0, 0]; // Theatre

            const similarity = cosineSimilarity(vectorA, vectorB);

            expect(similarity).toBeCloseTo(0); // Different categories
        });

        it('should throw error for mismatched vector lengths', () => {
            const vectorA = [1, 0, 0.5];
            const vectorB = [1, 0, 0.5, 0.8];

            expect(() => cosineSimilarity(vectorA, vectorB)).toThrow();
        });

        it('should handle zero vectors', () => {
            const vectorA = [0, 0, 0, 0];
            const vectorB = [1, 0, 0.5, 0.8];

            const similarity = cosineSimilarity(vectorA, vectorB);

            expect(similarity).toBe(0); // Zero magnitude handling
        });

        it('should be symmetric', () => {
            const vectorA = [1, 0.5, 0.3];
            const vectorB = [0.8, 0.6, 0.4];

            const sim1 = cosineSimilarity(vectorA, vectorB);
            const sim2 = cosineSimilarity(vectorB, vectorA);

            expect(sim1).toBeCloseTo(sim2, 10);
        });
    });

    describe('Real-world event similarity with weighted features', () => {
        it('should detect similar musical theatre events', () => {
            const hamilton: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                title: 'Hamilton',
                category: 'theatre',
                subcategories: ['Musicals'],
                venue: { name: 'Princess Theatre', address: '123 St', suburb: 'Melbourne' },
                priceMin: 150,
            };

            const phantom: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                title: 'Phantom of the Opera',
                category: 'theatre',
                subcategories: ['Musicals', 'Opera'],
                venue: { name: 'Regent Theatre', address: '456 St', suburb: 'Melbourne' },
                priceMin: 140,
            };

            const vector1 = extractEventFeatures(hamilton);
            const vector2 = extractEventFeatures(phantom);

            const similarity = cosineSimilarity(vector1.fullVector, vector2.fullVector);

            // Same category (heavily weighted) + shared subcategory (moderately weighted)
            // Should be very similar despite different venues/prices
            expect(similarity).toBeGreaterThan(0.85);
        });

        it('should detect different category events as dissimilar', () => {
            const musical: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'theatre',
                subcategories: ['Musicals'],
                venue: { name: 'Princess Theatre', address: '123 St', suburb: 'Melbourne' },
                priceMin: 150,
                stats: { viewCount: 100, favouriteCount: 20, clickthroughCount: 10 },
            };

            const concert: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Rock & Alternative'],
                venue: { name: 'Forum Melbourne', address: '456 St', suburb: 'Melbourne' },
                priceMin: 85,
                stats: { viewCount: 100, favouriteCount: 20, clickthroughCount: 10 },
            };

            const vector1 = extractEventFeatures(musical);
            const vector2 = extractEventFeatures(concert);

            const similarity = cosineSimilarity(vector1.fullVector, vector2.fullVector);

            // Different categories (heavily weighted) should dominate the similarity
            // Even if other features (price, venue, popularity) are similar
            expect(similarity).toBeLessThan(0.3);
        });

        it('should prioritize category match over venue differences', () => {
            const stadiumConcert: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Rock & Alternative'],
                venue: { name: 'Marvel Stadium', address: '123 St', suburb: 'Melbourne' },
                priceMin: 200,
                stats: { viewCount: 1000, favouriteCount: 200, clickthroughCount: 100 },
            };

            const smallVenueConcert: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Rock & Alternative'],
                venue: { name: 'Cherry Bar', address: '456 St', suburb: 'Melbourne' },
                priceMin: 30,
                stats: { viewCount: 50, favouriteCount: 5, clickthroughCount: 2 },
            };

            const vector1 = extractEventFeatures(stadiumConcert);
            const vector2 = extractEventFeatures(smallVenueConcert);

            // Despite huge differences in venue tier, price, and popularity
            // They should still be fairly similar due to matching category + subcategory
            const similarity = cosineSimilarity(vector1.fullVector, vector2.fullVector);
            expect(similarity).toBeGreaterThan(0.7);
        });

        it('should detect subcategory similarities within same category', () => {
            const jazzConcert: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Jazz & Blues'],
                priceMin: 85,
            };

            const rockConcert: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Rock & Alternative'],
                priceMin: 85,
            };

            const jazzConcert2: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Jazz & Blues'],
                priceMin: 90,
            };

            const vector1 = extractEventFeatures(jazzConcert);
            const vector2 = extractEventFeatures(rockConcert);
            const vector3 = extractEventFeatures(jazzConcert2);

            const similarityDifferentSubcat = cosineSimilarity(vector1.fullVector, vector2.fullVector);
            const similaritySameSubcat = cosineSimilarity(vector1.fullVector, vector3.fullVector);

            // Same subcategory should be MORE similar than different subcategory
            expect(similaritySameSubcat).toBeGreaterThan(similarityDifferentSubcat);
        });

        it('should show popularity affects similarity but less than category', () => {
            const mainstreamEvent: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Pop & Electronic'],
                stats: { viewCount: 5000, favouriteCount: 500, clickthroughCount: 200 },
            };

            const nicheEvent: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'music',
                subcategories: ['Pop & Electronic'],
                stats: { viewCount: 10, favouriteCount: 1, clickthroughCount: 0 },
            };

            const differentCategory: IEvent = {
                ...mockEvent,
                _id: new mongoose.Types.ObjectId(),
                category: 'theatre',
                subcategories: ['Drama'],
                stats: { viewCount: 5000, favouriteCount: 500, clickthroughCount: 200 },
            };

            const vector1 = extractEventFeatures(mainstreamEvent);
            const vector2 = extractEventFeatures(nicheEvent);
            const vector3 = extractEventFeatures(differentCategory);

            const similarityDifferentPopularity = cosineSimilarity(vector1.fullVector, vector2.fullVector);
            const similarityDifferentCategory = cosineSimilarity(vector1.fullVector, vector3.fullVector);

            // Same category with different popularity should be MORE similar
            // than different category with same popularity
            expect(similarityDifferentPopularity).toBeGreaterThan(similarityDifferentCategory);
        });
    });
});