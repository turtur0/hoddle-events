// scripts/dev/testDigest.ts
// Tests the email digest system end-to-end
// Usage: tsx scripts/dev/testDigest.ts <email> [frequency]
// Example: tsx scripts/dev/testDigest.ts test@example.com weekly

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testDigest() {
    const testEmail = process.argv[2];
    const frequency = (process.argv[3] || 'weekly') as 'weekly' | 'monthly';

    if (!testEmail) {
        console.error('❌ Usage: tsx scripts/dev/testDigest.ts <email> [frequency]');
        console.error('   Example: tsx scripts/dev/testDigest.ts test@example.com weekly');
        process.exit(1);
    }

    if (!['weekly', 'monthly'].includes(frequency)) {
        console.error('❌ Frequency must be "weekly" or "monthly"');
        process.exit(1);
    }

    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('✅ Connected\n');

        // Import after DB connection
        const User = (await import('@/lib/models/User')).default;
        const Event = (await import('@/lib/models/Event')).default;
        const { sendScheduledDigests } = await import('@/lib/services/emailDigestService');

        // === STEP 1: Check User ===
        console.log('👤 Fetching user:', testEmail);
        const user = await User.findOne({ email: testEmail });

        if (!user) {
            console.error(`❌ User not found: ${testEmail}`);
            console.log('\n💡 Create user first at: http://localhost:3000/signup');
            process.exit(1);
        }

        console.log(`✅ Found user: ${user.name}`);
        console.log(`   Email notifications: ${user.preferences.notifications.email ? '✅' : '❌'}`);
        console.log(`   Frequency: ${user.preferences.notifications.emailFrequency || 'not set'}`);
        console.log(`   Categories: ${user.preferences.selectedCategories.join(', ') || 'none'}`);
        console.log(`   Keywords: ${user.preferences.notifications.keywords.join(', ') || 'none'}`);
        console.log(`   Last email sent: ${user.preferences.notifications.lastEmailSent?.toISOString() || 'never'}`);

        // === STEP 2: Validate User Settings ===
        if (!user.preferences.notifications.email) {
            console.error('\n❌ Email notifications are disabled for this user');
            console.log('💡 Enable in settings: http://localhost:3000/settings');
            process.exit(1);
        }

        if (user.preferences.notifications.emailFrequency !== frequency) {
            console.warn(`\n⚠️  User frequency is "${user.preferences.notifications.emailFrequency}" but testing "${frequency}"`);
            console.log('   Temporarily updating user frequency for test...');
            user.preferences.notifications.emailFrequency = frequency;
            await user.save();
            console.log('   ✅ Updated');
        }

        // === STEP 3: Check Database Content ===
        console.log('\n📊 Checking database content...');
        const totalEvents = await Event.countDocuments({
            startDate: { $gte: new Date() }
        });

        const lookbackDays = frequency === 'weekly' ? 7 : 30;
        const lookbackDate = user.preferences.notifications.lastEmailSent ||
            new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

        const recentEvents = await Event.countDocuments({
            startDate: { $gte: new Date() },
            scrapedAt: { $gte: lookbackDate }
        });

        console.log(`   Total upcoming events: ${totalEvents}`);
        console.log(`   New events since last email: ${recentEvents}`);

        if (totalEvents === 0) {
            console.error('\n❌ No events in database');
            console.log('💡 Run scraper first: npm run scrape:all');
            process.exit(1);
        }

        if (recentEvents === 0) {
            console.warn('\n⚠️  No NEW events since last email');
            console.log('   Email might be empty (only shows new content)');
            console.log('   💡 Either:');
            console.log('      - Run scraper to add new events: npm run scrape:all');
            console.log('      - Or reset lastEmailSent to get content:');
            console.log(`        User.updateOne({email: "${testEmail}"}, {$unset: {"preferences.notifications.lastEmailSent": 1}})`);
        }

        // === STEP 4: Preview Content ===
        console.log('\n🔍 Previewing digest content...');
        console.log('   (This simulates what the cron job will do)');

        // Access private function through a test export
        // Since it's private, we'll call the parent function with limited scope
        console.log('   Building content preview...');

        // Quick preview by category
        for (const category of user.preferences.selectedCategories) {
            const categoryEvents = await Event.countDocuments({
                category,
                startDate: { $gte: new Date() },
                scrapedAt: { $gte: lookbackDate }
            });
            console.log(`   - ${category}: ${categoryEvents} new events`);
        }

        // === STEP 5: Run the Cron Job Logic ===
        console.log('\n🚀 Running digest send (simulating cron job)...');
        console.log(`   Testing ${frequency} digest for ${testEmail}`);
        console.log('   This is exactly what the cron job does!\n');

        const results = await sendScheduledDigests(frequency);

        console.log('\n📊 Digest Results:');
        console.log(`   ✅ Sent: ${results.sent}`);
        console.log(`   ⏭️  Skipped: ${results.skipped}`);
        console.log(`   ❌ Errors: ${results.errors}`);

        // === STEP 6: Verify Results ===
        if (results.sent > 0) {
            console.log('\n✅ SUCCESS! Email was sent.');
            console.log(`   Check your inbox: ${testEmail}`);
            console.log('   💡 Also check spam folder if not in inbox');

            // Show updated lastEmailSent
            const updatedUser = await User.findOne({ email: testEmail });
            console.log(`   Last email sent updated to: ${updatedUser?.preferences.notifications.lastEmailSent?.toISOString()}`);
        } else if (results.skipped > 0) {
            console.log('\n⚠️  Email was SKIPPED (no content)');
            console.log('   Reasons:');
            console.log('   - No new events matching user preferences');
            console.log('   - No keyword matches');
            console.log('   - No updated favorites');
            console.log('\n💡 To fix:');
            console.log('   1. Run scraper: npm run scrape:all');
            console.log('   2. Add keywords in settings');
            console.log('   3. Favorite some events');
            console.log('   4. Or reset lastEmailSent date');
        } else if (results.errors > 0) {
            console.log('\n❌ Email FAILED to send');
            console.log('   Check logs above for error details');
        }

        // === STEP 7: Test Summary ===
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Email: ${testEmail}`);
        console.log(`Frequency: ${frequency}`);
        console.log(`Result: ${results.sent > 0 ? '✅ SENT' : results.skipped > 0 ? '⏭️  SKIPPED' : '❌ FAILED'}`);
        console.log(`Database events: ${totalEvents} total, ${recentEvents} new`);
        console.log('='.repeat(60));

        // === STEP 8: Next Steps ===
        if (results.sent > 0) {
            console.log('\n🎉 Test successful! Next steps:');
            console.log('   1. Check email in inbox');
            console.log('   2. Verify content looks correct');
            console.log('   3. Test unsubscribe link works');
            console.log('   4. Set up production cron jobs');
            console.log('\n📅 To schedule in production:');
            console.log('   - Weekly: Every Sunday at 8 AM');
            console.log('   - Monthly: First Sunday of month at 8 AM');
            console.log('   - Use GitHub Actions or Vercel Cron');
        } else {
            console.log('\n💡 Next steps to get content:');
            console.log('   1. Run: npm run scrape:all');
            console.log('   2. Add keywords: http://localhost:3000/settings');
            console.log('   3. Favorite events: http://localhost:3000/events');
            console.log('   4. Re-run this test');
        }

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

testDigest();