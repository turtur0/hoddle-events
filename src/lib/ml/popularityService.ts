// lib/ml/popularityService.ts

import Event, { IEvent } from '@/lib/models/Event';
import { CATEGORIES } from '../categories';

// ============================================
// CONFIGURATION
// ============================================

// Venue capacity mapping (proxy for event scale)
const VENUE_CAPACITIES: Record<string, number> = {
    // Major stadiums
    'Marvel Stadium': 56000,
    'Melbourne Cricket Ground': 100000,
    'MCG': 100000,
    'Rod Laver Arena': 15000,
    'AAMI Park': 30000,

    // Large theatres
    'Arts Centre Melbourne': 2000,
    'Hamer Hall': 2500,
    'State Theatre': 2000,
    'Princess Theatre': 1500,
    'Regent Theatre': 2100,
    'Forum Melbourne': 1200,

    // Mid-size venues
    'The Tivoli': 1500,
    'Margaret Court Arena': 7500,
    'John Cain Arena': 10500,
    'Palais Theatre': 3000,

    // Small venues
    'Cherry Bar': 150,
    'The Tote': 400,
    'The Corner Hotel': 600,
    'Northcote Social Club': 500,
};

// Weights for popularity calculation
const POPULARITY_WEIGHTS = {
    favourites: 5.0,       // Strongest signal
    clickthroughs: 3.0,    // Medium-strong signal
    views: 0.5,            // Weakest signal (noisy)
    venueCapacity: 2.0,    // Proxy for demand
    priceSignal: 1.0,      // High price can indicate demand
    multiSource: 1.5,      // Multiple sources = well-known
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Calculate raw popularity score for an event
 * This combines multiple signals into a single score
 */
export function calculateRawPopularityScore(event: IEvent): number {
    let score = 0;

    // 1. User engagement signals (most important)
    const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};

    score += favouriteCount * POPULARITY_WEIGHTS.favourites;
    score += clickthroughCount * POPULARITY_WEIGHTS.clickthroughs;
    score += viewCount * POPULARITY_WEIGHTS.views;

    // 2. Venue capacity (proxy for event scale)
    const venueCapacity = VENUE_CAPACITIES[event.venue.name] || estimateVenueCapacity(event.venue.name);
    score += Math.log10(venueCapacity + 1) * POPULARITY_WEIGHTS.venueCapacity;

    // 3. Price signal (high price can indicate high demand OR premium niche)
    if (event.priceMax && event.priceMax > 100) {
        score += Math.log10(event.priceMax) * POPULARITY_WEIGHTS.priceSignal;
    }

    // 4. Multi-source indicator (event appears on multiple platforms)
    if (event.sources && event.sources.length > 1) {
        score += event.sources.length * POPULARITY_WEIGHTS.multiSource;
    }

    // 5. Time decay (newer events with same engagement are more "trending")
    const daysSinceListed = (Date.now() - event.scrapedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = 1 / (1 + daysSinceListed / 30); // Decay over 30 days
    score *= recencyBoost;

    return score;
}

/**
 * Estimate venue capacity based on venue name heuristics
 */
function estimateVenueCapacity(venueName: string): number {
    const nameLower = venueName.toLowerCase();

    if (nameLower.includes('stadium') || nameLower.includes('ground')) {
        return 50000; // Assume stadium
    }
    if (nameLower.includes('arena')) {
        return 15000; // Assume arena
    }
    if (nameLower.includes('theatre') || nameLower.includes('hall')) {
        return 1500; // Assume theatre
    }
    if (nameLower.includes('club') || nameLower.includes('bar')) {
        return 400; // Assume small venue
    }

    return 800; // Default medium venue
}

/**
 * Calculate category-relative popularity percentiles for all events
 * This should be run as a background job (e.g., daily cron)
 */
export async function updateCategoryPopularityPercentiles(): Promise<void> {
    console.log('[PopularityService] Starting category popularity update...');

    const categories = CATEGORIES.map(cat => cat.value);

    for (const category of categories) {
        // Get all events in this category
        const events = await Event.find({ category }).lean();

        if (events.length === 0) continue;

        console.log(`[PopularityService] Processing ${events.length} events in category: ${category}`);

        // Calculate raw scores for all events
        const eventsWithScores = events.map(event => ({
            id: event._id,
            score: calculateRawPopularityScore(event),
        }));

        // Sort by score
        eventsWithScores.sort((a, b) => a.score - b.score);

        // Assign percentiles
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
 * Get events by popularity percentile within category
 * Useful for "trending in category" queries
 */
export async function getPopularEventsInCategory(
    category: string,
    options: {
        minPercentile?: number;  // e.g., 0.7 = top 30%
        limit?: number;
    } = {}
): Promise<IEvent[]> {
    const { minPercentile = 0.7, limit = 20 } = options;

    return await Event.find({
        category,
        'stats.categoryPopularityPercentile': { $gte: minPercentile },
        startDate: { $gte: new Date() },
    })
        .sort({ 'stats.categoryPopularityPercentile': -1, startDate: 1 })
        .limit(limit)
        .lean();
}

/**
 * Get "hidden gems" - high quality but lower popularity
 */
export async function getHiddenGems(
    category?: string,
    options: { limit?: number } = {}
): Promise<IEvent[]> {
    const { limit = 20 } = options;

    const query: any = {
        // Mid-tier popularity (not too popular, not too unpopular)
        'stats.categoryPopularityPercentile': { $gte: 0.4, $lte: 0.7 },
        // But has some engagement (not brand new/unknown)
        'stats.favouriteCount': { $gte: 5 },
        startDate: { $gte: new Date() },
    };

    if (category) {
        query.category = category;
    }

    return await Event.find(query)
        .sort({ 'stats.categoryPopularityPercentile': -1, startDate: 1 })
        .limit(limit)
        .lean();
}

/**
 * Get initial popularity score for brand new events (cold start)
 * Based only on venue and price, before any user engagement
 */
export function getColdStartPopularityScore(event: IEvent): number {
    let score = 0;

    // Venue capacity as proxy
    const venueCapacity = VENUE_CAPACITIES[event.venue.name] || estimateVenueCapacity(event.venue.name);
    score += Math.log10(venueCapacity + 1) * 3; // Higher weight for cold start

    // Price signal
    if (event.priceMax && event.priceMax > 100) {
        score += Math.log10(event.priceMax) * 2;
    }

    // Multi-source
    if (event.sources && event.sources.length > 1) {
        score += event.sources.length * 2;
    }

    return score;
}

/**
 * Compare event popularity to category average
 * Returns: -1 (below avg), 0 (avg), 1 (above avg)
 */
export async function compareToCategory(eventId: string): Promise<{
    percentile: number;
    comparedToAvg: 'below' | 'average' | 'above';
    categoryAvg: number;
}> {
    const event = await Event.findById(eventId);
    if (!event) {
        throw new Error('Event not found');
    }

    const percentile = event.stats?.categoryPopularityPercentile || 0.5;

    // Get category average
    const categoryEvents = await Event.find({ category: event.category });
    const categoryAvg = categoryEvents.reduce(
        (sum, e) => sum + (e.stats?.categoryPopularityPercentile || 0),
        0
    ) / categoryEvents.length;

    let comparedToAvg: 'below' | 'average' | 'above';
    if (percentile < categoryAvg - 0.1) {
        comparedToAvg = 'below';
    } else if (percentile > categoryAvg + 0.1) {
        comparedToAvg = 'above';
    } else {
        comparedToAvg = 'average';
    }

    return {
        percentile,
        comparedToAvg,
        categoryAvg,
    };
}