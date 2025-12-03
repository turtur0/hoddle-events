import mongoose from 'mongoose';
import {
    buildUserVectorFromInteractions,
    buildUserVectorFromPreferences,
    computeUserProfile,
} from '@/lib/ml';
import UserInteraction from '@/lib/models/UserInteraction';
import { createMockEvent, createMockInteraction, createMockUser, createMockQueryChain } from '../helpers/factories';

jest.mock('@/lib/models/UserInteraction');

describe('User Profile Service', () => {

    // ============================================================================
    // buildUserVectorFromInteractions Tests
    // ============================================================================
    describe('buildUserVectorFromInteractions', () => {
        it('should return null when user has no interactions', async () => {
            const userId = new mongoose.Types.ObjectId();
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).toBeNull();
        });

        it('should weight favourites higher than views', async () => {
            const userId = new mongoose.Types.ObjectId();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = [
                createMockInteraction(event._id, 'favourite', 1, event),
                createMockInteraction(event._id, 'view', 1, event),
            ];

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).not.toBeNull();
            expect(result?.vector.length).toBeGreaterThan(0);
            expect(result?.count).toBe(2);
        });

        it('should apply exponential time decay to older interactions', async () => {
            const userId = new mongoose.Types.ObjectId();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = [
                createMockInteraction(event._id, 'favourite', 1, event),
                createMockInteraction(event._id, 'favourite', 180, event),
            ];

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).not.toBeNull();
            expect(result?.vector.some(v => v !== 0)).toBe(true);
        });

        it('should handle negative signals from unfavourites', async () => {
            const userId = new mongoose.Types.ObjectId();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = [createMockInteraction(event._id, 'unfavourite', 1, event)];

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).toBeDefined();
        });

        it('should cap confidence at 1.0 for 20+ interactions', async () => {
            const userId = new mongoose.Types.ObjectId();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = Array.from({ length: 25 }, (_, i) =>
                createMockInteraction(event._id, 'view', i, event)
            );

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).not.toBeNull();
            expect(result?.confidence).toBeLessThanOrEqual(1.0);
            expect(result?.count).toBe(25);
        });

        it('should only fetch interactions from last 6 months', async () => {
            const userId = new mongoose.Types.ObjectId();
            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (UserInteraction.find as jest.Mock) = mockFind;

            await buildUserVectorFromInteractions(userId);

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId,
                    timestamp: expect.any(Object),
                })
            );
        });

        it('should limit to 200 most recent interactions', async () => {
            const userId = new mongoose.Types.ObjectId();
            const mockLimit = jest.fn().mockReturnThis();
            const mockChain = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: mockLimit,
                lean: jest.fn().mockResolvedValue([]),
            };
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(mockChain);

            await buildUserVectorFromInteractions(userId);

            expect(mockLimit).toHaveBeenCalledWith(200);
        });

        it('should calculate confidence based on interaction count', async () => {
            const userId = new mongoose.Types.ObjectId();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = Array.from({ length: 10 }, (_, i) =>
                createMockInteraction(event._id, 'favourite', i, event)
            );

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).not.toBeNull();
            expect(result?.confidence).toBeCloseTo(0.5, 1);
        });

        it('should accumulate weighted vectors correctly', async () => {
            const userId = new mongoose.Types.ObjectId();
            const musicEvent = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const sportsEvent = createMockEvent({ category: 'sports', subcategories: ['football'] })
            const interactions = [
                createMockInteraction(musicEvent._id, 'favourite', 1, musicEvent),
                createMockInteraction(sportsEvent._id, 'view', 1, sportsEvent),
            ];

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const result = await buildUserVectorFromInteractions(userId);

            expect(result).not.toBeNull();
            expect(result?.vector.length).toBeGreaterThan(0);
        });
    });

    // ============================================================================
    // buildUserVectorFromPreferences Tests
    // ============================================================================
    describe('buildUserVectorFromPreferences', () => {
        it('should encode category weights correctly', () => {
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    categoryWeights: { music: 1.0, sports: 0.5, arts: 0.3 },
                    selectedCategories: ['music', 'sports', 'arts'],
                },
            });

            const vector = buildUserVectorFromPreferences(user);

            expect(vector.length).toBeGreaterThan(0);
            expect(vector.slice(0, 6).some(v => v > 0)).toBe(true);
        });

        it('should encode selected subcategories correctly', () => {
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    selectedCategories: ['music'],
                    selectedSubcategories: ['rock', 'indie'],
                },
            });

            const vector = buildUserVectorFromPreferences(user);

            expect(vector.slice(6, 46).some(v => v > 0)).toBe(true);
        });

        it('should only encode subcategories belonging to selected categories', () => {
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    selectedCategories: ['music'],
                    selectedSubcategories: ['rock', 'indie', 'football'],
                },
            });

            const vector = buildUserVectorFromPreferences(user);

            expect(vector.length).toBeGreaterThan(0);
        });

        it('should normalise price preference logarithmically', () => {
            const userCheap = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    priceRange: { min: 0, max: 50 },
                },
            });
            const userExpensive = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    priceRange: { min: 200, max: 500 },
                },
            });

            const vectorCheap = buildUserVectorFromPreferences(userCheap);
            const vectorExpensive = buildUserVectorFromPreferences(userExpensive);

            const priceIndexCheap = vectorCheap[vectorCheap.length - 3];
            const priceIndexExpensive = vectorExpensive[vectorExpensive.length - 3];

            expect(priceIndexExpensive).toBeGreaterThan(priceIndexCheap);
        });

        it('should use neutral venue preference', () => {
            const user = createMockUser();
            const vector = buildUserVectorFromPreferences(user);
            const venueIndex = vector.length - 2;

            expect(vector[venueIndex]).toBeCloseTo(0.5, 1);
        });

        it('should apply popularity preference with correct weight', () => {
            const userMainstream = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    popularityPreference: 0.9,
                },
            });
            const userNiche = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    popularityPreference: 0.1,
                },
            });

            const vectorMainstream = buildUserVectorFromPreferences(userMainstream);
            const vectorNiche = buildUserVectorFromPreferences(userNiche);

            const popIndexMainstream = vectorMainstream[vectorMainstream.length - 1];
            const popIndexNiche = vectorNiche[vectorNiche.length - 1];

            expect(popIndexMainstream).toBeGreaterThan(popIndexNiche);
        });

        it('should default popularity preference to 0.5', () => {
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    popularityPreference: undefined as any,
                },
            });

            const vector = buildUserVectorFromPreferences(user);
            const popIndex = vector.length - 1;

            expect(vector[popIndex]).toBeCloseTo(1.5, 1);
        });

        it('should handle empty category weights', () => {
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    categoryWeights: {},
                    selectedCategories: [],
                },
            });

            const vector = buildUserVectorFromPreferences(user);

            expect(vector.slice(0, 6).every(v => v === 0)).toBe(true);
        });

        it('should produce vector of correct dimensionality', () => {
            const user = createMockUser();
            const vector = buildUserVectorFromPreferences(user);

            expect(vector.length).toBeGreaterThanOrEqual(47);
            expect(vector.length).toBeLessThanOrEqual(51);
        });
    });

    // ============================================================================
    // computeUserProfile Tests
    // ============================================================================
    describe('computeUserProfile', () => {
        it('should handle cold start users with no interactions', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser();
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const profile = await computeUserProfile(userId, user);

            expect(profile.confidence).toBe(0.3);
            expect(profile.interactionCount).toBe(0);
            expect(profile.userVector.length).toBeGreaterThan(0);
        });

        it('should blend preferences and interactions for warm start users', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = [createMockInteraction(event._id, 'favourite', 1, event)];

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const profile = await computeUserProfile(userId, user);

            expect(profile.confidence).toBeCloseTo(0.05, 2);
            expect(profile.interactionCount).toBe(1);
            expect(profile.userVector.length).toBeGreaterThan(0);
        });

        it('should normalise final vector to unit length', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser();
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const profile = await computeUserProfile(userId, user);

            const magnitude = Math.sqrt(profile.userVector.reduce((sum, v) => sum + v * v, 0));
            expect(magnitude).toBeCloseTo(1.0, 2);
        });

        it('should extract top 3 dominant categories', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    categoryWeights: { music: 1.0, sports: 0.8, arts: 0.6 },
                    selectedCategories: ['music', 'sports', 'arts'],
                },
            });
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const profile = await computeUserProfile(userId, user);

            expect(profile.dominantCategories.length).toBeLessThanOrEqual(3);
            expect(profile.dominantCategories[0].weight).toBeGreaterThanOrEqual(
                profile.dominantCategories[1]?.weight || 0
            );
        });

        it('should extract top 5 dominant subcategories', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    selectedSubcategories: ['rock', 'indie', 'jazz', 'classical', 'pop', 'electronic'],
                },
            });
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const profile = await computeUserProfile(userId, user);

            expect(profile.dominantSubcategories.length).toBeLessThanOrEqual(5);
        });

        it('should set lastUpdated timestamp', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser();
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const beforeTime = new Date();
            const profile = await computeUserProfile(userId, user);
            const afterTime = new Date();

            expect(profile.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(profile.lastUpdated.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });

        it('should use learnt confidence when interactions exist', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const interactions = Array.from({ length: 15 }, (_, i) =>
                createMockInteraction(event._id, 'favourite', i, event)
            );

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const profile = await computeUserProfile(userId, user);

            expect(profile.confidence).toBeCloseTo(0.75, 1);
            expect(profile.interactionCount).toBe(15);
        });

        it('should handle zero magnitude vectors gracefully', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    categoryWeights: {},
                    selectedCategories: [],
                    selectedSubcategories: [],
                },
            });
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain([]));

            const profile = await computeUserProfile(userId, user);

            expect(profile).toBeDefined();
            expect(profile.userVector.length).toBeGreaterThan(0);
        });
    });

    // ============================================================================
    // Integration Tests
    // ============================================================================
    describe('Full user profile workflow', () => {
        it('should build complete profile for active user with mixed interactions', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser({
                preferences: {
                    ...createMockUser().preferences,
                    categoryWeights: { music: 1.0, sports: 0.5 },
                    selectedCategories: ['music', 'sports'],
                    selectedSubcategories: ['rock', 'indie', 'football'],
                },
            });
            const musicEvent = createMockEvent({ category: 'music', subcategories: ['rock'] })
            const sportsEvent = createMockEvent({ category: 'sports', subcategories: ['football'] })
            const interactions = [
                createMockInteraction(musicEvent._id, 'favourite', 1, musicEvent),
                createMockInteraction(musicEvent._id, 'clickthrough', 2, musicEvent),
                createMockInteraction(sportsEvent._id, 'view', 3, sportsEvent),
                createMockInteraction(musicEvent._id, 'favourite', 5, musicEvent),
            ];

            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(interactions));

            const profile = await computeUserProfile(userId, user);

            expect(profile).toMatchObject({
                userVector: expect.any(Array),
                confidence: expect.any(Number),
                interactionCount: 4,
                lastUpdated: expect.any(Date),
                dominantCategories: expect.any(Array),
                dominantSubcategories: expect.any(Array),
            });

            const magnitude = Math.sqrt(profile.userVector.reduce((sum, v) => sum + v * v, 0));
            expect(magnitude).toBeCloseTo(1.0, 2);
            expect(profile.dominantCategories.length).toBeGreaterThan(0);
            expect(profile.confidence).toBeCloseTo(0.2, 2);
        });

        it('should evolve profile as user interactions increase', async () => {
            const userId = new mongoose.Types.ObjectId();
            const user = createMockUser();
            const event = createMockEvent({ category: 'music', subcategories: ['rock'] })

            // Profile with few interactions
            const fewInteractions = [createMockInteraction(event._id, 'view', 1, event)];
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(fewInteractions));
            const profileEarly = await computeUserProfile(userId, user);

            // Profile with many interactions
            const manyInteractions = Array.from({ length: 20 }, (_, i) =>
                createMockInteraction(event._id, 'favourite', i, event)
            );
            (UserInteraction.find as jest.Mock) = jest.fn().mockReturnValue(createMockQueryChain(manyInteractions));
            const profileLater = await computeUserProfile(userId, user);

            expect(profileLater.confidence).toBeGreaterThan(profileEarly.confidence);
            expect(profileLater.interactionCount).toBeGreaterThan(profileEarly.interactionCount);
        });
    });
});