import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import User from '@/lib/models/User';
import {
    getPersonalizedRecommendations,
    getTrendingEvents,
} from '@/lib/ml/recommendationService';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const category = searchParams.get('category') || undefined;
        const excludeFavorited = searchParams.get('excludeFavorited') !== 'false';

        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        let events: any[] = [];

        if (session?.user?.email) {
            // PERSONALIZED RECOMMENDATIONS (Authenticated)
            const user = await User.findOne({ email: session.user.email });
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const recommendations = await getPersonalizedRecommendations(
                user._id as mongoose.Types.ObjectId,
                user,
                { limit, category, excludeFavorited }
            );

            events = recommendations.map(({ event, score, explanation }) => ({
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
                score,
                reason: explanation.reason,
            }));
        } else {
            // PUBLIC TRENDING RECOMMENDATIONS (Unauthenticated)
            const trendingEvents = await getTrendingEvents({
                limit,
                category,
            });

            events = trendingEvents.map(event => ({
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
                viewCount: event.stats?.viewCount || 0,
                favoriteCount: event.stats?.favouriteCount || 0,
            }));
        }

        return NextResponse.json({
            recommendations: events,
            count: events.length,
            isPersonalized: !!session?.user?.email,
        });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return NextResponse.json(
            { error: 'Failed to get recommendations' },
            { status: 500 }
        );
    }
}