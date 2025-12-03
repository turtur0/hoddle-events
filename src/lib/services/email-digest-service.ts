import { Resend } from 'resend';
import { render } from '@react-email/render';
import DigestEmail from '@/lib/email/templates/digest-email';

import { Event, User, UserFavourite, type IEvent } from '@/lib/models';
import { computeUserProfile, scoreEventForUser, type ScoredEvent } from '@/lib/ml';
import { getRecommendationsCount } from '@/lib/constants/preferences';

// ============================================
// CONFIGURATION
// ============================================

const EMAIL_CONFIG = {
    from: 'Hoddle Events <hello@hoddleevents.com.au>',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.hoddleevents.com.au',
    rateLimit: 100, // ms between emails
};

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SerialisedEvent {
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

interface DigestContent {
    keywordMatches: IEvent[];
    updatedFavourites: IEvent[];
    recommendations: { category: string; events: IEvent[] }[];
}

interface DigestResult {
    sent: number;
    skipped: number;
    errors: number;
}

// ============================================
// RESEND CLIENT
// ============================================

let resendClient: Resend | null = null;

function getResendClient(): Resend {
    if (!resendClient) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY environment variable is not set');
        }
        resendClient = new Resend(process.env.RESEND_API_KEY);
    }
    return resendClient;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if digest has any content worth sending
 */
function hasContent(content: DigestContent): boolean {
    return (
        content.keywordMatches.length > 0 ||
        content.updatedFavourites.length > 0 ||
        content.recommendations.length > 0
    );
}

/**
 * Generate email subject line based on content
 */
function getDigestSubject(content: DigestContent, frequency: 'weekly' | 'monthly'): string {
    const total =
        content.keywordMatches.length +
        content.updatedFavourites.length +
        content.recommendations.reduce((sum, cat) => sum + cat.events.length, 0);

    const periodText = frequency === 'weekly' ? 'This Week' : 'This Month';

    if (content.keywordMatches.length > 0) {
        return `${total} events including "${content.keywordMatches[0].title}" - Hoddle`;
    }

    return `${total} curated events for you ${periodText} - Hoddle`;
}

/**
 * Convert event to serialisable format for email template
 */
