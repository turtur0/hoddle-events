// ============================================
// lib/ml/user-profile-service.ts
// ============================================

import { extractEventFeatures, cosineSimilarity, type EventVector } from './vectorService';
import { CATEGORIES } from '../constants/categories';
import { Event, UserFavourite, UserInteraction, type IEvent, type IUser } from '@/lib/models';
import mongoose from 'mongoose';

// ============================================
// CONFIGURATION
// ============================================

/** Interaction weights for learning user preferences */
const INTERACTION_WEIGHTS = {
    favourite: 5.0,      // Strong positive signal
    unfavourite: -3.0,   // Negative signal
    clickthrough: 3.0,   // Medium-strong signal
    view: 1.0,          // Weak signal
} as const;

/** Time decay rate (0.01 ≈ 30 day half-life) */
const TIME_DECAY_LAMBDA = 0.01;

/** Blend ratio: 30% explicit preferences, 70% learned behavior */
const REGULARIZATION_LAMBDA = 0.3;

/** 
 * Final scoring weights
 * Determines how different factors contribute to recommendation score
 */
const SCORING_WEIGHTS = {
    contentSimilarity: 0.6,   // How well event matches user preferences
    popularityBoost: 0.2,     // Match user's mainstream/niche preference
    noveltyBonus: 0.1,        // Diversity injection
    temporalRelevance: 0.1,   // Urgency for upcoming events
} as const;

/** Diversity boost multiplier */
const DIVERSITY_PREFERENCE = 0.3;

// ============================================
// TYPES
// ============================================

export interface UserProfile {
    userVector: number[];
    confidence: number;
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
 * Build user preference vector from interaction history
 * 
 * Process:
 * 1. Fetch recent interactions (last 6 months)
 * 2. Extract event features for each interaction
 * 3. Apply time decay (recent interactions matter more)
 * 4. Weight by interaction type (favourite > clickthrough > view)
 * 5. Compute weighted average to create user vector
 * 
 * @param userId - User's MongoDB ObjectId
 * @returns Vector, confidence score, and interaction count, or null if no data
 */
export async function buildUserVectorFromInteractions(
    userId: mongoose.Types.ObjectId
): Promise<{ vector: number[]; confidence: number; count: number } | null> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const interactions = await UserInteraction.find({
        userId,
        timestamp: { $gte: sixMonthsAgo },
    })
        .populate('eventId')
        .sort({ timestamp: -1 })
        .limit(200)
        .lean();

    if (interactions.length === 0) return null;

    // Compute weighted average of event vectors
    const now = Date.now();
    let weightedSum: number[] = [];
    let totalWeight = 0;

    for (const interaction of interactions) {
        const event = interaction.eventId as unknown as IEvent;
        if (!event?._id) continue;

        const eventVector = extractEventFeatures(event);

        // Time decay: exponential decay based on days since interaction
        const daysSince = (now - interaction.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const timeWeight = Math.exp(-TIME_DECAY_LAMBDA * daysSince);

        // Interaction strength
        const interactionWeight = INTERACTION_WEIGHTS[interaction.interactionType] || 0;
        const weight = timeWeight * interactionWeight;

        if (weight <= 0) continue;

        // Accumulate weighted sum
        if (weightedSum.length === 0) {
            weightedSum = eventVector.fullVector.map(v => v * weight);
        } else {
            for (let i = 0; i < eventVector.fullVector.length; i++) {
                weightedSum[i] += eventVector.fullVector[i] * weight;
            }
        }

        totalWeight += weight;
    }

    if (totalWeight === 0) return null;

    // Compute average and confidence
    const averageVector = weightedSum.map(v => v / totalWeight);
    const confidence = Math.min(interactions.length / 20, 1.0);

    return { vector: averageVector, confidence, count: interactions.length };
}

/**
 * Build user vector from explicit preferences (onboarding selections)
 * This serves as the "prior" before we have interaction data
 */
export function buildUserVectorFromPreferences(user: IUser): number[] {
    const priorVector: number[] = [];
    const categoryWeights = user.preferences.categoryWeights || {};
    const mainCategories = CATEGORIES.map(cat => cat.value);

    // Category preferences
    for (const category of mainCategories) {
        const weight = categoryWeights[category] || 0;
        priorVector.push(weight * 10.0);
    }

    // Subcategory preferences
    const selectedSubcats = user.preferences.selectedSubcategories || [];
    const allSubcategories = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );

