import User from '@/lib/models/User';
import Event from '@/lib/models/Event';
import UserFavourite from '../models/UserFavourite';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import DigestEmail from '../email/templates/digest-email';
import type { IEvent } from '@/lib/models/Event';
import { extractEventFeatures } from '@/lib/ml/vectorService';

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

/**
 * Serialized event type for email template
 */
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

/**
 * Digest content structure
 */
interface DigestContent {
    keywordMatches: IEvent[];
    updatedFavorites: IEvent[];
    recommendations: { category: string; events: IEvent[] }[];
}

/**
 * Send scheduled digest emails to all eligible users.
 * Called by cron job for weekly/monthly digests.
 */
export async function sendScheduledDigests(frequency: 'weekly' | 'monthly') {
    console.log(`[Digest] Starting ${frequency} digest send`);

    // Find users who want this frequency
    const users = await User.find({
        'preferences.notifications.email': true,
        'preferences.notifications.emailFrequency': frequency,
    }).lean();

    console.log(`[Digest] Found ${users.length} eligible users for ${frequency} digest`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
        try {
            const content = await gatherDigestContent(user, frequency);

            if (!hasContent(content)) {
                console.log(`[Digest] Skipping ${user.email} - no content`);
                skipped++;
                continue;
            }

            await sendDigestEmail(user, content, frequency);

            // Update last sent timestamp
            await User.updateOne(
                { _id: user._id },
                { $set: { 'preferences.notifications.lastEmailSent': new Date() } }
            );

            sent++;

            // Rate limiting: wait 100ms between emails
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`[Digest] Error for ${user.email}:`, error);
            errors++;
        }
    }

    console.log(`[Digest] Complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);
    return { sent, skipped, errors };
}

/**
 * Gather all content for the email digest
 */
async function gatherDigestContent(
    user: any,
    frequency: 'weekly' | 'monthly'
): Promise<DigestContent> {
    const now = new Date();

    // Lookback period: how far back to check for new events
    const lookbackDays = frequency === 'weekly' ? 7 : 30;
    const lookbackDate = user.preferences.notifications.lastEmailSent ||
        new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Lookahead period: how far forward to include upcoming events
    const lookaheadDays = frequency === 'weekly' ? 30 : 60;
    const maxDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

    console.log(`[Digest] Gathering content for ${user.email} since: ${lookbackDate.toISOString()}`);

    // 1. Keyword matches - NEW events only
    const keywordMatches = await findKeywordMatches(user, lookbackDate, maxDate);

    // 2. Updated favorites
    const updatedFavorites = await findUpdatedFavorites(user, lookbackDate);

    // 3. Personalized recommendations
    const recommendations = await buildRecommendations(user, lookbackDate, maxDate, frequency);

    console.log(`[Digest] Content for ${user.email}: ${keywordMatches.length} keywords, ${updatedFavorites.length} updated favorites, ${recommendations.length} recommendation categories`);

    return {
        keywordMatches,
        updatedFavorites,
        recommendations,
    };
}

/**
 * Find events matching user's notification keywords
 */
async function findKeywordMatches(
    user: any,
    sinceDate: Date,
    maxDate: Date
): Promise<IEvent[]> {
    const keywords = user.preferences.notifications.keywords || [];
    if (keywords.length === 0) {
        console.log(`[Digest] No keywords configured for ${user.email}`);
        return [];
    }

    console.log(`[Digest] Checking keywords for ${user.email}: ${keywords.join(', ')}`);

    const keywordRegex = keywords.join('|');

    const events = await Event.find({
        $or: [
            { title: { $regex: keywordRegex, $options: 'i' } },
            { description: { $regex: keywordRegex, $options: 'i' } },
        ],
        startDate: { $gte: new Date(), $lte: maxDate },
        scrapedAt: { $gte: sinceDate }, // Only new events
    })
        .sort({ startDate: 1 })
        .limit(5)
        .lean();

    console.log(`[Digest] Found ${events.length} keyword matches for ${user.email}`);
    return events;
}

/**
 * Find favorited events that have been updated
 */
async function findUpdatedFavorites(
    user: any,
    sinceDate: Date
): Promise<IEvent[]> {
    // Get user's favorite event IDs
    const favorites = await UserFavourite.find({ userId: user._id }).lean();
    const favoriteEventIds = favorites.map(f => f.eventId);

    if (favoriteEventIds.length === 0) {
        console.log(`[Digest] No favorites for ${user.email}`);
        return [];
    }

    console.log(`[Digest] User ${user.email} has ${favoriteEventIds.length} favorited events`);

    // Find favorited events that were updated since last email
    const events = await Event.find({
        _id: { $in: favoriteEventIds },
        startDate: { $gte: new Date() },
        lastUpdated: { $gt: sinceDate },
    })
        .sort({ startDate: 1 })
        .limit(5)
        .lean();

    console.log(`[Digest] Found ${events.length} updated favorites for ${user.email}`);
    if (events.length > 0) {
        console.log(`[Digest] Updated favorites: ${events.map(e => e.title).join(', ')}`);
    }

    return events;
}

/**
 * Build personalized recommendations per category
 */
async function buildRecommendations(
    user: any,
    sinceDate: Date,
    maxDate: Date,
    frequency: 'weekly' | 'monthly'
): Promise<{ category: string; events: IEvent[] }[]> {
    const selectedCategories = user.preferences.selectedCategories || [];
    if (selectedCategories.length === 0) {
        console.log(`[Digest] No categories selected for ${user.email}`);
        return [];
    }

    console.log(`[Digest] Building recommendations for ${user.email} in categories: ${selectedCategories.join(', ')}`);

    // Get user's favorited events to exclude
    const favorites = await UserFavourite.find({ userId: user._id }).lean();
    const favoriteEventIds = favorites.map(f => f.eventId);

    const eventsPerCategory = frequency === 'weekly' ? 3 : 5;
    const recommendations: { category: string; events: IEvent[] }[] = [];

    for (const category of selectedCategories) {
        // Get new events in this category
        const candidateEvents = await Event.find({
            category,
            startDate: { $gte: new Date(), $lte: maxDate },
            scrapedAt: { $gte: sinceDate }, // Only new events
            _id: { $nin: favoriteEventIds }, // Exclude already favorited
        })
            .sort({ startDate: 1 })
            .limit(100)
            .lean();

        console.log(`[Digest] Found ${candidateEvents.length} new events in ${category} for ${user.email}`);

        if (candidateEvents.length === 0) continue;

        // Score and rank events
        const userVector = buildSimpleUserVector(user);

        const scored = candidateEvents.map(event => {
            const eventVector = extractEventFeatures(event);
            const contentMatch = cosineSimilarity(userVector, eventVector.fullVector);
            const popularity = Math.min((event.stats?.favouriteCount || 0) / 100, 1);
            const score = contentMatch * 0.7 + popularity * 0.3;

            return { event, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const topEvents = scored.slice(0, eventsPerCategory).map(s => s.event);

        if (topEvents.length > 0) {
            recommendations.push({ category, events: topEvents });
            console.log(`[Digest] Added ${topEvents.length} recommendations for ${category}`);
        }
    }

    return recommendations;
}

/**
 * Send digest email to a single user
 */
async function sendDigestEmail(
    user: any,
    content: DigestContent,
    frequency: 'weekly' | 'monthly'
) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const unsubscribeUrl = `${baseUrl}/settings`;
    const preferencesUrl = `${baseUrl}/settings`;

    // Serialize events for email template
    const serializedContent = {
        keywordMatches: content.keywordMatches.map(serializeEvent),
        updatedFavorites: content.updatedFavorites.map(serializeEvent),
        recommendations: content.recommendations.map(cat => ({
            category: cat.category,
            events: cat.events.map(serializeEvent),
        })),
    };

    // Render email HTML
    const emailHtml = await render(
        DigestEmail({
            userName: user.name.split(' ')[0] || 'there',
            keywordMatches: serializedContent.keywordMatches,
            updatedFavorites: serializedContent.updatedFavorites,
            recommendations: serializedContent.recommendations,
            unsubscribeUrl,
            preferencesUrl,
        })
    );

    // Send email via Resend
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
        from: 'Melbourne Events <onboarding@resend.dev>', // Change to your verified domain
        to: user.email,
        subject: getDigestSubject(content, frequency),
        html: emailHtml,
    });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log(`[Digest] Successfully sent ${frequency} digest to ${user.email}`);
    return data;
}

/**
 * Helper: Serialize event for email template
 */
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

/**
 * Helper: Check if digest has any content
 */
function hasContent(content: DigestContent): boolean {
    return (
        content.keywordMatches.length > 0 ||
        content.updatedFavorites.length > 0 ||
        content.recommendations.length > 0
    );
}

/**
 * Helper: Generate email subject line
 */
function getDigestSubject(content: DigestContent, frequency: 'weekly' | 'monthly'): string {
    const total =
        content.keywordMatches.length +
        content.updatedFavorites.length +
        content.recommendations.reduce((sum, cat) => sum + cat.events.length, 0);

    const periodText = frequency === 'weekly' ? 'This Week' : 'This Month';

    if (content.keywordMatches.length > 0) {
        const firstEvent = content.keywordMatches[0];
        return `${total} events including "${firstEvent.title}" - Melbourne Events`;
    }

    return `${total} curated events for you ${periodText} - Melbourne Events`;
}

/**
 * Helper: Build simple user preference vector
 */
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

/**
 * Helper: Calculate cosine similarity
 */
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