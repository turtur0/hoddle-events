// lib/services/emailDigestService.ts
import User from '@/lib/models/User';
import Event from '@/lib/models/Event';
import { Resend } from 'resend';
import MonthlyDigestEmail from '@/emails/DigestEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

interface DigestContent {
    keywordMatches: any[];
    updatedFavourites: any[];
    recommendations: { category: string; events: any[] }[];
}

/**
 * Send scheduled digest emails to all eligible users.
 * Called by cron job for weekly/monthly digests.
 */
export async function sendScheduledDigests(frequency: 'weekly' | 'monthly') {
    console.log(`[Digest] Starting ${frequency} send`);

    // Monthly digests only send on first Sunday of month
    if (frequency === 'monthly' && !isFirstWeekOfMonth()) {
        console.log(`[Digest] Skipping monthly - not first week`);
        return { sent: 0, skipped: 0, errors: 0 };
    }

    const users = await User.find({
        'preferences.notifications.email': true,
        'preferences.notifications.emailFrequency': frequency,
    }).lean();

    console.log(`[Digest] Found ${users.length} eligible users`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
        try {
            const content = await buildDigestContent(user, frequency);

            if (!hasContent(content)) {
                skipped++;
                continue;
            }

            await sendDigestEmail(user, content);

            await User.updateOne(
                { _id: user._id },
                { $set: { 'preferences.notifications.lastEmailSent': new Date() } }
            );

            sent++;
        } catch (error) {
            console.error(`[Digest] Error for ${user.email}:`, error);
            errors++;
        }
    }

    console.log(`[Digest] Complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);
    return { sent, skipped, errors };
}

/**
 * Build personalised digest content for a single user.
 * Includes keyword matches, updated favourites, and recommendations.
 */
export async function buildDigestContent(
    user: any,
    frequency: 'weekly' | 'monthly'
): Promise<DigestContent> {
    const now = new Date();
    const lookbackDays = frequency === 'weekly' ? 7 : 30;
    const lookbackDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    const lookaheadDays = frequency === 'weekly' ? 30 : 60;
    const maxDate = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

    const keywordMatches = await findKeywordMatches(user, lookbackDate, maxDate);
    const updatedFavourites = await findUpdatedFavourites(user, lookbackDate);
    const recommendations = await buildRecommendations(user, maxDate, frequency);

    return {
        keywordMatches,
        updatedFavourites,
        recommendations,
    };
}

/**
 * Find events matching user's notification keywords.
 */
async function findKeywordMatches(
    user: any,
    sinceDate: Date,
    maxDate: Date
): Promise<any[]> {
    const keywords = user.preferences.notifications.keywords || [];
    if (keywords.length === 0) return [];

    const regexPatterns = keywords.map((kw: string) => new RegExp(kw, 'i'));

    const events = await Event.find({
        startDate: { $gte: new Date(), $lte: maxDate },
        scrapedAt: { $gte: sinceDate },
        $or: [
            { title: { $in: regexPatterns } },
            { description: { $in: regexPatterns } },
            { subcategories: { $in: keywords } },
        ],
    })
        .sort({ 'stats.categoryPopularityPercentile': -1 })
        .limit(10)
        .lean();

    return events;
}

/**
 * Find favourited events that have been updated.
 */
async function findUpdatedFavourites(
    user: any,
    sinceDate: Date
): Promise<any[]> {
    if (!user.favorites || user.favorites.length === 0) return [];

    const events = await Event.find({
        _id: { $in: user.favorites },
        lastUpdated: { $gte: sinceDate },
        startDate: { $gte: new Date() },
    })
        .sort({ lastUpdated: -1 })
        .limit(10)
        .lean();

    return events;
}

/**
 * Build category-based recommendations.
 */
async function buildRecommendations(
    user: any,
    maxDate: Date,
    frequency: 'weekly' | 'monthly'
): Promise<{ category: string; events: any[] }[]> {
    const categories = user.preferences.selectedCategories || [];
    if (categories.length === 0) return [];

    const eventsPerCategory = frequency === 'weekly' ? 5 : 8;
    const minScore = user.preferences.notifications.smartFiltering?.minRecommendationScore || 0.6;

    const recommendations: { category: string; events: any[] }[] = [];

    for (const category of categories) {
        const events = await Event.find({
            category: category,
            startDate: { $gte: new Date(), $lte: maxDate },
            'stats.categoryPopularityPercentile': { $gte: minScore },
        })
            .sort({
                'stats.categoryPopularityPercentile': -1,
                startDate: 1,
            })
            .limit(eventsPerCategory)
            .lean();

        if (events.length > 0) {
            recommendations.push({ category, events });
        }
    }

    return recommendations;
}

/**
 * Send digest email to a single user.
 */
async function sendDigestEmail(user: any, content: DigestContent) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const unsubscribeUrl = `${baseUrl}/settings/notifications?unsubscribe=email`;
    const preferencesUrl = `${baseUrl}/settings/notifications`;

    const { data, error } = await resend.emails.send({
        from: 'Melbourne Events <events@yourdomain.com>',
        to: user.email,
        subject: getDigestSubject(content),
        react: MonthlyDigestEmail({
            userName: user.name,
            keywordMatches: content.keywordMatches,
            updatedFavorites: content.updatedFavourites,
            recommendations: content.recommendations,
            unsubscribeUrl,
            preferencesUrl,
        }),
    });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
}

/**
 * Check if digest has any content worth sending.
 */
function hasContent(content: DigestContent): boolean {
    return (
        content.keywordMatches.length > 0 ||
        content.updatedFavourites.length > 0 ||
        content.recommendations.length > 0
    );
}

/**
 * Generate email subject line based on content.
 */
function getDigestSubject(content: DigestContent): string {
    const total =
        content.keywordMatches.length +
        content.updatedFavourites.length +
        content.recommendations.reduce((sum, cat) => sum + cat.events.length, 0);

    if (content.keywordMatches.length > 0) {
        return `${total} events including "${content.keywordMatches[0].title}" - Melbourne Events`;
    }

    return `${total} curated events for you - Melbourne Events`;
}

/**
 * Check if today is in the first week of the month.
 */
function isFirstWeekOfMonth(): boolean {
    const today = new Date();
    return today.getDate() <= 7;
}

export default buildDigestContent;