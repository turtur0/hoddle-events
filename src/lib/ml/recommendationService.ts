// ============================================
// lib/ml/recommendation-service.ts
// ============================================

import { extractEventFeatures, cosineSimilarity } from '@/lib/ml';
import { CATEGORIES } from '../constants/categories';
import { Event, UserInteraction, type IEvent } from '@/lib/models';
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
            { 'stats.favouriteCount': { $gte: 1 } },
            { 'stats.clickthroughCount': { $gte: 1 } },
            { 'stats.viewCount': { $gte: 5 } }
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
 * Get rising stars - fast-growing events not yet mainstream
 * 
 * Target: Events with high velocity but below 70th percentile popularity
 */
export async function getRisingStars(options: {
    limit?: number;
    category?: string;
} = {}): Promise<IEvent[]> {
    const { limit = 20, category } = options;

    const query: any = {
        startDate: { $gte: new Date() },
        'stats.categoryPopularityPercentile': { $lt: 0.7 },
        $or: [
            { 'stats.favouriteCount': { $gte: 2 } },
            { 'stats.clickthroughCount': { $gte: 3 } },
            { 'stats.viewCount': { $gte: 15 } }
        ]
    };
    if (category) query.category = category;

    const events = await Event.find(query).limit(100).lean();

    // Score by velocity
    const scored = events.map(event => {
        const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};
        const totalEngagement = viewCount * 0.1 + favouriteCount * 5 + clickthroughCount * 3;
        const daysSinceListed = Math.max(1, (Date.now() - event.scrapedAt.getTime()) / (1000 * 60 * 60 * 24));
        const velocity = totalEngagement / daysSinceListed;

        return { event, velocity };
    });

    scored.sort((a, b) => b.velocity - a.velocity);
    return scored.slice(0, limit).map(item => item.event);
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



/**
 * Build simple user preference vector from user settings
 * Matches structure of event feature vectors for similarity calculation
 */
function buildSimpleUserVector(user: any): number[] {
    const vector: number[] = [];
    const categoryWeights = user.preferences?.categoryWeights || {};

    // Category weights
    for (const cat of ['music', 'theatre', 'sports', 'arts', 'family', 'other']) {
        vector.push((categoryWeights[cat] || 0.5) * 10.0);
    }

    // Subcategory weights
    const allSubcategories = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );

    for (const fullSubcat of allSubcategories) {
        const [category] = fullSubcat.split(':');
        const categoryWeight = categoryWeights[category] || 0.5;
        vector.push(categoryWeight * 2.0);
    }

    // Additional preferences
    vector.push((user.preferences?.pricePreference || 0.5) * 1.0);
    vector.push((user.preferences?.venuePreference || 0.5) * 1.0);
    vector.push((user.preferences?.popularityPreference || 0.5) * 3.0);

    return vector;
}

/**
 * Generate human-readable recommendation reason
 */
function generateReason(event: IEvent, user: any, similarity: number): string {
    if (similarity > 0.8) return 'Strong match with your preferences';
    if (similarity > 0.6) return 'Matches your interests';
    if ((event.stats?.favouriteCount || 0) > 50) return `Popular in ${event.category}`;
    return 'Recommended for you';
}