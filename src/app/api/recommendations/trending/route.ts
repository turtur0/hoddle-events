import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getTrendingEvents, getUndiscoveredGems } from '@/lib/ml';

type EventType = 'trending' | 'undiscovered';

/**
 * GET /api/recommendations/trending
 * Returns events based on type: trending or undiscovered gems.
 * 
 * Query params:
 * - type: 'trending' | 'undiscovered' (default: 'trending')
 * - limit: number of events (default: 12)
 * - category: filter by category
 */
export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '12');
        const category = searchParams.get('category') || undefined;
        const type = (searchParams.get('type') || 'trending') as EventType;

        const events = await fetchEventsByType(type, { limit, category });
        const formatted = formatEvents(events);

        return NextResponse.json({
            events: formatted,
            count: formatted.length,
            type,
        });
    } catch (error) {
        console.error('Error getting events:', error);
        return NextResponse.json(
            { error: 'Failed to get events' },
            { status: 500 }
        );
    }
}

/** Fetches events based on the specified type. */
async function fetchEventsByType(
    type: EventType,
    options: { limit: number; category?: string }
) {
    switch (type) {
        case 'trending':
            return getTrendingEvents(options);
        case 'undiscovered':
            return getUndiscoveredGems(options);
        default:
            throw new Error(`Invalid type: ${type}`);
    }
}

/** Formats events for API response. */
function formatEvents(events: any[]) {
    return events.map(event => ({
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        category: event.category,
        subcategories: event.subcategories,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString(),
        venue: event.venue,
        priceMin: event.priceMin,
        priceMax: event.priceMax,
        isFree: event.isFree,
        bookingUrl: event.bookingUrl,
        imageUrl: event.imageUrl,
        primarySource: event.primarySource,
        ageRestriction: event.ageRestriction,
        duration: event.duration,
        accessibility: event.accessibility,
        sources: event.sources,
        isArchived: event.isArchived || false,
        stats: {
            viewCount: event.stats?.viewCount || 0,
            favouriteCount: event.stats?.favouriteCount || 0,
            clickthroughCount: event.stats?.clickthroughCount || 0,
            popularityPercentile: event.stats?.categoryPopularityPercentile,
        },
    }));
}