'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { connectDB } from '@/app/lib/db';
import UserInteraction from '@/app/lib/models/UserInteraction';
import UserFavourite from '../lib/models/UserFavourites';
import Event from '@/app/lib/models/Event';
import mongoose from 'mongoose';

type InteractionSource = 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';

interface ToggleFavouriteResult {
    success: boolean;
    isFavourited: boolean;
    error?: string;
}

export async function toggleFavourite(
    eventId: string,
    source: InteractionSource = 'direct'
): Promise<ToggleFavouriteResult> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, isFavourited: false, error: 'Must be logged in' };
        }

        await connectDB();

        const userId = new mongoose.Types.ObjectId(session.user.id);
        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        // Check if already favourited
        const existingFavourite = await UserFavourite.findOne({ userId, eventId: eventObjectId });

        if (existingFavourite) {
            // Unfavourite
            await UserFavourite.deleteOne({ _id: existingFavourite._id });

            // Log unfavourite interaction
            await UserInteraction.create({
                userId,
                eventId: eventObjectId,
                interactionType: 'unfavourite',
                source,
            });

            // Decrement favourite count
            await Event.updateOne(
                { _id: eventObjectId },
                { $inc: { 'stats.favouriteCount': -1 } }
            );

            return { success: true, isFavourited: false };
        } else {
            // Favourite
            await UserFavourite.create({ userId, eventId: eventObjectId });

            // Log favourite interaction
            await UserInteraction.create({
                userId,
                eventId: eventObjectId,
                interactionType: 'favourite',
                source,
            });

            // Increment favourite count
            await Event.updateOne(
                { _id: eventObjectId },
                { $inc: { 'stats.favouriteCount': 1 } }
            );

            return { success: true, isFavourited: true };
        }
    } catch (error) {
        console.error('Toggle favourite error:', error);
        return { success: false, isFavourited: false, error: 'Something went wrong' };
    }
}

export async function trackView(
    eventId: string,
    source: InteractionSource = 'direct'
): Promise<void> {
    try {
        const session = await getServerSession(authOptions);

        await connectDB();
        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        // Always increment view count (even for non-logged-in users)
        await Event.updateOne(
            { _id: eventObjectId },
            { $inc: { 'stats.viewCount': 1 } }
        );

        // Only log detailed interaction for logged-in users
        if (session?.user?.id) {
            const userId = new mongoose.Types.ObjectId(session.user.id);

            // Debounce: don't log if user viewed same event in last 30 minutes
            const recentView = await UserInteraction.findOne({
                userId,
                eventId: eventObjectId,
                interactionType: 'view',
                timestamp: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
            });

            if (!recentView) {
                await UserInteraction.create({
                    userId,
                    eventId: eventObjectId,
                    interactionType: 'view',
                    source,
                });
            }
        }
    } catch (error) {
        console.error('Track view error:', error);
    }
}

export async function trackClickthrough(
    eventId: string,
    source: InteractionSource = 'direct'
): Promise<void> {
    try {
        const session = await getServerSession(authOptions);

        await connectDB();
        const eventObjectId = new mongoose.Types.ObjectId(eventId);

        // Increment clickthrough count
        await Event.updateOne(
            { _id: eventObjectId },
            { $inc: { 'stats.clickthroughCount': 1 } }
        );

        // Log for logged-in users
        if (session?.user?.id) {
            await UserInteraction.create({
                userId: new mongoose.Types.ObjectId(session.user.id),
                eventId: eventObjectId,
                interactionType: 'clickthrough',
                source,
            });
        }
    } catch (error) {
        console.error('Track clickthrough error:', error);
    }
}

export async function getUserFavourites(userId: string): Promise<string[]> {
    try {
        await connectDB();
        const favourites = await UserFavourite.find({
            userId: new mongoose.Types.ObjectId(userId)
        }).select('eventId');

        return favourites.map(f => f.eventId.toString());
    } catch (error) {
        console.error('Get favourites error:', error);
        return [];
    }
}

export async function checkIsFavourited(eventId: string): Promise<boolean> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return false;

        await connectDB();
        const favourite = await UserFavourite.findOne({
            userId: new mongoose.Types.ObjectId(session.user.id),
            eventId: new mongoose.Types.ObjectId(eventId),
        });

        return !!favourite;
    } catch (error) {
        return false;
    }
}