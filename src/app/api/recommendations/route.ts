// src/app/api/recommendations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import User from '@/lib/models/User';
import { getPersonalizedRecommendations } from '@/lib/ml/userProfileService';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
    try {
        // 1. Authenticate user
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Connect to database
        await connectDB();

        // 3. Get user from database
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 4. Parse query parameters
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const category = searchParams.get('category') || undefined;
        const excludeFavorited = searchParams.get('excludeFavorited') !== 'false';

        // 5. Get recommendations
        const recommendations = await getPersonalizedRecommendations(
            user._id as mongoose.Types.ObjectId,
            user,
            {
                limit,
                category,
                excludeFavorited,
                minDate: new Date(), // Only future events
            }
        );

        // 6. Format response
        const formatted = recommendations.map(({ event, score, explanation }) => ({
            event: {
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
            },
            score,
            reason: explanation.reason,
        }));

        return NextResponse.json({
            recommendations: formatted,
            count: formatted.length,
        });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return NextResponse.json(
            { error: 'Failed to get recommendations' },
            { status: 500 }
        );
    }
}