// ============================================
// lib/ml/popularity-service.ts
// ============================================

import { CATEGORIES } from '../constants/categories';
import { Event, type IEvent } from '@/lib/models';

// ============================================
// CONFIGURATION
// ============================================

/** Venue capacity mapping for popularity scoring */
const VENUE_CAPACITIES: Record<string, number> = {
    'Marvel Stadium': 56000,
    'Melbourne Cricket Ground': 100000,
    'MCG': 100000,
    'Rod Laver Arena': 15000,
    'AAMI Park': 30000,
    'Arts Centre Melbourne': 2000,
    'Hamer Hall': 2500,
    'State Theatre': 2000,
    'Princess Theatre': 1500,
    'Regent Theatre': 2100,
    'Forum Melbourne': 1200,
    'The Tivoli': 1500,
    'Margaret Court Arena': 7500,
    'John Cain Arena': 10500,
    'Palais Theatre': 3000,
    'Cherry Bar': 150,
    'The Tote': 400,
    'The Corner Hotel': 600,
    'Northcote Social Club': 500,
};

/** 
 * Weights for popularity calculation components
 * Higher weights = stronger signal for popularity
 */
const POPULARITY_WEIGHTS = {
    favourites: 5.0,       // Strongest: explicit user interest
    clickthroughs: 3.0,    // Medium: booking intent
    views: 0.5,            // Weakest: passive browsing
    venueCapacity: 2.0,    // Proxy for event scale/demand
    priceSignal: 1.0,      // High price may indicate demand
    multiSource: 1.5,      // Multiple sources = well-known
} as const;

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Calculate raw popularity score combining multiple signals
 * 
 * Scoring components:
 * 1. User engagement (views, favourites, clickthroughs) - most important
 * 2. Venue capacity - proxy for event scale
 * 3. Price - high price can indicate high demand
 * 4. Multi-source presence - appears on multiple platforms
 * 5. Time decay - newer events with same engagement rank higher
 * 
 * @param event - Event to score
 * @returns Raw popularity score (unbounded, typically 0-100)
 */
export function calculateRawPopularityScore(event: IEvent): number {
    const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};

    // 1. User engagement (weighted sum)
    let score =
        favouriteCount * POPULARITY_WEIGHTS.favourites +
        clickthroughCount * POPULARITY_WEIGHTS.clickthroughs +
        viewCount * POPULARITY_WEIGHTS.views;

    // 2. Venue capacity (log scale to prevent domination)
    const venueCapacity = VENUE_CAPACITIES[event.venue.name] || estimateVenueCapacity(event.venue.name);
    score += Math.log10(venueCapacity + 1) * POPULARITY_WEIGHTS.venueCapacity;

    // 3. Price signal (log scale, only for higher-priced events)
    if (event.priceMax && event.priceMax > 100) {
        score += Math.log10(event.priceMax) * POPULARITY_WEIGHTS.priceSignal;
    }

    // 4. Multi-source bonus
    if (event.sources?.length > 1) {
        score += event.sources.length * POPULARITY_WEIGHTS.multiSource;
    }

    // 5. Time decay (30-day half-life)
    const daysSinceListed = (Date.now() - event.scrapedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = 1 / (1 + daysSinceListed / 30);

    return score * recencyBoost;
}

/**
 * Estimate venue capacity using name heuristics
 * Fallback for venues not in VENUE_CAPACITIES mapping
 */
function estimateVenueCapacity(venueName: string): number {
    const name = venueName.toLowerCase();

    if (name.includes('stadium') || name.includes('ground')) return 50000;
    if (name.includes('arena')) return 15000;
    if (name.includes('theatre') || name.includes('hall')) return 1500;
    if (name.includes('club') || name.includes('bar')) return 400;

    return 800; // Default medium venue
}

/**
 * Update category-relative popularity percentiles for all events
 * 
 * Process:
 * 1. Calculate raw scores for all events in each category
 * 2. Rank events within their category
 * 3. Assign percentiles (0.0 = least popular, 1.0 = most popular)
 * 
 * Should be run as a daily cron job to keep percentiles fresh
 */
