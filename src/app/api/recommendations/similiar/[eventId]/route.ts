import { NextRequest, NextResponse } from 'next/server';
import { getSimilarEvents } from '@/lib/ml/recommendationService';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(
    req: NextRequest,
    { params }: { params: { eventId: string } }
) {
    try {
        await connectDB();

        const { eventId } = params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
        }

        const similarEvents = await getSimilarEvents(
            new mongoose.Types.ObjectId(eventId),
            { limit: 6 }
        );

        const formatted = similarEvents.map(({ event, similarity }) => ({
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
            similarity: Math.round(similarity * 100), // Convert to percentage
        }));

        return NextResponse.json({
            similarEvents: formatted,
            count: formatted.length,
        });
    } catch (error) {
        console.error('Error getting similar events:', error);
        return NextResponse.json(
            { error: 'Failed to get similar events' },
            { status: 500 }
        );
    }
}