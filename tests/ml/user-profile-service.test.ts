// tests/ml/userProfileService.test.ts

import {
    buildUserVectorFromPreferences,
    computeUserProfile,
    scoreEventForUser,
} from '@/lib/ml/userProfileService';
import { extractEventFeatures } from '@/lib/ml/vectorService';
import { IUser } from '@/lib/models/User';
import { IEvent } from '@/lib/models/Event';
import mongoose from 'mongoose';

describe('User Profile Service', () => {
    // Mock user with explicit preferences
    const mockUser: IUser = {
        email: 'test@example.com',
        name: 'Test User',
        provider: 'credentials',
        preferences: {
            selectedCategories: ['theatre', 'music'],
            selectedSubcategories: ['Musicals', 'Rock & Alternative'],
            categoryWeights: { theatre: 0.7, music: 0.3 },
            priceRange: { min: 50, max: 200 },
            popularityPreference: 0.6, // Slightly prefers mainstream
            locations: ['Melbourne'],
            notifications: {
                inApp: true,
                email: false,
                emailFrequency: 'weekly',
                keywords: [],
                smartFiltering: {
                    enabled: false,
                    minRecommendationScore: 0
                }
            },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        favorites: []
    };

    // Mock events for testing
    const musicalEvent: IEvent = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Hamilton',
        description: 'An American Musical',
        category: 'theatre',
        subcategories: ['Musicals'],
        startDate: new Date('2025-12-15T19:30:00'),
        endDate: new Date('2025-12-15T22:00:00'),
        venue: { name: 'Princess Theatre', address: '123 St', suburb: 'Melbourne' },
        priceMin: 150,
        priceMax: 299,
        priceDetails: 'Adult $150-299',
        isFree: false,
        bookingUrl: 'https://example.com/hamilton',
        sources: ['ticketmaster'],
        primarySource: 'ticketmaster',
        sourceIds: { ticketmaster: 'tm123' },
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        stats: { viewCount: 1000, favouriteCount: 200, clickthroughCount: 100 },
    };

    const rockConcert: IEvent = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Arctic Monkeys',
        description: 'Live in concert',
        category: 'music',
        subcategories: ['Rock & Alternative'],
        startDate: new Date('2025-11-20T20:00:00'),
        venue: { name: 'Forum Melbourne', address: '456 St', suburb: 'Melbourne' },
        priceMin: 85,
        priceMax: 120,
        isFree: false,
        bookingUrl: 'https://example.com/arctic',
        sources: ['ticketmaster'],
        primarySource: 'ticketmaster',
        sourceIds: { ticketmaster: 'tm456' },
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        stats: { viewCount: 500, favouriteCount: 100, clickthroughCount: 50 },
    };

    const sportsEvent: IEvent = {
        _id: new mongoose.Types.ObjectId(),
        title: 'AFL Grand Final',
        description: 'Championship game',
        category: 'sports',
        subcategories: ['AFL'],
        startDate: new Date('2025-09-28T14:30:00'),
        venue: { name: 'MCG', address: '789 St', suburb: 'Melbourne' },
        priceMin: 200,
        priceMax: 500,
        isFree: false,
        bookingUrl: 'https://example.com/afl',
        sources: ['ticketmaster'],
        primarySource: 'ticketmaster',
        sourceIds: { ticketmaster: 'tm789' },
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        stats: { viewCount: 5000, favouriteCount: 1000, clickthroughCount: 500 },
    };

    describe('buildUserVectorFromPreferences', () => {
        it('should create vector from user preferences', () => {
            const vector = buildUserVectorFromPreferences(mockUser);

            expect(vector).toBeDefined();
            expect(vector.length).toBeGreaterThan(0);
            expect(vector.every(v => typeof v === 'number')).toBe(true);
            expect(vector.every(v => !isNaN(v))).toBe(true);
        });

        it('should weight categories according to user preferences', () => {
            const vector = buildUserVectorFromPreferences(mockUser);

            // Theatre (index 1) should have higher weight than music (index 0)
            // because user prefers theatre (0.7) over music (0.3)
            const theatreWeight = vector[1]; // theatre is second category
            const musicWeight = vector[0]; // music is first category

            expect(theatreWeight).toBeGreaterThan(musicWeight);
        });

        it('should handle users with no category preferences', () => {
            const userNoPref: IUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    selectedCategories: [],
                    categoryWeights: {},
                },
            };

            const vector = buildUserVectorFromPreferences(userNoPref);

            expect(vector).toBeDefined();
            expect(vector.length).toBeGreaterThan(0);
            // All category weights should be 0
            const categoryWeights = vector.slice(0, 6); // First 6 are categories
            expect(categoryWeights.every(w => w === 0)).toBe(true);
        });

        it('should encode selected subcategories', () => {
            const vector = buildUserVectorFromPreferences(mockUser);

            // Some subcategory dimensions should be non-zero
            // (subcategories start after the 6 main categories)
            const subcategoryWeights = vector.slice(6, 46); // Approximate subcategory range
            const activeSubcats = subcategoryWeights.filter(w => w > 0);

            expect(activeSubcats.length).toBeGreaterThan(0);
        });

        it('should normalize price to reasonable range', () => {
            const vector = buildUserVectorFromPreferences(mockUser);

            // Price is near the end of the vector
            const priceIdx = vector.length - 3; // Third from end
            const priceValue = vector[priceIdx];

            expect(priceValue).toBeGreaterThanOrEqual(0);
            expect(priceValue).toBeLessThanOrEqual(1);
        });

        it('should encode popularity preference', () => {
            const vector = buildUserVectorFromPreferences(mockUser);

            // Popularity is at the end
            const popValue = vector[vector.length - 1];

            // User's preference is 0.6, scaled by 3.0
            expect(popValue).toBeCloseTo(0.6 * 3.0, 1);
        });
    });

    describe('scoreEventForUser', () => {
        it('should score events based on user preferences', () => {
            const userProfile = {
                userVector: buildUserVectorFromPreferences(mockUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'theatre', weight: 0.7 }],
                dominantSubcategories: [{ subcategory: 'Musicals', weight: 0.5 }],
            };

            const scored = scoreEventForUser(userProfile, musicalEvent, mockUser, []);

            expect(scored.score).toBeDefined();
            expect(scored.score).toBeGreaterThan(0);
            expect(scored.explanation).toBeDefined();
            expect(scored.explanation.contentSimilarity).toBeGreaterThanOrEqual(0);
            expect(scored.explanation.contentSimilarity).toBeLessThanOrEqual(1);
        });

        it('should give higher scores to events matching user preferences', () => {
            const userProfile = {
                userVector: buildUserVectorFromPreferences(mockUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'theatre', weight: 0.7 }],
                dominantSubcategories: [{ subcategory: 'Musicals', weight: 0.5 }],
            };

            const musicalScore = scoreEventForUser(userProfile, musicalEvent, mockUser, []);
            const sportsScore = scoreEventForUser(userProfile, sportsEvent, mockUser, []);

            // User prefers theatre, so musical should score higher than sports
            expect(musicalScore.score).toBeGreaterThan(sportsScore.score);
        });

        it('should boost popular events for mainstream users', () => {
            const mainstreamUser: IUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    popularityPreference: 0.9, // Very mainstream
                },
            };

            const userProfile = {
                userVector: buildUserVectorFromPreferences(mainstreamUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'music', weight: 0.5 }],
                dominantSubcategories: [],
            };

            const popularEvent = { ...rockConcert, stats: { viewCount: 10000, favouriteCount: 2000, clickthroughCount: 1000 } };
            const nicheEvent = { ...rockConcert, stats: { viewCount: 10, favouriteCount: 2, clickthroughCount: 1 } };

            const popularScore = scoreEventForUser(userProfile, popularEvent, mainstreamUser, []);
            const nicheScore = scoreEventForUser(userProfile, nicheEvent, mainstreamUser, []);

            // Mainstream user should prefer popular event
            expect(popularScore.explanation.popularityBoost).toBeGreaterThan(
                nicheScore.explanation.popularityBoost
            );
        });

        it('should boost niche events for indie users', () => {
            const indieUser: IUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    popularityPreference: 0.2, // Very niche
                },
            };

            const userProfile = {
                userVector: buildUserVectorFromPreferences(indieUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'music', weight: 0.5 }],
                dominantSubcategories: [],
            };

            const popularEvent = { ...rockConcert, stats: { viewCount: 10000, favouriteCount: 2000, clickthroughCount: 1000 } };
            const nicheEvent = { ...rockConcert, stats: { viewCount: 10, favouriteCount: 2, clickthroughCount: 1 } };

            const popularScore = scoreEventForUser(userProfile, popularEvent, indieUser, []);
            const nicheScore = scoreEventForUser(userProfile, nicheEvent, indieUser, []);

            // Indie user should prefer niche event
            expect(nicheScore.explanation.popularityBoost).toBeGreaterThan(
                popularScore.explanation.popularityBoost
            );
        });

        it('should boost upcoming events over distant ones', () => {
            const userProfile = {
                userVector: buildUserVectorFromPreferences(mockUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'music', weight: 0.5 }],
                dominantSubcategories: [],
            };

            const upcomingEvent = {
                ...rockConcert,
                _id: new mongoose.Types.ObjectId(),
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            };

            const distantEvent = {
                ...rockConcert,
                _id: new mongoose.Types.ObjectId(),
                startDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
            };

            const upcomingScore = scoreEventForUser(userProfile, upcomingEvent, mockUser, []);
            const distantScore = scoreEventForUser(userProfile, distantEvent, mockUser, []);

            expect(upcomingScore.explanation.temporalRelevance).toBeGreaterThan(
                distantScore.explanation.temporalRelevance
            );
        });

        it('should provide explanations for scores', () => {
            const userProfile = {
                userVector: buildUserVectorFromPreferences(mockUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'theatre', weight: 0.7 }],
                dominantSubcategories: [{ subcategory: 'Musicals', weight: 0.5 }],
            };

            const scored = scoreEventForUser(userProfile, musicalEvent, mockUser, []);

            expect(scored.explanation.reason).toBeDefined();
            expect(typeof scored.explanation.reason).toBe('string');
            expect(scored.explanation.reason.length).toBeGreaterThan(0);
        });

        it('should apply novelty bonus for diverse recommendations', () => {
            const userProfile = {
                userVector: buildUserVectorFromPreferences(mockUser),
                confidence: 0.8,
                interactionCount: 50,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'theatre', weight: 0.9 }],
                dominantSubcategories: [{ subcategory: 'Musicals', weight: 0.8 }],
            };

            // Recent favorites are all musicals
            const recentFavorites = [
                extractEventFeatures(musicalEvent),
                extractEventFeatures({ ...musicalEvent, _id: new mongoose.Types.ObjectId() }),
            ];

            // Score another musical vs a rock concert
            const anotherMusical = { ...musicalEvent, _id: new mongoose.Types.ObjectId(), title: 'Phantom' };
            const musicalScore = scoreEventForUser(userProfile, anotherMusical, mockUser, recentFavorites);
            const rockScore = scoreEventForUser(userProfile, rockConcert, mockUser, recentFavorites);

            // Rock concert should get novelty bonus despite lower content similarity
            expect(rockScore.explanation.noveltyBonus).toBeGreaterThan(
                musicalScore.explanation.noveltyBonus
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle users with minimal data', () => {
            const minimalUser: IUser = {
                ...mockUser,
                preferences: {
                    selectedCategories: [],
                    selectedSubcategories: [],
                    categoryWeights: {},
                    priceRange: { min: 0, max: 500 },
                    popularityPreference: 0.5,
                    locations: [],
                    notifications: {
                        inApp: true,
                        email: false,
                        emailFrequency: 'weekly',
                        keywords: [],
                        smartFiltering: {
                            enabled: false,
                            minRecommendationScore: 0
                        }
                    },
                },
            };

            const vector = buildUserVectorFromPreferences(minimalUser);

            expect(vector).toBeDefined();
            expect(vector.length).toBeGreaterThan(0);
            // Should not crash or return invalid data
        });

        it('should handle free events correctly', () => {
            const freeEvent: IEvent = {
                ...musicalEvent,
                _id: new mongoose.Types.ObjectId(),
                priceMin: undefined,
                priceMax: undefined,
                isFree: true,
            };

            const userProfile = {
                userVector: buildUserVectorFromPreferences(mockUser),
                confidence: 0.5,
                interactionCount: 10,
                lastUpdated: new Date(),
                dominantCategories: [{ category: 'theatre', weight: 0.7 }],
                dominantSubcategories: [],
            };

            const scored = scoreEventForUser(userProfile, freeEvent, mockUser, []);

            expect(scored.score).toBeDefined();
            expect(scored.score).toBeGreaterThan(0);
            // Should not crash on undefined prices
        });
    });
});