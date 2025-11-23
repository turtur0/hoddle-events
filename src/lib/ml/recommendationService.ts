import Event from '@/lib/models/Event';
import UserInteraction from '@/lib/models/UserInteraction';
import { extractEventFeatures, cosineSimilarity } from './vectorService';
import mongoose from 'mongoose';
import type { IEvent } from '@/lib/models/Event';
import { CATEGORIES } from '../categories';

// ============================================
// PUBLIC RECOMMENDATIONS (No Auth Required)
// ============================================

/**
 * Get trending/popular events (ENHANCED VERSION)
 * Now uses category-relative popularity + velocity (rate of growth)
 */
export async function getTrendingEvents(options: {
    limit?: number;
    category?: string;
    minDate?: Date;
    trendingWindow?: number; // days to look back for "trending"
} = {}) {
    const { limit = 20, category, minDate = new Date(), trendingWindow = 7 } = options;

    const query: any = { startDate: { $gte: minDate } };
    if (category) query.category = category;

    // Fetch candidates
    const events = await Event.find(query)
        .sort({ startDate: 1 })
        .limit(200) // Get larger pool to score
        .lean();

    // Calculate trending score for each event
    const scoredEvents = events.map(event => {
        const trendingScore = calculateTrendingScore(event, trendingWindow);
        return { event, score: trendingScore };
    });

    // Sort by trending score
    scoredEvents.sort((a, b) => b.score - a.score);

    return scoredEvents.slice(0, limit).map(item => item.event);
}

/**
 * Calculate "trending" score
 * Combines popularity + velocity (recent growth) + recency
 */
function calculateTrendingScore(event: IEvent, windowDays: number): number {
    // 1. Base popularity (40% weight)
    const basePopularity = event.stats?.categoryPopularityPercentile || 0.5;

    // 2. Recent engagement velocity (40% weight)
    // This measures how fast an event is gaining traction
    const velocity = calculateEngagementVelocity(event, windowDays);

    // 3. Recency bonus (20% weight)
    // Events happening soon are more "urgent"
    const daysUntilEvent = (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const recencyScore = 1 / (1 + daysUntilEvent / 30);

    // Combine scores
    const trendingScore =
        0.4 * basePopularity +
        0.4 * velocity +
        0.2 * recencyScore;

    return trendingScore;
}

/**
 * Calculate how quickly an event is gaining engagement
 * High velocity = "going viral", low velocity = steady/declining
 */
function calculateEngagementVelocity(event: IEvent, windowDays: number): number {
    const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};

    // Total engagement
    const totalEngagement = viewCount * 0.1 + favouriteCount * 5 + clickthroughCount * 3;

    // Days since event was added
    const daysSinceListed = (Date.now() - event.scrapedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceListed === 0) {
        return 0.5; // Brand new, neutral velocity
    }

    // Engagement per day
    const engagementPerDay = totalEngagement / daysSinceListed;

    // Normalize using sigmoid (keeps it 0-1)
    const velocityScore = 1 / (1 + Math.exp(-engagementPerDay * 0.1));

    // Boost for recent acceleration
    if (daysSinceListed <= windowDays) {
        return velocityScore * 1.5; // 50% boost for very recent events
    }

    return velocityScore;
}

/**
 * Get category-specific trending events
 * Useful for "Trending in Theatre" sections
 */
export async function getTrendingInCategory(
    category: string,
    options: { limit?: number } = {}
): Promise<IEvent[]> {
    return getTrendingEvents({
        ...options,
        category,
    });
}

/**
 * Get "rising stars" - events with high velocity but not yet mainstream
 * These are the events that are gaining traction fast
 */
export async function getRisingStars(options: {
    limit?: number;
    category?: string;
} = {}): Promise<IEvent[]> {
    const { limit = 20, category } = options;

    const query: any = {
        startDate: { $gte: new Date() },
        // Not yet mainstream (below 70th percentile)
        'stats.categoryPopularityPercentile': { $lt: 0.7 },
        // But has some engagement (not brand new)
        'stats.favouriteCount': { $gte: 10 },
    };

    if (category) query.category = category;

    const events = await Event.find(query).limit(100).lean();

    // Score by velocity
    const scored = events.map(event => ({
        event,
        velocity: calculateEngagementVelocity(event, 7),
    }));

    scored.sort((a, b) => b.velocity - a.velocity);

    return scored.slice(0, limit).map(item => item.event);
}

/**
 * Get similar events to a specific event (works for everyone)
 */
