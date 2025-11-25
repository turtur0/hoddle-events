// lib/services/notificationService.ts
import User from '@/lib/models/User';
import UserFavourite from '../models/UserFavourites';
import Notification from '../models/Notifications';
import { IEvent } from '@/lib/models/Event';
import { extractEventFeatures, cosineSimilarity } from '@/lib/ml/vectorService';
import { CATEGORIES } from '@/lib/categories';

interface NotificationData {
    userId: string;
    eventId: string;
    type: string;
    title: string;
    message: string;
    relevanceScore: number;
}

interface EventChanges {
    priceDropped?: boolean;
    priceDrop?: number;
    significantUpdate?: string;
}

/**
 * Process notifications for a new event.
 * Checks all users with notifications enabled for keyword matches and personalized recommendations.
 */
export async function processNewEventNotifications(event: IEvent): Promise<number> {
    try {
        const users = await User.find({ 'preferences.notifications.inApp': true }).lean();

        if (users.length === 0) {
            console.log('[Notifications] No users with notifications enabled');
            return 0;
        }

        console.log(`[Notifications] Evaluating ${users.length} users for event: ${event.title}`);
        let notificationCount = 0;

        for (const user of users) {
            try {
                const notification = await evaluateEventForUser(user, event);
                if (notification) {
                    await createNotification(notification);
                    notificationCount++;
                }
            } catch (userError) {
                console.error(`[Notifications] Error for user ${user.email}:`, userError);
            }
        }

        if (notificationCount > 0) {
            console.log(`[Notifications] Sent ${notificationCount} notifications`);
        }

        return notificationCount;
    } catch (error) {
        console.error('[Notifications] Error processing new event:', error);
        return 0;
    }
}

/**
 * Process notifications for favorited event updates.
 * Notifies users who favorited an event when prices change or significant updates occur.
 */
export async function processFavoritedEventUpdate(
    event: IEvent,
    changes: EventChanges
): Promise<number> {
    try {
        // Find users who favorited this event
        const favorites = await UserFavourite.find({ eventId: event._id }).lean();
        if (favorites.length === 0) return 0;

        const userIds = favorites.map(f => f.userId);
        const users = await User.find({
            _id: { $in: userIds },
            'preferences.notifications.inApp': true,
        }).lean();

        if (users.length === 0) return 0;

        console.log(`[Notifications] Processing favorite update for ${users.length} users: ${event.title}`);
        let notificationCount = 0;

        for (const user of users) {
            // Prevent duplicate notifications within the last hour
            const recentNotification = await Notification.findOne({
                userId: user._id,
                eventId: event._id,
                type: 'favorite_update',
                createdAt: { $gte: new Date(Date.now() - 3600000) }
            });

            if (recentNotification) continue;

            // Send appropriate notification based on change type
            if (changes.priceDropped && changes.priceDrop) {
                await createNotification({
                    userId: user._id.toString(),
                    eventId: event._id.toString(),
                    type: 'favorite_update',
                    title: 'Price Drop on Favorited Event',
                    message: `${event.title} is now $${changes.priceDrop.toFixed(2)} cheaper!`,
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

        if (notificationCount > 0) {
            console.log(`[Notifications] Sent ${notificationCount} favorite update notifications`);
        }

        return notificationCount;
    } catch (error) {
        console.error('[Notifications] Error processing favorite updates:', error);
        return 0;
    }
}

/**
 * Evaluate if a user should be notified about an event.
 * Checks for keyword matches first, then personalized recommendations.
 */
async function evaluateEventForUser(user: any, event: IEvent): Promise<NotificationData | null> {
    const userId = user._id.toString();
    const eventId = event._id.toString();

    // Skip if notification already exists
    const existingNotification = await Notification.findOne({ userId, eventId });
    if (existingNotification) return null;

    // Check for keyword matches (highest priority)
    const keywords = user.preferences?.notifications?.keywords || [];
    if (keywords.length > 0) {
        const matchedKeyword = findMatchingKeyword(event, keywords);
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

    // Check for personalized recommendations
    const smartFiltering = user.preferences?.notifications?.smartFiltering;
    if (smartFiltering?.enabled !== false) {
        const score = await calculateRecommendationScore(user, event);
        const threshold = smartFiltering?.minRecommendationScore || 0.6;

        if (score !== null && score >= threshold) {
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
 * Find if any user keywords match the event title or description.
 */
function findMatchingKeyword(event: IEvent, keywords: string[]): string | null {
    const titleLower = event.title.toLowerCase();
    const descLower = event.description?.toLowerCase() || '';

    return keywords.find(keyword =>
        titleLower.includes(keyword.toLowerCase()) ||
        descLower.includes(keyword.toLowerCase())
    ) || null;
}

/**
 * Calculate recommendation score for a specific event using direct vector comparison.
 * More efficient than full recommendation pipeline.
 */
async function calculateRecommendationScore(user: any, event: IEvent): Promise<number | null> {
    try {
        const userVector = buildUserPreferenceVector(user);
        const eventVector = extractEventFeatures(event);

        // Validate vector dimensions match
        if (userVector.length !== eventVector.fullVector.length) {
            console.error(`[Notifications] Vector mismatch: user=${userVector.length}, event=${eventVector.fullVector.length}`);
            return null;
        }

        // Calculate content similarity
        const contentMatch = cosineSimilarity(userVector, eventVector.fullVector);

        // Add popularity component
        const popularity = Math.min((event.stats?.favouriteCount || 0) / 100, 1);

        // Combined score: 70% content match + 30% popularity
        return contentMatch * 0.7 + popularity * 0.3;
    } catch (error) {
        console.error('[Notifications] Error calculating score:', error);
        return null;
    }
}

/**
 * Build user preference vector matching the structure used in recommendation service.
 * Must stay in sync with recommendationService.ts buildSimpleUserVector.
 */
function buildUserPreferenceVector(user: any): number[] {
    const vector: number[] = [];
    const categoryWeights = user.preferences?.categoryWeights || {};

    // Convert Map to object if needed
    const weights = categoryWeights instanceof Map
        ? Object.fromEntries(categoryWeights)
        : categoryWeights;

    // Category weights
    for (const cat of CATEGORIES) {
        vector.push((weights[cat.value] || 0.5) * 10.0);
    }

    // Subcategory weights
    for (const cat of CATEGORIES) {
        const categoryWeight = weights[cat.value] || 0.5;
        const subcategories = cat.subcategories || [];
        for (const sub of subcategories) {
            vector.push(categoryWeight * 2.0);
        }
    }

    // User preference dimensions
    vector.push((user.preferences?.pricePreference || 0.5) * 1.0);
    vector.push((user.preferences?.venuePreference || 0.5) * 1.0);
    vector.push((user.preferences?.popularityPreference || 0.5) * 3.0);

    return vector;
}

/**
 * Create a notification record in the database.
 */
async function createNotification(data: NotificationData): Promise<void> {
    await Notification.create({
        userId: data.userId,
        eventId: data.eventId,
        type: data.type,
        title: data.title,
        message: data.message,
        relevanceScore: data.relevanceScore,
        read: false,
    });
}

// Query functions for notification retrieval

export async function getUnreadNotifications(userId: string) {
    return Notification.find({ userId, read: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('eventId')
        .lean();
}

export async function getAllNotifications(userId: string) {
    return Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('eventId')
        .lean();
}

export async function getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, read: false });
}

export async function markAsRead(notificationIds: string[]): Promise<void> {
    await Notification.updateMany(
        { _id: { $in: notificationIds } },
        { $set: { read: true } }
    );
}

export async function markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
        { userId, read: false },
        { $set: { read: true } }
    );
}