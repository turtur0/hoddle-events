// lib/email/emailService.ts - FULLY FIXED VERSION
import { Resend } from 'resend';
import { render } from '@react-email/render';
import MonthlyDigestEmail from '@/emails/DigestEmail';
import User from '@/lib/models/User';
import Event from '@/lib/models/Event';
import UserFavourite from '@/lib/models/UserFavourites';
import { getPersonalizedRecommendations } from '@/lib/ml/recommendationService';
import type { IEvent } from '@/lib/models/Event';
import mongoose from 'mongoose';
import { extractEventFeatures } from '../ml/vectorService';

// Lazy initialization - only create client when needed
let resendClient: Resend | null = null;
function getResendClient() {
    if (!resendClient) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY environment variable is not set');
        }
        resendClient = new Resend(process.env.RESEND_API_KEY);
    }
    return resendClient;
}

// Helper to serialize events for email template
interface SerializedEvent {
    _id: string;
    title: string;
    startDate: string;
    venue: { name: string };
    priceMin?: number;
    priceMax?: number;
    isFree: boolean;
    imageUrl?: string;
    category: string;
}

function serializeEvent(event: IEvent): SerializedEvent {
    return {
        _id: event._id.toString(),
        title: event.title,
        startDate: event.startDate.toISOString(),
        venue: { name: event.venue.name },
        priceMin: event.priceMin,
        priceMax: event.priceMax,
        isFree: event.isFree,
        imageUrl: event.imageUrl,
        category: event.category,
    };
}

interface EmailContent {
    keywordMatches: IEvent[];
    updatedFavorites: IEvent[];
    recommendations: { category: string; events: IEvent[] }[];
}

/**
 * Send monthly digest to a single user
 */
export async function sendMonthlyDigest(userId: mongoose.Types.ObjectId): Promise<boolean> {
    try {
        const user = await User.findById(userId);

        if (!user || !user.preferences.notifications.email) {
            return false;
        }

        // Gather content for email
        const content = await gatherEmailContent(userId, user);

        // Skip if no content to send
        const hasContent =
            content.keywordMatches.length > 0 ||
            content.updatedFavorites.length > 0 ||
            content.recommendations.length > 0;

        if (!hasContent) {
            console.log(`[Email] Skipping ${user.email} - no new content since last email`);
            return false;
        }

        // Serialize events for email template
        const serializedContent = {
            keywordMatches: content.keywordMatches.map(serializeEvent),
            updatedFavorites: content.updatedFavorites.map(serializeEvent),
            recommendations: content.recommendations.map(cat => ({
                category: cat.category,
                events: cat.events.map(serializeEvent),
            })),
        };

        // Generate unsubscribe token if doesn't exist
        const unsubscribeToken = user._id.toString();

        // Render email HTML
        const emailHtml = await render(
            MonthlyDigestEmail({
                userName: user.name.split(' ')[0],
                keywordMatches: serializedContent.keywordMatches,
                updatedFavorites: serializedContent.updatedFavorites,
                recommendations: serializedContent.recommendations,
                unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/unsubscribe/${unsubscribeToken}`,
                preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings`,
            })
        );

        // Send email via Resend
        const resend = getResendClient();
        const { data, error } = await resend.emails.send({
            from: 'Melbourne Events <onboarding@resend.dev>',
            to: user.email,
            subject: `${content.keywordMatches.length + content.updatedFavorites.length + content.recommendations.reduce((sum, cat) => sum + cat.events.length, 0)} new events curated for you`,
            html: emailHtml,
        });

        if (error) {
            console.error(`[Email] Failed to send to ${user.email}:`, error);
            return false;
        }

        // Update last email sent timestamp
        user.preferences.notifications.lastEmailSent = new Date();
        await user.save();

        console.log(`[Email] Successfully sent to ${user.email}`);
        console.log(`[Email] Content: ${content.keywordMatches.length} keywords, ${content.updatedFavorites.length} updated favorites, ${content.recommendations.length} recommendation categories`);
        return true;

    } catch (error) {
        console.error(`[Email] Error sending to user ${userId}:`, error);
        return false;
    }
}