    for (const fullSubcat of allSubcategories) {
        const [category, subcat] = fullSubcat.split(':');
        const isSelected = selectedSubcats.includes(subcat) &&
            user.preferences.selectedCategories.includes(category);
        priorVector.push(isSelected ? 5.0 : 0);
    }

    // Price, venue, and popularity preferences
    const priceMiddle = (user.preferences.priceRange.min + user.preferences.priceRange.max) / 2;
    const priceNormalized = Math.log10(priceMiddle + 1) / Math.log10(500 + 1);
    priorVector.push(priceNormalized * 1.0);
    priorVector.push(0.5 * 1.0); // Venue tier (neutral)
    priorVector.push((user.preferences.popularityPreference || 0.5) * 3.0);

    return priorVector;
}

/**
 * Compute complete user profile by blending explicit and learned preferences
 * 
 * Strategy:
 * - Cold start (no interactions): Use 100% explicit preferences
 * - With interactions: Blend 30% explicit + 70% learned (regularization)
 * - Normalize to unit length for consistent similarity calculations
 * 
 * @param userId - User's MongoDB ObjectId
 * @param user - User document with preferences
 * @returns Complete user profile with vector and metadata
 */
export async function computeUserProfile(
    userId: mongoose.Types.ObjectId,
    user: IUser
): Promise<UserProfile> {
    const learnedData = await buildUserVectorFromInteractions(userId);
    const priorVector = buildUserVectorFromPreferences(user);

    let finalVector: number[];
    let confidence: number;
    let interactionCount: number;

    if (!learnedData) {
        // Cold start: use explicit preferences only
        finalVector = priorVector;
        confidence = 0.3;
        interactionCount = 0;
    } else {
        // Regularized blend
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

    // L2 normalization
    const magnitude = Math.sqrt(finalVector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
        finalVector = finalVector.map(v => v / magnitude);
    }

    // Extract dominant categories for explainability
    const mainCategories = CATEGORIES.map(cat => cat.value);
    const dominantCategories = mainCategories
        .map((cat, idx) => ({ category: cat, weight: finalVector[idx] || 0 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

    const allSubcategories = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );
    const subcatStartIdx = mainCategories.length;
    const dominantSubcategories = allSubcategories
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
 * Score a single event for a user with detailed explanation
 * 
 * Scoring components:
 * 1. Content similarity (60%): How well event matches user preferences
 * 2. Popularity boost (20%): Adjust for user's mainstream/niche preference
 * 3. Novelty bonus (10%): Encourage diversity (different from recent favourites)
 * 4. Temporal relevance (10%): Prioritize upcoming events
 * 
 * @param userProfile - User's computed profile
 * @param event - Event to score
 * @param user - User document (for popularity preference)
 * @param recentFavoriteVectors - Recent favourite event vectors (for novelty)
 * @returns Scored event with explanation
 */
export function scoreEventForUser(
    userProfile: UserProfile,
    event: IEvent,
    user: IUser,
    recentFavoriteVectors: EventVector[]
): ScoredEvent {
    const eventVector = extractEventFeatures(event);

    // 1. Content similarity
    const contentSimilarity = cosineSimilarity(userProfile.userVector, eventVector.fullVector);

    // 2. Popularity boost (match user's preference)
    const userPopPref = user.preferences.popularityPreference || 0.5;
    let popularityBoost: number;
    if (userPopPref > 0.7) {
        popularityBoost = eventVector.popularityScore; // Prefer mainstream
    } else if (userPopPref < 0.3) {
        popularityBoost = 1 - eventVector.popularityScore; // Prefer niche
    } else {
        popularityBoost = 0.5; // Neutral
    }

    // 3. Novelty bonus (diversity injection)
    let noveltyBonus = 1.0;
    if (recentFavoriteVectors.length > 0) {
        const similarities = recentFavoriteVectors.map(fav =>
            cosineSimilarity(fav.fullVector, eventVector.fullVector)
        );
        const maxSimilarity = Math.max(...similarities);
        const novelty = 1 - maxSimilarity;
        noveltyBonus = 1 + novelty * DIVERSITY_PREFERENCE;
    }

    // 4. Temporal relevance
    const daysUntilEvent = Math.max(
        0,
        (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const temporalRelevance = 1 / (1 + daysUntilEvent / 30);

    // Combined score
    const finalScore =
        SCORING_WEIGHTS.contentSimilarity * contentSimilarity +
        SCORING_WEIGHTS.popularityBoost * popularityBoost +
        SCORING_WEIGHTS.noveltyBonus * (noveltyBonus - 1) +
        SCORING_WEIGHTS.temporalRelevance * temporalRelevance;

    // Generate explanation
    let reason: string;
    if (contentSimilarity > 0.8) {
        reason = `Strong match with your interests in ${userProfile.dominantCategories[0]?.category}`;
    } else if (contentSimilarity > 0.6) {
        reason = 'Good match based on your preferences';
    } else if (noveltyBonus > 1.2) {
        reason = 'Something new to explore!';
    } else {
        reason = 'Recommended for you';
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
 * Main entry point for the recommendation engine
 * 
 * Process:
 * 1. Compute user profile (blend explicit + learned preferences)
 * 2. Fetch candidate events matching user's location/category filters
 * 3. Exclude already favorited events (optional)
 * 4. Score each event using multi-factor algorithm
 * 5. Return top N highest-scoring events
 * 
 * @param userId - User's MongoDB ObjectId
 * @param user - User document with preferences
 * @param options - Filtering and pagination options
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

    // 2. Get recent favourites for novelty calculation
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

    // 3. Build query
    const query: any = {
        startDate: { $gte: minDate || new Date() },
    };
    if (maxDate) query.startDate.$lte = maxDate;
    if (category) query.category = category;
    if (user.preferences.locations?.length) {
        query['venue.suburb'] = { $in: user.preferences.locations };
    }

    // 4. Fetch candidates
    const candidateEvents = await Event.find(query)
        .sort({ startDate: 1 })
        .limit(1000)
        .lean();

    // 5. Exclude favorited
    let favoritedIds: Set<string> = new Set();
    if (excludeFavorited) {
        const favorites = await UserFavourite.find({ userId }).select('eventId').lean();
        favoritedIds = new Set(favorites.map(f => f.eventId.toString()));
    }

    // 6. Score events
    const scoredEvents = candidateEvents
        .filter(event => !favoritedIds.has(event._id.toString()))
        .map(event => scoreEventForUser(userProfile, event, user, recentFavoriteVectors));

    // 7. Sort and return top N
    scoredEvents.sort((a, b) => b.score - a.score);
    return scoredEvents.slice(0, limit);
}

/**
 * Get similar events using content-based filtering
 * Useful for "Similar Events" section on event detail pages
 */
export async function getSimilarEvents(
    eventId: mongoose.Types.ObjectId,
    options: { limit?: number; excludeEventId?: boolean } = {}
): Promise<Array<{ event: IEvent; similarity: number }>> {
    const { limit = 6, excludeEventId = true } = options;

    const targetEvent = await Event.findById(eventId).lean();
    if (!targetEvent) return [];

    const targetVector = extractEventFeatures(targetEvent);

    const candidates = await Event.find({
        category: targetEvent.category,
        startDate: { $gte: new Date() },
        _id: excludeEventId ? { $ne: eventId } : undefined,
    })
        .limit(100)
        .lean();

    const scored = candidates.map(event => ({
        event,
        similarity: cosineSimilarity(targetVector.fullVector, extractEventFeatures(event).fullVector),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
}

/**
 * Update user's stored profile vector (called by cron job)
 * Precomputes user vectors for faster recommendation queries
 */
export async function updateStoredUserProfile(userId: mongoose.Types.ObjectId): Promise<void> {
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(userId);
    if (!user) return;

    const profile = await computeUserProfile(userId, user);
    user.userVector = profile.userVector;
    await user.save();
}