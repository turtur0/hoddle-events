// lib/ml/userProfileService.ts

import { IUser } from '@/lib/models/User';
import { IEvent } from '@/lib/models/Event';
import UserInteraction, { IUserInteraction } from '@/lib/models/UserInteraction';
import UserFavourite from '@/lib/models/UserFavourites';
import Event from '@/lib/models/Event';
import { extractEventFeatures, cosineSimilarity, EventVector } from './vectorService';
import { CATEGORIES } from '../categories';
import mongoose from 'mongoose';

// ============================================
// CONFIGURATION
// ============================================

// Interaction signal strengths
const INTERACTION_WEIGHTS = {
    favourite: 5.0,      // Strong positive signal
    unfavourite: -3.0,   // Negative signal
    clickthrough: 3.0,   // Medium-strong signal
    view: 1.0,          // Weak signal
};

// Time decay configuration
const TIME_DECAY_LAMBDA = 0.01; // Decay rate (0.01 = ~30 day half-life)

// Regularization: blend explicit preferences with learned behavior
const REGULARIZATION_LAMBDA = 0.3; // 30% explicit, 70% learned

// Scoring weights
const SCORING_WEIGHTS = {
    contentSimilarity: 0.6,   // Main factor: how similar to user preferences
    popularityBoost: 0.2,     // Secondary: match user's popularity preference
    noveltyBonus: 0.1,        // Tertiary: diversity injection
    temporalRelevance: 0.1,   // Tertiary: urgency for upcoming events
};

// Diversity configuration
const DIVERSITY_PREFERENCE = 0.3; // 30% boost for novel recommendations

// ============================================
// TYPES
// ============================================

export interface UserProfile {
    userVector: number[];
    confidence: number;          // 0-1: how confident we are in this profile
    interactionCount: number;
    lastUpdated: Date;
    dominantCategories: Array<{ category: string; weight: number }>;
    dominantSubcategories: Array<{ subcategory: string; weight: number }>;
}

export interface ScoredEvent {
    event: IEvent;
    score: number;
    explanation: {
        contentSimilarity: number;
        popularityBoost: number;
        noveltyBonus: number;
        temporalRelevance: number;
        reason: string;
    };
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Build user vector from interaction history
 * Uses weighted average with time decay and interaction strength
 */
export async function buildUserVectorFromInteractions(
    userId: mongoose.Types.ObjectId
): Promise<{ vector: number[]; confidence: number; count: number } | null> {
    // Fetch recent interactions (last 6 months to keep it manageable)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const interactions = await UserInteraction.find({
        userId,
        timestamp: { $gte: sixMonthsAgo },
    })
        .populate('eventId')
        .sort({ timestamp: -1 })
        .limit(200) // Cap at 200 most recent interactions
        .lean();

    if (interactions.length === 0) {
        return null; // No interaction data
    }

    // Extract event vectors and compute weighted average
    const now = Date.now();
    let weightedSum: number[] = [];
    let totalWeight = 0;

    for (const interaction of interactions) {
        const event = interaction.eventId as unknown as IEvent;
        if (!event || !event._id) continue;

        // Get event vector
        const eventVector = extractEventFeatures(event);

        // Compute time decay weight
        const daysSince = (now - interaction.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const timeWeight = Math.exp(-TIME_DECAY_LAMBDA * daysSince);

        // Get interaction strength
        const interactionWeight = INTERACTION_WEIGHTS[interaction.interactionType] || 0;

        // Combined weight
        const weight = timeWeight * interactionWeight;

        if (weight <= 0) continue; // Skip negative or zero weights

        // Weighted sum
        if (weightedSum.length === 0) {
            weightedSum = eventVector.fullVector.map(v => v * weight);
        } else {
            for (let i = 0; i < eventVector.fullVector.length; i++) {
                weightedSum[i] += eventVector.fullVector[i] * weight;
            }
        }

        totalWeight += weight;
    }

    if (totalWeight === 0) {
        return null;
    }

    // Compute average
    const averageVector = weightedSum.map(v => v / totalWeight);

    // Compute confidence based on interaction count
    const confidence = Math.min(interactions.length / 20, 1.0);

    return {
        vector: averageVector,
        confidence,
        count: interactions.length,
    };
}

/**
 * Build user vector from explicit preferences
 * This is the "prior" in Bayesian terms
 */