export async function updateCategoryPopularityPercentiles(): Promise<void> {
    console.log('[PopularityService] Starting category popularity update...');

    for (const category of CATEGORIES.map(cat => cat.value)) {
        const events = await Event.find({ category }).lean();
        if (events.length === 0) continue;

        console.log(`[PopularityService] Processing ${events.length} events in ${category}`);

        // Score and sort events
        const eventsWithScores = events
            .map(event => ({ id: event._id, score: calculateRawPopularityScore(event) }))
            .sort((a, b) => a.score - b.score);

        // Assign percentiles and update
        const totalEvents = eventsWithScores.length;
        for (let i = 0; i < eventsWithScores.length; i++) {
            const percentile = totalEvents === 1 ? 0.5 : i / (totalEvents - 1);

            await Event.findByIdAndUpdate(eventsWithScores[i].id, {
                $set: {
                    'stats.rawPopularityScore': eventsWithScores[i].score,
                    'stats.categoryPopularityPercentile': percentile,
                    'stats.lastPopularityUpdate': new Date(),
                },
            });
        }

        console.log(`[PopularityService] Updated ${totalEvents} events in ${category}`);
    }

    console.log('[PopularityService] Category popularity update complete!');
}

/**
 * Get popular events within a category
 * 
 * @param category - Category to filter by
 * @param options.minPercentile - Minimum popularity percentile (0.7 = top 30%)
 * @param options.limit - Maximum events to return
 */
export async function getPopularEventsInCategory(
    category: string,
    options: { minPercentile?: number; limit?: number } = {}
): Promise<IEvent[]> {
    const { minPercentile = 0.7, limit = 20 } = options;

    return Event.find({
        category,
        'stats.categoryPopularityPercentile': { $gte: minPercentile },
        startDate: { $gte: new Date() },
    })
        .sort({ 'stats.categoryPopularityPercentile': -1, startDate: 1 })
        .limit(limit)
        .lean();
}

/**
 * Get "hidden gems" - mid-tier popularity with proven engagement
 * 
 * Target: Events in 40-70th percentile with at least 5 favourites
 * These are quality events that haven't hit mainstream yet
 */
export async function getHiddenGems(
    category?: string,
    options: { limit?: number } = {}
): Promise<IEvent[]> {
    const { limit = 20 } = options;

    const query: any = {
        'stats.categoryPopularityPercentile': { $gte: 0.4, $lte: 0.7 },
        'stats.favouriteCount': { $gte: 5 },
        startDate: { $gte: new Date() },
    };

    if (category) query.category = category;

    return Event.find(query)
        .sort({ 'stats.categoryPopularityPercentile': -1, startDate: 1 })
        .limit(limit)
        .lean();
}

/**
 * Get cold start popularity score for new events (no user engagement yet)
 * 
 * Uses venue capacity, price, and multi-source presence
 * to provide initial ranking before user engagement data accumulates
 */
export function getColdStartPopularityScore(event: IEvent): number {
    let score = 0;

    const venueCapacity = VENUE_CAPACITIES[event.venue.name] || estimateVenueCapacity(event.venue.name);
    score += Math.log10(venueCapacity + 1) * 3;

    if (event.priceMax && event.priceMax > 100) {
        score += Math.log10(event.priceMax) * 2;
    }

    if (event.sources?.length > 1) {
        score += event.sources.length * 2;
    }

    return score;
}

/**
 * Compare event popularity to category average
 * 
 * @returns Object with percentile, comparison label, and category average
 */
export async function compareToCategory(eventId: string): Promise<{
    percentile: number;
    comparedToAvg: 'below' | 'average' | 'above';
    categoryAvg: number;
}> {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');

    const percentile = event.stats?.categoryPopularityPercentile || 0.5;

    const categoryEvents = await Event.find({ category: event.category });
    const categoryAvg = categoryEvents.reduce(
        (sum, e) => sum + (e.stats?.categoryPopularityPercentile || 0),
        0
    ) / categoryEvents.length;

    let comparedToAvg: 'below' | 'average' | 'above';
    if (percentile < categoryAvg - 0.1) comparedToAvg = 'below';
    else if (percentile > categoryAvg + 0.1) comparedToAvg = 'above';
    else comparedToAvg = 'average';

    return { percentile, comparedToAvg, categoryAvg };
}