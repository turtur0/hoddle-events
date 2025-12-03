import mongoose from 'mongoose';
import {
    getTrendingEvents,
    getUndiscoveredGems,
    getSimilarEvents,
} from '@/lib/ml/recommendation-service';
import { Event } from '@/lib/models'; 
import { createMockEvent, createMockQueryChain } from '../helpers/factories';

jest.mock('@/lib/models/Event');

describe('Recommendation Service - Discovery Algorithms', () => {

    // ============================================================================
    // getTrendingEvents Tests
    // ============================================================================
    describe('getTrendingEvents', () => {
        it('should return events sorted by trending score', async () => {
            const highEngagementEvent = createMockEvent({
                title: 'High Engagement',
                stats: {
                    viewCount: 100,
                    favouriteCount: 20,
                    clickthroughCount: 15,
                    categoryPopularityPercentile: 0.8,
                },
                scrapedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            });
            const lowEngagementEvent = createMockEvent({
                title: 'Low Engagement',
                stats: {
                    viewCount: 5,
                    favouriteCount: 1,
                    clickthroughCount: 1,
                    categoryPopularityPercentile: 0.3,
                },
            });

            (Event.find as jest.Mock) = jest.fn().mockReturnValue(
                createMockQueryChain([highEngagementEvent, lowEngagementEvent])
            );

            const results = await getTrendingEvents({ limit: 2 });

            expect(results[0].title).toBe('High Engagement');
            expect(results.length).toBeLessThanOrEqual(2);
        });

        it('should filter by category when specified', async () => {
            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getTrendingEvents({ category: 'sports' });

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'sports' })
            );
        });

        it('should only return future events', async () => {
            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getTrendingEvents();

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate: expect.objectContaining({ $gte: expect.any(Date) }),
                })
            );
        });

        it('should prioritise events with high velocity', async () => {
            const recentHighVelocity = createMockEvent({
                title: 'Recent High Velocity',
                stats: {
                    viewCount: 50,
                    favouriteCount: 10,
                    clickthroughCount: 8,
                    categoryPopularityPercentile: 0.5,
                },
                scrapedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            });
            const oldLowVelocity = createMockEvent({
                title: 'Old Low Velocity',
                stats: {
                    viewCount: 50,
                    favouriteCount: 10,
                    clickthroughCount: 8,
                    categoryPopularityPercentile: 0.5,
                },
                scrapedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            });

            (Event.find as jest.Mock) = jest.fn().mockReturnValue(
                createMockQueryChain([oldLowVelocity, recentHighVelocity])
            );

            const results = await getTrendingEvents({ limit: 2 });

            expect(results[0].title).toBe('Recent High Velocity');
        });

        it('should boost events happening soon', async () => {
            const soonEvent = createMockEvent({
                title: 'Soon Event',
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                stats: {
                    viewCount: 20,
                    favouriteCount: 5,
                    clickthroughCount: 3,
                    categoryPopularityPercentile: 0.5,
                },
            });
            const laterEvent = createMockEvent({
                title: 'Later Event',
                startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                stats: {
                    viewCount: 20,
                    favouriteCount: 5,
                    clickthroughCount: 3,
                    categoryPopularityPercentile: 0.5,
                },
            });

            (Event.find as jest.Mock) = jest.fn().mockReturnValue(
                createMockQueryChain([laterEvent, soonEvent])
            );

            const results = await getTrendingEvents({ limit: 2 });

            expect(results[0].title).toBe('Soon Event');
        });
    });

    // ============================================================================
    // getUndiscoveredGems Tests
    // ============================================================================
    describe('getUndiscoveredGems', () => {
        it('should return events with high venue score but low engagement', async () => {
            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getUndiscoveredGems();

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({
                    'stats.favouriteCount': { $lte: 2 },
                    'stats.viewCount': { $lte: 20 },
                    'stats.rawPopularityScore': { $gte: 6 },
                })
            );
        });

        it('should prioritise high venue quality', async () => {
            const highQualityEvent = createMockEvent({
                title: 'High Quality Venue',
                stats: {
                    viewCount: 10,
                    favouriteCount: 1,
                    clickthroughCount: 1,
                    rawPopularityScore: 9,
                },
            });
            const mediumQualityEvent = createMockEvent({
                title: 'Medium Quality Venue',
                stats: {
                    viewCount: 10,
                    favouriteCount: 1,
                    clickthroughCount: 1,
                    rawPopularityScore: 6,
                },
            });

            (Event.find as jest.Mock) = jest.fn().mockReturnValue(
                createMockQueryChain([mediumQualityEvent, highQualityEvent])
            );

            const results = await getUndiscoveredGems({ limit: 2 });

            expect(results[0].title).toBe('High Quality Venue');
        });

        it('should filter by category when specified', async () => {
            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getUndiscoveredGems({ category: 'theatre' });

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'theatre' })
            );
        });
    });

    // ============================================================================
    // getSimilarEvents Tests
    // ============================================================================
    describe('getSimilarEvents', () => {
        it('should return events from same category sorted by similarity', async () => {
            const targetEvent = createMockEvent({ category: 'music', subcategories: ['rock'] });
            const similarEvent1 = createMockEvent({ category: 'music', subcategories: ['rock', 'indie'] });
            const similarEvent2 = createMockEvent({ category: 'music', subcategories: ['jazz'] });

            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(targetEvent),
            });
            (Event.find as jest.Mock) = jest.fn().mockReturnValue(
                createMockQueryChain([similarEvent1, similarEvent2])
            );

            const results = await getSimilarEvents(targetEvent._id, { limit: 2 });

            expect(results.length).toBeLessThanOrEqual(2);
            expect(results[0].similarity).toBeGreaterThanOrEqual(results[1]?.similarity || 0);
        });

        it('should exclude the target event itself', async () => {
            const targetEventId = new mongoose.Types.ObjectId();
            const targetEvent = createMockEvent({ _id: targetEventId, category: 'music' });

            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(targetEvent),
            });

            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getSimilarEvents(targetEventId);

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({ _id: { $ne: targetEventId } })
            );
        });

        it('should return empty array if target event not found', async () => {
            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });

            const results = await getSimilarEvents(new mongoose.Types.ObjectId());

            expect(results).toEqual([]);
        });

        it('should only return future events', async () => {
            const targetEvent = createMockEvent({ category: 'music' });

            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(targetEvent),
            });

            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getSimilarEvents(targetEvent._id);

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate: expect.objectContaining({ $gte: expect.any(Date) }),
                })
            );
        });

        it('should filter by same category as target', async () => {
            const targetEvent = createMockEvent({ category: 'sports' });

            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(targetEvent),
            });

            const mockFind = jest.fn().mockReturnValue(createMockQueryChain([]));
            (Event.find as jest.Mock) = mockFind;

            await getSimilarEvents(targetEvent._id);

            expect(mockFind).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'sports' })
            );
        });

        it('should limit candidates to 50 for performance', async () => {
            const targetEvent = createMockEvent({ category: 'music' });

            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(targetEvent),
            });

            const mockLimit = jest.fn().mockReturnThis();
            const mockChain = {
                limit: mockLimit,
                lean: jest.fn().mockResolvedValue([]),
            };
            (Event.find as jest.Mock) = jest.fn().mockReturnValue(mockChain);

            await getSimilarEvents(targetEvent._id);

            expect(mockLimit).toHaveBeenCalledWith(50);
        });

        it('should return similarity scores between 0 and 1', async () => {
            const targetEvent = createMockEvent({ category: 'music' });
            const candidateEvents = [
                createMockEvent({ category: 'music', subcategories: ['rock'] }),
                createMockEvent({ category: 'music', subcategories: ['jazz'] }),
            ];

            (Event.findById as jest.Mock) = jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(targetEvent),
            });
            (Event.find as jest.Mock) = jest.fn().mockReturnValue(
                createMockQueryChain(candidateEvents)
            );

            const results = await getSimilarEvents(targetEvent._id);

            results.forEach(result => {
                expect(result.similarity).toBeGreaterThanOrEqual(0);
                expect(result.similarity).toBeLessThanOrEqual(1);
            });
        });
    });
});