/**
 * Gather all content for the email
 */
async function gatherEmailContent(userId: mongoose.Types.ObjectId, user: any): Promise<EmailContent> {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Get last email sent date (default to 30 days ago if never sent)
    const lastEmailDate = user.preferences.notifications.lastEmailSent ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.log(`[Email] Gathering content for user since: ${lastEmailDate.toISOString()}`);

    // 1. Keyword matches - NEW events only
    const keywords = user.preferences.notifications.keywords || [];
    let keywordMatches: IEvent[] = [];

    if (keywords.length > 0) {
        console.log(`[Email] Checking keywords: ${keywords.join(', ')}`);
        const keywordRegex = keywords.join('|');
        keywordMatches = await Event.find({
            $or: [
                { title: { $regex: keywordRegex, $options: 'i' } },
                { description: { $regex: keywordRegex, $options: 'i' } }
            ],
            startDate: { $gte: now, $lte: nextMonth },
            scrapedAt: { $gte: lastEmailDate } // Only new events
        })
            .sort({ startDate: 1 })
            .limit(5)
            .lean();

        console.log(`[Email] Found ${keywordMatches.length} keyword matches`);
    } else {
        console.log(`[Email] No keywords configured for user`);
    }

    // 2. Updated favorites - ONLY events with price changes or significant updates
    // Get all user's favorites
    const favorites = await UserFavourite.find({ userId }).lean();
    const favoriteEventIds = favorites.map(f => f.eventId);

    console.log(`[Email] User has ${favoriteEventIds.length} favorited events`);

    // For updated favorites, we need events that:
    // - Are favorited by user
    // - Are upcoming
    // - Have lastUpdated AFTER the last email was sent
    const updatedFavorites = await Event.find({
        _id: { $in: favoriteEventIds },
        startDate: { $gte: now },
        lastUpdated: { $gt: lastEmailDate }
    })
        .sort({ startDate: 1 })
        .limit(5)
        .lean();

    console.log(`[Email] Found ${updatedFavorites.length} updated favorites`);
    if (updatedFavorites.length > 0) {
        console.log(`[Email] Updated favorites: ${updatedFavorites.map(e => e.title).join(', ')}`);
    }

    // 3. Personalized recommendations - Events added since last email, EXCLUDING favorited
    const selectedCategories = user.preferences.selectedCategories || [];
    const recommendations: { category: string; events: IEvent[] }[] = [];

    console.log(`[Email] Generating recommendations for categories: ${selectedCategories.join(', ')}`);

    for (const category of selectedCategories) {
        // RELAXED APPROACH: Get all upcoming events in category, then filter by scrapedAt
        // This way we still get recommendations even if scrapedAt isn't perfectly set
        const candidateEvents = await Event.find({
            category,
            startDate: { $gte: now, $lte: nextMonth },
            _id: { $nin: favoriteEventIds } // Exclude favorited events
        })
            .sort({ startDate: 1 })
            .limit(100)
            .lean();

        console.log(`[Email] Found ${candidateEvents.length} candidate events for ${category}`);

        // Filter to only "new" events (added since last email)
        // If scrapedAt is missing or old, include it anyway for better UX
        const newEvents = candidateEvents.filter(event => {
            const isNew = event.scrapedAt >= lastEmailDate;
            return isNew;
        });

        // If no "new" events, fall back to top-scored events from all candidates
        const eventsToScore = newEvents.length > 0 ? newEvents : candidateEvents.slice(0, 20);

        console.log(`[Email] Scoring ${eventsToScore.length} events for ${category} (${newEvents.length} new, ${candidateEvents.length - newEvents.length} existing)`);

        if (eventsToScore.length === 0) continue;

        // Score and rank these events
        const userPreferences = buildSimpleUserVector(user);

        const scored = eventsToScore.map(event => {
            const eventVector = extractEventFeatures(event);
            const contentMatch = cosineSimilarity(userPreferences, eventVector.fullVector);
            const popularity = Math.min((event.stats?.favouriteCount || 0) / 100, 1);
            const score = contentMatch * 0.7 + popularity * 0.3;

            return { event, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const topEvents = scored.slice(0, 3).map(s => s.event);

        if (topEvents.length > 0) {
            recommendations.push({
                category,
                events: topEvents
            });
            console.log(`[Email] Added ${topEvents.length} recommendations for ${category}`);
        }
    }

    console.log(`[Email] Total recommendations: ${recommendations.length} categories`);

    return {
        keywordMatches,
        updatedFavorites,
        recommendations
    };
}

// Helper function for scoring (used above)
function buildSimpleUserVector(user: any): number[] {
    const vector: number[] = [];
    const categoryWeights = user.preferences?.categoryWeights || {};
    const categories = ['music', 'theatre', 'sports', 'arts', 'family', 'other'];

    for (const cat of categories) {
        vector.push((categoryWeights[cat] || 0.5) * 10.0);
    }

    const CATEGORIES = [
        { value: 'music', subcategories: ['Rock & Alternative', 'Pop & Electronic', 'Hip Hop & R&B', 'Jazz & Blues', 'Classical & Orchestra', 'Country & Folk', 'Metal & Punk', 'World Music'] },
        { value: 'theatre', subcategories: ['Musicals', 'Drama', 'Comedy Shows', 'Ballet & Dance', 'Opera', 'Cabaret', 'Shakespeare', 'Experimental'] },
        { value: 'sports', subcategories: ['AFL', 'Cricket', 'Soccer', 'Basketball', 'Tennis', 'Rugby', 'Motorsports', 'Other Sports'] },
        { value: 'arts', subcategories: ['Comedy Festival', 'Film & Cinema', 'Art Exhibitions', 'Literary Events', 'Cultural Festivals', 'Markets & Fairs'] },
        { value: 'family', subcategories: ['Kids Shows', 'Family Entertainment', 'Educational', 'Circus & Magic'] },
        { value: 'other', subcategories: ['Workshops', 'Networking', 'Wellness', 'Community Events'] },
    ];

    const ALL_SUBCATEGORIES = CATEGORIES.flatMap(cat =>
        (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
    );

    for (const fullSubcat of ALL_SUBCATEGORIES) {
        const [category] = fullSubcat.split(':');
        const categoryWeight = categoryWeights[category] || 0.5;
        vector.push(categoryWeight * 2.0);
    }

    vector.push((user.preferences?.pricePreference || 0.5) * 1.0);
    vector.push((user.preferences?.venuePreference || 0.5) * 1.0);
    vector.push((user.preferences?.popularityPreference || 0.5) * 3.0);

    return vector;
}

function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
        throw new Error(`Vector length mismatch: ${vectorA.length} vs ${vectorB.length}`);
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i];
        magnitudeA += vectorA[i] * vectorA[i];
        magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Send monthly digests to all eligible users
 * Called by cron job
 */
export async function sendMonthlyDigestsToAll(): Promise<{
    sent: number;
    skipped: number;
    failed: number;
}> {
    console.log('[Email] Starting monthly digest batch...');

    const users = await User.find({
        'preferences.notifications.email': true,
    }).select('_id email name');

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
        try {
            const result = await sendMonthlyDigest(user._id);
            if (result) {
                sent++;
            } else {
                skipped++;
            }

            // Rate limiting: wait 100ms between emails
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`[Email] Error processing user ${user._id}:`, error);
            failed++;
        }
    }

    console.log(`[Email] Batch complete: ${sent} sent, ${skipped} skipped, ${failed} failed`);

    return { sent, skipped, failed };
}