export async function getSimilarEvents(
    eventId: mongoose.Types.ObjectId,
    options: { limit?: number } = {}
) {
    const { limit = 6 } = options;

    const targetEvent = await Event.findById(eventId).lean();
    if (!targetEvent) return [];

    const targetVector = extractEventFeatures(targetEvent);

    // Find similar events in same category
    const candidates = await Event.find({
        category: targetEvent.category,
        startDate: { $gte: new Date() },
        _id: { $ne: eventId },
    })
        .limit(50)
        .lean();

    // Score by similarity
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

// ============================================
// PERSONALIZED RECOMMENDATIONS (Auth Required)
// ============================================

/**
 * Get personalized recommendations for authenticated user
 * Combines user profile with popularity signals
 */
export async function getPersonalizedRecommendations(
    userId: mongoose.Types.ObjectId,
    user: any,
    options: {
        limit?: number;
        category?: string;
        excludeFavorited?: boolean;
    } = {}
) {
    const { limit = 20, category, excludeFavorited = true } = options;

    // Build simple user preference vector from selections
    const userPreferences = buildSimpleUserVector(user);

    // Get candidate events
    const query: any = { startDate: { $gte: new Date() } };
    if (category) query.category = category;
    if (user.preferences?.locations?.length) {
        query['venue.suburb'] = { $in: user.preferences.locations };
    }

    let events = await Event.find(query)
        .limit(200)
        .lean();

    // Exclude favorited events if requested
    if (excludeFavorited) {
        const favorited = await UserInteraction.find({
            userId,
            interactionType: 'favourite',
        }).select('eventId');

        const favIds = new Set(favorited.map(f => f.eventId.toString()));
        events = events.filter(e => !favIds.has(e._id.toString()));
    }

    // Score each event
    const scored = events.map(event => {
        const eventVector = extractEventFeatures(event);
        const contentMatch = cosineSimilarity(userPreferences, eventVector.fullVector);

        // Popularity boost
        const popularity = (event.stats?.favouriteCount || 0) / 100;

        // Combined score
        const score = contentMatch * 0.7 + (popularity * 0.3);

        return {
            event,
            score,
            reason: generateReason(event, user, contentMatch),
        };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(item => ({
        event: item.event,
        score: item.score,
        explanation: { reason: item.reason },
    }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build a simple user preference vector from explicit selections
 */
function buildSimpleUserVector(user: any): number[] {
    const vector: number[] = [];

    // 1. Category weights (6 dimensions) - WEIGHTED
    const categoryWeights = user.preferences?.categoryWeights || {};
    const categories = ['music', 'theatre', 'sports', 'arts', 'family', 'other'];

    for (const cat of categories) {
        // Apply same weighting as events (FEATURE_WEIGHTS.category = 10.0)
        vector.push((categoryWeights[cat] || 0.5) * 10.0);
    }

    // 2. Subcategory vector - must match ALL_SUBCATEGORIES length
    const ALL_SUBCATEGORIES = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );

    // For user preferences, we can't encode specific subcategories easily,
    // so we'll use a neutral approach: slight preference for user's favorite categories
    for (const fullSubcat of ALL_SUBCATEGORIES) {
        const [category] = fullSubcat.split(':');
        const categoryWeight = categoryWeights[category] || 0.5;

        // Apply same weighting as events (FEATURE_WEIGHTS.subcategory = 5.0)
        // Scale down since user doesn't have specific subcategory prefs
        vector.push(categoryWeight * 2.0);
    }

    // 3. Price preference (1 dimension) - WEIGHTED
    const pricePref = user.preferences?.pricePreference || 0.5;
    vector.push(pricePref * 1.0); // FEATURE_WEIGHTS.price = 1.0

    // 4. Venue tier preference (1 dimension) - WEIGHTED
    const venuePref = user.preferences?.venuePreference || 0.5;
    vector.push(venuePref * 1.0); // FEATURE_WEIGHTS.venue = 1.0

    // 5. Popularity preference (1 dimension) - WEIGHTED
    const popPref = user.preferences?.popularityPreference || 0.5;
    vector.push(popPref * 3.0); // FEATURE_WEIGHTS.popularity = 3.0

    return vector;
}

/**
 * Generate human-readable explanation
 */
function generateReason(
    event: IEvent,
    user: any,
    similarity: number
): string {
    if (similarity > 0.8) {
        return `Strong match with your preferences`;
    }
    if (similarity > 0.6) {
        return `Matches your interests`;
    }
    if ((event.stats?.favouriteCount || 0) > 50) {
        return `Popular in ${event.category}`;
    }
    return `Recommended for you`;
}