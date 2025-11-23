
import { NextRequest, NextResponse } from 'next/server';
import { getHiddenGems } from '@/lib/ml/popularityService';
import { connectDB } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '12');
        const category = searchParams.get('category') || undefined;

        const events = await getHiddenGems(category, { limit });

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
            stats: {
                popularityPercentile: event.stats?.categoryPopularityPercentile,
            },
        }));

        return NextResponse.json({
            hiddenGems: formatted,
            count: formatted.length,
        });
    } catch (error) {
        console.error('Error getting hidden gems:', error);
        return NextResponse.json(
            { error: 'Failed to get hidden gems' },
            { status: 500 }
        );
    }
}