export function buildUserVectorFromPreferences(user: IUser): number[] {
    const priorVector: number[] = [];

    // 1. Category preferences (one-hot weighted by user's category weights)
    const categoryWeights = user.preferences.categoryWeights || {};
    const MAIN_CATEGORIES = CATEGORIES.map(cat => cat.value);

    for (const category of MAIN_CATEGORIES) {
        const weight = categoryWeights[category] || 0;
        priorVector.push(weight * 10.0); // Scale by category feature weight
    }

    // 2. Subcategory preferences (multi-hot for selected subcategories)
    const selectedSubcats = user.preferences.selectedSubcategories || [];
    const ALL_SUBCATEGORIES = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );

    for (const fullSubcat of ALL_SUBCATEGORIES) {
        const [category, subcat] = fullSubcat.split(':');
        const isSelected = selectedSubcats.includes(subcat) &&
            user.preferences.selectedCategories.includes(category);
        priorVector.push(isSelected ? 5.0 : 0); // Scale by subcategory feature weight
    }

    // 3. Price preference (normalized middle of user's range)
    const priceMiddle = (user.preferences.priceRange.min + user.preferences.priceRange.max) / 2;
    const priceNormalized = Math.log10(priceMiddle + 1) / Math.log10(500 + 1);
    priorVector.push(priceNormalized * 1.0); // Scale by price feature weight

    // 4. Venue tier (default to mid-tier, no strong preference)
    priorVector.push(0.5 * 1.0); // Scale by venue feature weight

    // 5. Popularity preference
    const popPref = user.preferences.popularityPreference || 0.5;
    priorVector.push(popPref * 3.0); // Scale by popularity feature weight

    return priorVector;
}

/**
 * Compute complete user profile
 * Combines interaction-based learning with explicit preferences
 */
