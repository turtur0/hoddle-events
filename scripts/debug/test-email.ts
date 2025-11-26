// scripts/test-digest.ts
// Usage: tsx scripts/test-digest.ts your-email@example.com

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testDigest() {
    const testEmail = process.argv[2];

    if (!testEmail) {
        console.error('Usage: tsx scripts/test-digest.ts <email>');
        process.exit(1);
    }

    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected');

        const User = (await import('@/lib/models/User')).default;
        const { buildDigestContent } = await import('@/lib/services/emailDigestService');
        const { Resend } = await import('resend');
        const MonthlyDigestEmail = (await import('@/emails/DigestEmail')).default;

        console.log(`\nFetching user: ${testEmail}`);
        const user = await User.findOne({ email: testEmail }).lean();

        if (!user) {
            console.error(`User not found: ${testEmail}`);
            process.exit(1);
        }

        console.log(`Found user: ${user.name}`);
        console.log(`  Categories: ${user.preferences.selectedCategories.join(', ') || 'none'}`);
        console.log(`  Keywords: ${user.preferences.notifications.keywords.join(', ') || 'none'}`);
        console.log(`  Email enabled: ${user.preferences.notifications.email}`);

        console.log('\nBuilding digest content...');
        const content = await buildDigestContent(user, 'weekly');

        const stats = {
            keywordMatches: content.keywordMatches.length,
            updatedFavourites: content.updatedFavourites.length,
            recommendations: content.recommendations.reduce((sum: number, cat: any) => sum + cat.events.length, 0),
        };

        console.log('\nContent Summary:');
        console.log(`  Keyword matches: ${stats.keywordMatches}`);
        console.log(`  Updated favourites: ${stats.updatedFavourites}`);
        console.log(`  Recommendations: ${stats.recommendations}`);

        content.recommendations.forEach((rec: any) => {
            console.log(`    - ${rec.category}: ${rec.events.length} events`);
        });

        const hasContent = stats.keywordMatches > 0 || stats.updatedFavourites > 0 || stats.recommendations > 0;

        if (!hasContent) {
            console.log('\nNo content available - email would be skipped');
            console.log('\nTo get content:');
            console.log('  1. Add categories in user preferences');
            console.log('  2. Add notification keywords');
            console.log('  3. Favourite some events');
            console.log('  4. Ensure there are upcoming events in database');
            process.exit(0);
        }

        console.log('\nSending test email...');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
            from: 'Melbourne Events <onboarding@resend.dev>',
            to: testEmail,
            subject: `[TEST] Your ${stats.keywordMatches + stats.updatedFavourites + stats.recommendations} curated events`,
            react: MonthlyDigestEmail({
                userName: user.name,
                keywordMatches: content.keywordMatches,
                updatedFavorites: content.updatedFavourites,
                recommendations: content.recommendations,
                unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications`,
                preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications`,
            }),
        });

        if (error) {
            console.error('Email send failed:', error);
            process.exit(1);
        }

        console.log(`Email sent successfully`);
        console.log(`Email ID: ${data?.id}`);
        console.log(`\nCheck inbox: ${testEmail}`);

    } catch (error: any) {
        console.error('\nError:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from database');
    }
}

testDigest();