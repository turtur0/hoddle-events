import { CATEGORIES } from '../constants/categories';
import { Event, type IEvent } from '@/lib/models';
import { searchSpotifyArtist, extractArtistName, calculateSpotifyScore } from './spotify-service';

// Venue capacity mapping for popularity scoring
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
 * Rebalanced to include Spotify data (40% user engagement, 40% external, 20% metadata)
 */
const POPULARITY_WEIGHTS = {
    // User engagement (40% total weight)
    favourites: 5.0,
    clickthroughs: 3.0,
    views: 0.5,

    // External popularity (40% total weight)
    spotifyPopularity: 3.0, // Spotify's 0-100 score

    // Event metadata (20% total weight)
    venueCapacity: 2.0,
    priceSignal: 1.0,
    multiSource: 1.5,
} as const;

/**
 * Calculate raw popularity score combining multiple signals.
 * Now includes Spotify popularity for music events.
 */
export function calculateRawPopularityScore(event: IEvent): number {
    const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};

    // 1. User engagement (weighted sum)
    let score =
        favouriteCount * POPULARITY_WEIGHTS.favourites +
        clickthroughCount * POPULARITY_WEIGHTS.clickthroughs +
        viewCount * POPULARITY_WEIGHTS.views;

    // 2. Spotify popularity (for music events)
    if (event.externalPopularity?.spotify) {
        const spotifyScore = calculateSpotifyScore(event.externalPopularity.spotify.popularity);
        score += spotifyScore * POPULARITY_WEIGHTS.spotifyPopularity;
    }

    // 3. Venue capacity (log scale)
    const venueCapacity = VENUE_CAPACITIES[event.venue.name] || estimateVenueCapacity(event.venue.name);
    score += Math.log10(venueCapacity + 1) * POPULARITY_WEIGHTS.venueCapacity;

    // 4. Price signal (log scale, high-priced events only)
    if (event.priceMax && event.priceMax > 100) {
        score += Math.log10(event.priceMax) * POPULARITY_WEIGHTS.priceSignal;
    }

    // 5. Multi-source bonus
    if (event.sources?.length > 1) {
        score += event.sources.length * POPULARITY_WEIGHTS.multiSource;
    }

    // 6. Time decay (30-day half-life)
    const daysSinceListed = (Date.now() - event.scrapedAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = 1 / (1 + daysSinceListed / 30);

    return score * recencyBoost;
}

/** Estimate venue capacity using name heuristics */
function estimateVenueCapacity(venueName: string): number {
    const name = venueName.toLowerCase();

    if (name.includes('stadium') || name.includes('ground')) return 50000;
    if (name.includes('arena')) return 15000;
    if (name.includes('theatre') || name.includes('hall')) return 1500;
    if (name.includes('club') || name.includes('bar')) return 400;

    return 800; // Default medium venue
}

/**
 * Enrich music events with Spotify data.
 * Fetches artist popularity in batches to respect rate limits.
 */
export async function enrichWithSpotifyData(batchSize: number = 50): Promise<number> {
    console.log('[Spotify] Starting enrichment batch...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find music events that need Spotify data
    const events = await Event.find({
        category: 'music',
        startDate: { $gte: new Date() }, // Only upcoming events
        $or: [
            { 'externalPopularity.spotify': { $exists: false } },
            { 'externalPopularity.spotify.lastFetched': { $lt: sevenDaysAgo } },
        ],
    })
        .sort({ startDate: 1 }) // Prioritise upcoming events
        .limit(batchSize)
        .lean();

    console.log(`[Spotify] Processing ${events.length} music events`);

    let enriched = 0;
    let failed = 0;

    for (const event of events) {
        try {
            const artistName = extractArtistName(event.title);
            if (!artistName) {
                failed++;
                continue;
            }

            const spotifyArtist = await searchSpotifyArtist(artistName);

            if (spotifyArtist) {
                await Event.updateOne(
                    { _id: event._id },
                    {
                        $set: {
                            'externalPopularity.spotify': {
                                artistId: spotifyArtist.id,
                                artistName: spotifyArtist.name,
                                popularity: spotifyArtist.popularity,
                                followers: spotifyArtist.followers.total,
                                lastFetched: new Date(),
                            },
                        },
                    }
                );
                enriched++;
                console.log(`[Spotify] ✓ ${event.title} → ${spotifyArtist.name} (${spotifyArtist.popularity}/100)`);
            } else {
                failed++;
            }

            // Rate limiting: 10 requests/second
            await delay(100);
        } catch (error) {
            console.error(`[Spotify] Error for "${event.title}":`, error);
            failed++;
        }
    }

    console.log(`[Spotify] Complete: ${enriched} enriched, ${failed} failed`);
    return enriched;
}

/**
 * Update category-relative popularity percentiles for all events.
 * Should be run as a daily cron job.
 */
export async function updateCategoryPopularityPercentiles(): Promise<void> {
    console.log('[PopularityService] Starting category popularity update...');

    for (const category of CATEGORIES.map(cat => cat.value)) {
        const events = await Event.find({ category, isArchived: { $ne: true } }).lean();
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

/** Get popular events within a category */
export async function getPopularEventsInCategory(
    category: string,
    options: { minPercentile?: number; limit?: number } = {}
): Promise<IEvent[]> {
    const { minPercentile = 0.7, limit = 20 } = options;

    return Event.find({
        category,
        'stats.categoryPopularityPercentile': { $gte: minPercentile },
        startDate: { $gte: new Date() },
        isArchived: { $ne: true },
    })
        .sort({ 'stats.categoryPopularityPercentile': -1, startDate: 1 })
        .limit(limit)
        .lean();
}

/** Get "hidden gems" - mid-tier popularity with proven engagement */
export async function getHiddenGems(
    category?: string,
    options: { limit?: number } = {}
): Promise<IEvent[]> {
    const { limit = 20 } = options;

    const query: any = {
        'stats.categoryPopularityPercentile': { $gte: 0.4, $lte: 0.7 },
        'stats.favouriteCount': { $gte: 5 },
        startDate: { $gte: new Date() },
        isArchived: { $ne: true },
    };

    if (category) query.category = category;

    return Event.find(query)
        .sort({ 'stats.categoryPopularityPercentile': -1, startDate: 1 })
        .limit(limit)
        .lean();
}

/** Get cold start popularity score for new events */
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

    // Add Spotify data if available
    if (event.externalPopularity?.spotify) {
        score += calculateSpotifyScore(event.externalPopularity.spotify.popularity);
    }

    return score;
}

/** Compare event popularity to category average */
export async function compareToCategory(eventId: string): Promise<{
    percentile: number;
    comparedToAvg: 'below' | 'average' | 'above';
    categoryAvg: number;
}> {
    const event = await Event.findById(eventId);
    if (!event) throw new Error('Event not found');

    const percentile = event.stats?.categoryPopularityPercentile || 0.5;

    const categoryEvents = await Event.find({
        category: event.category,
        isArchived: { $ne: true },
    });

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

/** Simple delay utility for rate limiting */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export { IEvent };