export async function computeUserProfile(
    userId: mongoose.Types.ObjectId,
    user: IUser
): Promise<UserProfile> {
    // Get learned vector from interactions
    const learnedData = await buildUserVectorFromInteractions(userId);

    // Get prior vector from preferences
    const priorVector = buildUserVectorFromPreferences(user);

    let finalVector: number[];
    let confidence: number;
    let interactionCount: number;

    if (!learnedData) {
        // Cold start: use only explicit preferences
        finalVector = priorVector;
        confidence = 0.3; // Low confidence for new users
        interactionCount = 0;
    } else {
        // Regularized combination: blend prior and learned
        finalVector = [];
        for (let i = 0; i < priorVector.length; i++) {
            const blended =
                REGULARIZATION_LAMBDA * priorVector[i] +
                (1 - REGULARIZATION_LAMBDA) * (learnedData.vector[i] || 0);
            finalVector.push(blended);
        }
        confidence = learnedData.confidence;
        interactionCount = learnedData.count;
    }

    // Normalize to unit length (L2 normalization)
    const magnitude = Math.sqrt(finalVector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
        finalVector = finalVector.map(v => v / magnitude);
    }

    // Extract dominant categories and subcategories for explainability
    const MAIN_CATEGORIES = CATEGORIES.map(cat => cat.value);
    const dominantCategories = MAIN_CATEGORIES
        .map((cat, idx) => ({ category: cat, weight: finalVector[idx] || 0 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

    const ALL_SUBCATEGORIES = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );
    const subcatStartIdx = MAIN_CATEGORIES.length;
    const dominantSubcategories = ALL_SUBCATEGORIES
        .map((subcat, idx) => ({
            subcategory: subcat.split(':')[1],
            weight: finalVector[subcatStartIdx + idx] || 0,
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5);

    return {
        userVector: finalVector,
        confidence,
        interactionCount,
        lastUpdated: new Date(),
        dominantCategories,
        dominantSubcategories,
    };
}

/**
 * Score a single event for a user
 * Returns score + detailed explanation
 */
export function scoreEventForUser(
    userProfile: UserProfile,
    event: IEvent,
    user: IUser,
    recentFavoriteVectors: EventVector[]
): ScoredEvent {
    const eventVector = extractEventFeatures(event);

    // 1. Content similarity (main factor)
    const contentSimilarity = cosineSimilarity(userProfile.userVector, eventVector.fullVector);

    // 2. Popularity boost (match user's popularity preference)
    const userPopPref = user.preferences.popularityPreference || 0.5;
    let popularityBoost: number;

    if (userPopPref > 0.7) {
        // User prefers mainstream
        popularityBoost = eventVector.popularityScore;
    } else if (userPopPref < 0.3) {
        // User prefers niche
        popularityBoost = 1 - eventVector.popularityScore;
    } else {
        // Neutral
        popularityBoost = 0.5;
    }

    // 3. Novelty bonus (diversity injection)
    let noveltyBonus = 1.0; // Default: no penalty or bonus

    if (recentFavoriteVectors.length > 0) {
        // Find most similar to recent favorites
        const similarities = recentFavoriteVectors.map(fav =>
            cosineSimilarity(fav.fullVector, eventVector.fullVector)
        );
        const maxSimilarity = Math.max(...similarities);

        // Novelty = how different it is from favorites
        const novelty = 1 - maxSimilarity;
        noveltyBonus = 1 + novelty * DIVERSITY_PREFERENCE;
    }

    // 4. Temporal relevance (upcoming events > distant events)
    const daysUntilEvent = Math.max(
        0,
        (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const temporalRelevance = 1 / (1 + daysUntilEvent / 30);

    // Combine into final score
    const finalScore =
        SCORING_WEIGHTS.contentSimilarity * contentSimilarity +
        SCORING_WEIGHTS.popularityBoost * popularityBoost +
        SCORING_WEIGHTS.noveltyBonus * (noveltyBonus - 1) + // Subtract 1 to make it a bonus
        SCORING_WEIGHTS.temporalRelevance * temporalRelevance;

    // Generate explanation
    let reason = '';
    if (contentSimilarity > 0.8) {
        reason = `Strong match with your interests in ${userProfile.dominantCategories[0]?.category}`;
    } else if (contentSimilarity > 0.6) {
        reason = `Good match based on your preferences`;
    } else if (noveltyBonus > 1.2) {
        reason = `Something new to explore!`;
    } else {
        reason = `Recommended for you`;
    }

    return {
        event,
        score: finalScore,
        explanation: {
            contentSimilarity,
            popularityBoost,
            noveltyBonus,
            temporalRelevance,
            reason,
        },
    };
}

/**
 * Get personalized recommendations for a user
 * Main entry point for recommendation engine
 */
export async function getPersonalizedRecommendations(
    userId: mongoose.Types.ObjectId,
    user: IUser,
    options: {
        limit?: number;
        excludeFavorited?: boolean;
        category?: string;
        minDate?: Date;
        maxDate?: Date;
    } = {}
): Promise<ScoredEvent[]> {
    const { limit = 20, excludeFavorited = true, category, minDate, maxDate } = options;

    // 1. Compute user profile
    const userProfile = await computeUserProfile(userId, user);

    // 2. Get recent favorites for novelty calculation
    const recentFavorites = await UserFavourite.find({ userId })
        .populate('eventId')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    const recentFavoriteVectors = recentFavorites
        .map(fav => {
            const event = fav.eventId as unknown as IEvent;
            return event ? extractEventFeatures(event) : null;
        })
        .filter((v): v is EventVector => v !== null);

    // 3. Build query for candidate events
    const query: any = {
        startDate: { $gte: minDate || new Date() },
    };

    if (maxDate) {
        query.startDate.$lte = maxDate;
    }

    if (category) {
        query.category = category;
    }

    // Filter by user's location preferences if set
    if (user.preferences.locations && user.preferences.locations.length > 0) {
        query['venue.suburb'] = { $in: user.preferences.locations };
    }

    // 4. Fetch candidate events
    const candidateEvents = await Event.find(query)
        .sort({ startDate: 1 })
        .limit(1000) // Reasonable limit for scoring
        .lean();

    // 5. Get favorited event IDs to exclude
    let favoritedIds: Set<string> = new Set();
    if (excludeFavorited) {
        const favorites = await UserFavourite.find({ userId }).select('eventId').lean();
        favoritedIds = new Set(favorites.map(f => f.eventId.toString()));
    }

    // 6. Score each event
    const scoredEvents = candidateEvents
        .filter(event => !favoritedIds.has(event._id.toString()))
        .map(event => scoreEventForUser(userProfile, event, user, recentFavoriteVectors));

    // 7. Sort by score and return top N
    scoredEvents.sort((a, b) => b.score - a.score);

    return scoredEvents.slice(0, limit);
}

/**
 * Get similar events to a specific event (content-based)
 * Useful for "Similar Events" section on event detail page
 */
export async function getSimilarEvents(
    eventId: mongoose.Types.ObjectId,
    options: { limit?: number; excludeEventId?: boolean } = {}
): Promise<Array<{ event: IEvent; similarity: number }>> {
    const { limit = 6, excludeEventId = true } = options;

    // Get the target event
    const targetEvent = await Event.findById(eventId).lean();
    if (!targetEvent) {
        return [];
    }

    const targetVector = extractEventFeatures(targetEvent);

    // Get candidate events (same category, upcoming)
    const candidates = await Event.find({
        category: targetEvent.category,
        startDate: { $gte: new Date() },
        _id: excludeEventId ? { $ne: eventId } : undefined,
    })
        .limit(100)
        .lean();

    // Score by similarity
    const scored = candidates.map(event => ({
        event,
        similarity: cosineSimilarity(targetVector.fullVector, extractEventFeatures(event).fullVector),
    }));

    // Sort by similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit);
}

/**
 * Update user's stored profile vector (called periodically by cron job)
 */
export async function updateStoredUserProfile(userId: mongoose.Types.ObjectId): Promise<void> {
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(userId);

    if (!user) return;

    const profile = await computeUserProfile(userId, user);

    // Update user document
    user.userVector = profile.userVector;
    // Optionally, determine cluster group (for future clustering)
    // user.clusterGroup = determineClusterGroup(profile);

    await user.save();
}