import { extractEventFeatures, cosineSimilarity } from '@/lib/ml';
import { Event, type IEvent } from '@/lib/models';
import mongoose from 'mongoose';

/**
 * Get trending events based on engagement velocity and recency
 * 
 * Trending score formula:
 * - 50% total engagement (weighted: favourites > clickthroughs > views)
 * - 30% velocity (engagement per day since listing)
 * - 20% popularity percentile within category
 * - Boosted by event proximity (happening soon)
 * 
 * @param options.limit - Maximum events to return
 * @param options.category - Filter by category
 * @param options.minDate - Only events after this date
 */
export async function getTrendingEvents(options: {
    limit?: number;
    category?: string;
    minDate?: Date;
} = {}): Promise<IEvent[]> {
    const { limit = 20, category, minDate = new Date() } = options;

    const query: any = {
        startDate: { $gte: minDate },
        $or: [
            { isArchived: false },
            { isArchived: { $exists: false } }
        ],
        $and: [
            {
                $or: [
                    { 'stats.favouriteCount': { $gte: 1 } },
                    { 'stats.clickthroughCount': { $gte: 1 } },
                    { 'stats.viewCount': { $gte: 5 } }
                ]
            }
        ]
    };
    if (category) query.category = category;

    const events = await Event.find(query).limit(200).lean();

    // Score and sort by trending score
    const scored = events.map(event => ({
        event,
        score: calculateTrendingScore(event),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(item => item.event);
}

/**
 * Calculate trending score combining engagement, velocity, and recency
 */
function calculateTrendingScore(event: IEvent): number {
    const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};

    // Weighted engagement
    const totalEngagement = viewCount * 0.1 + favouriteCount * 5 + clickthroughCount * 3;

    // Velocity (engagement per day)
    const daysSinceListed = Math.max(1, (Date.now() - event.scrapedAt.getTime()) / (1000 * 60 * 60 * 24));
    const velocity = totalEngagement / daysSinceListed;

    // Recency boost (events happening soon get priority)
    const daysUntilEvent = (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0.5, 1 - (daysUntilEvent / 90));

    // Category popularity
    const popularity = event.stats?.categoryPopularityPercentile ?? 0.5;

    // Combined score
    return (
        totalEngagement * 0.5 +
        velocity * 10 * 0.3 +
        popularity * 100 * 0.2
    ) * recencyBoost;
}

/**
 * Get undiscovered gems - quality venues with low engagement
 * 
 * Target: Events with high raw popularity score (good venue/price)
 * but low user engagement (not yet discovered)
 */
export async function getUndiscoveredGems(options: {
    limit?: number;
    category?: string;
} = {}): Promise<IEvent[]> {
    const { limit = 20, category } = options;

    const query: any = {
        startDate: { $gte: new Date() },
        $or: [
            { isArchived: false },
            { isArchived: { $exists: false } }
        ],
        'stats.favouriteCount': { $lte: 2 },
        'stats.viewCount': { $lte: 20 },
        'stats.rawPopularityScore': { $gte: 6 }
    };
    if (category) query.category = category;

    const events = await Event.find(query).limit(100).lean();

    // Score by venue quality + recency
    const scored = events.map(event => {
        const venueScore = event.stats?.rawPopularityScore ?? 5;
        const daysUntilEvent = (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - (daysUntilEvent / 90));

        return { event, score: venueScore * 0.7 + recencyScore * 10 * 0.3 };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(item => item.event);
}

/**
 * Get similar events using content-based filtering (vector similarity)
 * 
 * Compares event features (category, subcategories, price, venue, popularity)
 * using cosine similarity to find most similar events
 * 
 * @param eventId - Target event ID
 * @param options.limit - Maximum similar events to return
 */
export async function getSimilarEvents(
    eventId: mongoose.Types.ObjectId,
    options: { limit?: number } = {}
): Promise<Array<{ event: IEvent; similarity: number }>> {
    const { limit = 6 } = options;

    const targetEvent = await Event.findById(eventId).lean();
    if (!targetEvent) return [];

    const targetVector = extractEventFeatures(targetEvent);

    // Get candidates from same category
    const candidates = await Event.find({
        category: targetEvent.category,
        startDate: { $gte: new Date() },
        $or: [
            { isArchived: false },
            { isArchived: { $exists: false } }
        ],
        _id: { $ne: eventId },
    }).limit(50).lean();

    // Calculate similarity scores
    const scored = candidates.map(event => ({
        event,
        similarity: cosineSimilarity(
            targetVector.fullVector,
            extractEventFeatures(event).fullVector
        ),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
}