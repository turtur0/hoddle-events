// lib/services/notificationService.ts
import User from '@/lib/models/User';
import Notification from '../models/Notifications';
import { IEvent } from '@/lib/models/Event';
import { getPersonalizedRecommendations } from '@/lib/ml/recommendationService';
import mongoose from 'mongoose';

/**
 * Process notifications for a new event
 * Triggers: keyword matches and personalized recommendations
 */
export async function processNewEventNotifications(event: IEvent): Promise<number> {
    try {
        const users = await User.find({
            'preferences.notifications.inApp': true,
        }).lean();

        let notificationCount = 0;

        for (const user of users) {
            const notification = await evaluateEventForUser(user, event);

            if (notification) {
                await createNotification(notification);
                notificationCount++;
            }
        }

        return notificationCount;
    } catch (error) {
        console.error('Error processing new event notifications:', error);
        return 0;
    }
}

/**
 * Process notifications for favorited event updates
 * Triggers: price drops and significant changes
 */
export async function processFavoritedEventUpdate(
    event: IEvent,
    changes: { priceDropped?: boolean; priceDrop?: number; significantUpdate?: string }
): Promise<number> {
    try {
        // Find users who favorited this event
        const users = await User.find({
            'preferences.notifications.inApp': true,
            'favorites': event._id,
        }).lean();

        let notificationCount = 0;

        for (const user of users) {
            // Only notify for meaningful updates
            if (changes.priceDropped && changes.priceDrop) {
                await createNotification({
                    userId: user._id.toString(),
                    eventId: event._id.toString(),
                    type: 'favorite_update',
                    title: 'Price Drop on Favorited Event',
                    message: `${event.title} is now $${changes.priceDrop} cheaper!`,
                    relevanceScore: 1.0,
                });
                notificationCount++;
            } else if (changes.significantUpdate) {
                await createNotification({
                    userId: user._id.toString(),
                    eventId: event._id.toString(),
                    type: 'favorite_update',
                    title: 'Update on Favorited Event',
                    message: `${event.title}: ${changes.significantUpdate}`,
                    relevanceScore: 0.8,
                });
                notificationCount++;
            }
        }

        return notificationCount;
    } catch (error) {
        console.error('Error processing favorited event updates:', error);
        return 0;
    }
}

/**
 * Evaluate if user should be notified about this event
 * Returns notification data if user should be notified, null otherwise
 */
async function evaluateEventForUser(
    user: any,
    event: IEvent
): Promise<{
    userId: string;
    eventId: string;
    type: string;
    title: string;
    message: string;
    relevanceScore: number;
} | null> {
    const userId = user._id.toString();
    const eventId = event._id.toString();

    // Check if notification already exists
    const existingNotification = await Notification.findOne({ userId, eventId });
    if (existingNotification) return null;

    // 1. KEYWORD MATCH (highest priority)
    const keywords = user.preferences.notifications.keywords || [];
    if (keywords.length > 0) {
        const titleLower = event.title.toLowerCase();
        const descLower = event.description?.toLowerCase() || '';
        const matchedKeyword = keywords.find((keyword: string) =>
            titleLower.includes(keyword.toLowerCase()) ||
            descLower.includes(keyword.toLowerCase())
        );

        if (matchedKeyword) {
            return {
                userId,
                eventId,
                type: 'keyword_match',
                title: `${matchedKeyword} Event Found`,
                message: `${event.title} at ${event.venue.name}`,
                relevanceScore: 1.0,
            };
        }
    }

    // 2. PERSONALIZED RECOMMENDATION
    if (user.preferences.notifications.smartFiltering?.enabled) {
        const score = await getRecommendationScore(user, event);
        const threshold = user.preferences.notifications.smartFiltering.minRecommendationScore || 0.6;

        if (score && score >= threshold) {
            return {
                userId,
                eventId,
                type: 'recommendation',
                title: `Recommended ${event.category} Event`,
                message: `${event.title} at ${event.venue.name}`,
                relevanceScore: score,
            };
        }
    }

    return null;
}

/**
 * Get recommendation score for a specific event
 */
async function getRecommendationScore(user: any, event: IEvent): Promise<number | null> {
    try {
        const recommendations = await getPersonalizedRecommendations(
            new mongoose.Types.ObjectId(user._id),
            user,
            {
                limit: 100,
                category: event.category,
                excludeFavorited: false,
            }
        );

        const match = recommendations.find(
            rec => rec.event._id.toString() === event._id.toString()
        );

        return match?.score || null;
    } catch (error) {
        console.error('Error getting recommendation score:', error);
        return null;
    }
}

/**
 * Create notification in database
 */
async function createNotification(data: {
    userId: string;
    eventId: string;
    type: string;
    title: string;
    message: string;
    relevanceScore: number;
}): Promise<void> {
    try {
        await Notification.create({
            userId: data.userId,
            eventId: data.eventId,
            type: data.type,
            title: data.title,
            message: data.message,
            relevanceScore: data.relevanceScore,
            read: false,
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

/**
 * Get unread notifications for user
 */
export async function getUnreadNotifications(userId: string) {
    return Notification.find({ userId, read: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('eventId')
        .lean();
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, read: false });
}

/**
 * Mark notifications as read
 */
export async function markAsRead(notificationIds: string[]): Promise<void> {
    await Notification.updateMany(
        { _id: { $in: notificationIds } },
        { $set: { read: true } }
    );
}

/**
 * Mark all notifications as read for user
 */
export async function markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
        { userId, read: false },
        { $set: { read: true } }
    );
}