function serialiseEvent(event: IEvent): SerialisedEvent {
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

// ============================================
// CONTENT GATHERING
// ============================================

/**
 * Find events matching user's keywords
 */
async function findKeywordMatches(
    user: any,
    sinceDate: Date,
    maxDate: Date
): Promise<IEvent[]> {
    const keywords = user.preferences?.notifications?.keywords || [];
    if (!keywords.length) return [];

    const keywordRegex = keywords.join('|');

    const events = await Event.find({
        $or: [
            { title: { $regex: keywordRegex, $options: 'i' } },
            { description: { $regex: keywordRegex, $options: 'i' } },
        ],
        startDate: { $gte: new Date(), $lte: maxDate },
        scrapedAt: { $gte: sinceDate },
        isArchived: { $ne: true },
    })
        .sort({ startDate: 1 })
        .lean();

    return events;
}

/**
 * Find user's favourite events with significant content updates
 */
async function findUpdatedFavourites(
    user: any,
    sinceDate: Date
): Promise<IEvent[]> {
    const includeFavouriteUpdates = user.preferences?.notifications?.includeFavouriteUpdates ?? true;
    if (!includeFavouriteUpdates) return [];

    const favourites = await UserFavourite.find({ userId: user._id }).lean();
    if (!favourites.length) return [];

    const favouriteEventIds = favourites.map(f => f.eventId);

    const events = await Event.find({
        _id: { $in: favouriteEventIds },
        startDate: { $gte: new Date() },
        lastContentChange: { $exists: true, $gt: sinceDate },
        isArchived: { $ne: true },
    })
        .sort({ startDate: 1 })
        .lean();

    return events;
}

/**
 * Build personalised recommendations by category using ML recommendation engine
 */
async function buildRecommendations(
    user: any,
    sinceDate: Date,
    maxDate: Date
): Promise<{ category: string; events: IEvent[] }[]> {
    const selectedCategories = user.preferences?.selectedCategories || [];
    if (!selectedCategories.length) return [];

    const recommendationsSize = user.preferences?.notifications?.recommendationsSize || 'moderate';
    const customCount = user.preferences?.notifications?.customRecommendationsCount;
    const eventsPerCategory = getRecommendationsCount(recommendationsSize, customCount);

    const userProfile = await computeUserProfile(user._id, user);

    const favourites = await UserFavourite.find({ userId: user._id }).lean();
    const favouriteEventIds = new Set(favourites.map(f => f.eventId.toString()));

    const recentFavourites = favourites.slice(0, 10);
    const recentFavouriteVectors = await Promise.all(
        recentFavourites.map(async fav => {
            const event = await Event.findById(fav.eventId).lean();
            if (!event) return null;
            const { extractEventFeatures } = await import('@/lib/ml/vector-service');
            return extractEventFeatures(event);
        })
    ).then(vectors => vectors.filter(v => v !== null));

    const recommendations: { category: string; events: IEvent[] }[] = [];

    for (const category of selectedCategories) {
        const candidateEvents = await Event.find({
            category,
            startDate: { $gte: new Date(), $lte: maxDate },
            scrapedAt: { $gte: sinceDate },
            isArchived: { $ne: true },
        })
            .sort({ startDate: 1 })
            .limit(100)
            .lean();

        if (!candidateEvents.length) continue;

        const unfavouritedEvents = candidateEvents.filter(
            event => !favouriteEventIds.has(event._id.toString())
        );

        if (!unfavouritedEvents.length) continue;

        const scoredEvents: ScoredEvent[] = unfavouritedEvents.map(event =>
            scoreEventForUser(userProfile, event, user, recentFavouriteVectors as any)
        );

        scoredEvents.sort((a, b) => b.score - a.score);
        const topEvents = scoredEvents.slice(0, eventsPerCategory).map(s => s.event);

        if (topEvents.length > 0) {
            recommendations.push({ category, events: topEvents });
        }
    }

    return recommendations;
}

/**
 * Gather all content for digest email
 */
async function gatherDigestContent(
    user: any,
    frequency: 'weekly' | 'monthly'
): Promise<DigestContent> {
    const now = new Date();

    const lookbackDays = frequency === 'weekly' ? 7 : 30;
    const lookbackDate = user.preferences?.notifications?.lastEmailSent ||
        new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const lookaheadDays = frequency === 'weekly' ? 30 : 60;
    const maxDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

    const [keywordMatches, updatedFavourites, recommendations] = await Promise.all([
        findKeywordMatches(user, lookbackDate, maxDate),
        findUpdatedFavourites(user, lookbackDate),
        buildRecommendations(user, lookbackDate, maxDate),
    ]);

    return { keywordMatches, updatedFavourites, recommendations };
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send digest email to user
 */
async function sendDigestEmail(
    user: any,
    content: DigestContent,
    frequency: 'weekly' | 'monthly'
): Promise<void> {
    const serialisedContent = {
        keywordMatches: content.keywordMatches.map(serialiseEvent),
        updatedFavourites: content.updatedFavourites.map(serialiseEvent),
        recommendations: content.recommendations.map(cat => ({
            category: cat.category,
            events: cat.events.map(serialiseEvent),
        })),
    };

    const emailHtml = await render(
        DigestEmail({
            userName: user.name?.split(' ')[0] || 'there',
            keywordMatches: serialisedContent.keywordMatches,
            updatedFavourites: serialisedContent.updatedFavourites,
            recommendations: serialisedContent.recommendations,
            unsubscribeUrl: `${EMAIL_CONFIG.baseUrl}/settings`,
            preferencesUrl: `${EMAIL_CONFIG.baseUrl}/settings`,
        })
    );

    const resend = getResendClient();
    const { error } = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: user.email,
        subject: getDigestSubject(content, frequency),
        html: emailHtml,
        replyTo: 'hello@hoddleevents.com.au',
    });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log(`[Digest] Sent ${frequency} digest to ${user.email}`);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Send scheduled digest emails to all eligible users
 */
export async function sendScheduledDigests(
    frequency: 'weekly' | 'monthly'
): Promise<DigestResult> {
    console.log(`[Digest] Starting ${frequency} digest send`);

    const users = await User.find({
        'preferences.notifications.email': true,
        'preferences.notifications.emailFrequency': frequency,
    }).lean();

    console.log(`[Digest] Found ${users.length} eligible users`);

    const result: DigestResult = { sent: 0, skipped: 0, errors: 0 };

    for (const user of users) {
        try {
            const content = await gatherDigestContent(user, frequency);

            if (!hasContent(content)) {
                console.log(`[Digest] Skipping ${user.email} - no content`);
                result.skipped++;
                continue;
            }

            await sendDigestEmail(user, content, frequency);

            await User.updateOne(
                { _id: user._id },
                { $set: { 'preferences.notifications.lastEmailSent': new Date() } }
            );

            result.sent++;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.rateLimit));

        } catch (error) {
            console.error(`[Digest] Error for ${user.email}:`, error);
            result.errors++;
        }
    }

    console.log(`[Digest] Complete:`, result);
    return result;
}