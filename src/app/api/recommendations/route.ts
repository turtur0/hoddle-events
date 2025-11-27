// app/api/recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

import { getPersonalizedRecommendations, getTrendingEvents } from '@/lib/ml';
import type { ScoredEvent } from '@/lib/ml';
import { User } from '@/lib/models';

// CRITICAL: Force this route to be dynamic (never cached)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '12');
        const category = searchParams.get('category') || undefined;
        const excludeFavorited = searchParams.get('excludeFavorited') !== 'false';

        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        let events: any[] = [];
        let isPersonalized = false;

        if (session?.user?.email) {
            // PERSONALIZED RECOMMENDATIONS (Authenticated)
            const user = await User.findOne({ email: session.user.email });
            if (user) {
                console.log(`[Recommendations] Generating personalized for user: ${user._id}`);
                isPersonalized = true;

                const recommendations = await getPersonalizedRecommendations(
                    user._id as mongoose.Types.ObjectId,
                    user,
                    { limit, category, excludeFavorited }
                );

                // Fix: Add proper type annotation
                events = recommendations.map(({ event, score, explanation }: ScoredEvent) => ({
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
                    stats: event.stats || { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
                    score,
                    reason: explanation.reason,
                }));

                console.log(`[Recommendations] Returned ${events.length} personalized events`);
            }
        }

        // Fallback to trending if not authenticated or user not found
        if (!isPersonalized) {
            console.log('[Recommendations] Using trending (not personalized)');
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
                primarySource: event.primarySource,
                stats: event.stats || { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
            }));
        }

        // Add cache control headers to prevent client-side caching
        const headers = new Headers();
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');

        return NextResponse.json({
            recommendations: events,
            count: events.length,
            isPersonalized,
            timestamp: new Date().toISOString(), // For debugging cache issues
        }, { headers });
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return NextResponse.json(
            { error: 'Failed to get recommendations' },
            { status: 500 }
        );
    }
}