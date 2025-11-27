import { NextRequest, NextResponse } from 'next/server';
;
import { connectDB } from '@/lib/db';

import { getRisingStars, getTrendingEvents, getUndiscoveredGems } from '@/lib/ml';

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '12');
        const category = searchParams.get('category') || undefined;
        const type = searchParams.get('type') || 'trending';

        let events;

        switch (type) {
            case 'trending':
                events = await getTrendingEvents({ limit, category });
                break;
            case 'rising':
                events = await getRisingStars({ limit, category });
                break;
            case 'undiscovered':
                events = await getUndiscoveredGems({ limit, category });
                break;
            default:
                return NextResponse.json(
                    { error: `Invalid type: ${type}. Use 'trending', 'rising', or 'undiscovered'` },
                    { status: 400 }
                );
        }

        const formatted = events.map(event => ({
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
            stats: {
                viewCount: event.stats?.viewCount || 0,
                favouriteCount: event.stats?.favouriteCount || 0,
                clickthroughCount: event.stats?.clickthroughCount || 0,
                popularityPercentile: event.stats?.categoryPopularityPercentile,
            },
        }));

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