// scripts/testEmail.ts
// Run with: npx tsx scripts/testEmail.ts your-email@example.com
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Now import everything else
import mongoose from 'mongoose';
import { sendMonthlyDigest } from '@/lib/email/emailService';
import User from '@/lib/models/User';
import Event from '@/lib/models/Event';
import UserFavourite from '@/lib/models/UserFavourites';

async function setupTestUser(email: string) {
    console.log('\n🔧 Setting up test user...');

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
        console.log(`✓ Found existing user: ${user.name} (${user.email})`);
    } else {
        // Create new test user
        user = await User.create({
            email,
            name: 'Test Email User',
            provider: 'credentials',
            preferences: {
                selectedCategories: ['music', 'theatre', 'arts'],
                categoryWeights: {
                    music: 0.9,
                    theatre: 0.7,
                    arts: 0.6,
                },
                notifications: {
                    email: true,
                    emailFrequency: 'weekly',
                    keywords: ['jazz', 'comedy', 'festival', 'art'],
                    // Set lastEmailSent to 35 days ago so we get fresh content
                    lastEmailSent: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
                },
            },
        });
        console.log(`✓ Created new user: ${user.name} (${user.email})`);
    }

    return user;
}

async function getRecentEvents() {
    console.log('\n📊 Analyzing recent events in database...');

    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Get upcoming events
    const upcomingEvents = await Event.countDocuments({
        startDate: { $gte: now, $lte: nextMonth },
    });

    // Get events by category
    const categories = ['music', 'theatre', 'sports', 'arts', 'family', 'other'];
    const categoryCounts: Record<string, number> = {};

    for (const cat of categories) {
        const count = await Event.countDocuments({
            category: cat,
            startDate: { $gte: now, $lte: nextMonth },
        });
        categoryCounts[cat] = count;
    }

    console.log(`\n  Total upcoming events (next 30 days): ${upcomingEvents}`);
    console.log(`  By category:`);
    for (const [cat, count] of Object.entries(categoryCounts)) {
        console.log(`    - ${cat}: ${count}`);
    }

    // Get some sample events for keyword matching
    const keywordEvents = await Event.find({
        $or: [
            { title: { $regex: 'jazz|comedy|festival|art', $options: 'i' } },
            { description: { $regex: 'jazz|comedy|festival|art', $options: 'i' } }
        ],
        startDate: { $gte: now, $lte: nextMonth },
    })
        .limit(5)
        .select('title category startDate venue.name')
        .lean();

    if (keywordEvents.length > 0) {
        console.log(`\n  Sample events matching keywords:`);
        keywordEvents.forEach(event => {
            const date = new Date(event.startDate).toLocaleDateString('en-AU', {
                month: 'short',
                day: 'numeric',
            });
            console.log(`    - [${event.category}] ${event.title} - ${date} @ ${event.venue.name}`);
        });
    }

    return { upcomingEvents, categoryCounts, keywordEvents };
}

async function addTestFavorite(userId: mongoose.Types.ObjectId) {
    console.log('\n⭐ Adding a test favorite...');

    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Find an upcoming event to favorite
    const event = await Event.findOne({
        startDate: { $gte: now, $lte: nextMonth },
    });

    if (!event) {
        console.log('  ⚠️  No upcoming events found to favorite');
        return null;
    }

    // Check if already favorited
    const existing = await UserFavourite.findOne({
        userId,
        eventId: event._id,
    });

    if (existing) {
        console.log(`  ✓ Event already favorited: ${event.title}`);

        // Update the event's lastUpdated to make it appear as "updated"
        event.lastUpdated = new Date();
        await event.save();
        console.log(`  ✓ Marked event as recently updated`);

        return event;
    }

    // Add favorite
    await UserFavourite.create({
        userId,
        eventId: event._id,
    });

    // Update the event to simulate it being updated recently
    event.lastUpdated = new Date();
    await event.save();

    console.log(`  ✓ Added favorite: ${event.title}`);
    console.log(`  ✓ Marked as recently updated`);

    return event;
}

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('\n❌ Please provide an email address');
        console.log('\nUsage: npx tsx scripts/testEmail.ts your-email@example.com\n');
        process.exit(1);
    }

    console.log('\n===========================================');
    console.log('    EMAIL SERVICE TEST SCRIPT');
    console.log('===========================================');

    // Verify environment variables
    console.log('\n🔍 Checking environment variables...');
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI not set');
        process.exit(1);
    }
    if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY not set');
        process.exit(1);
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
        console.warn('⚠️  NEXT_PUBLIC_APP_URL not set (using default)');
    }
    console.log('✓ Environment variables configured');

    // Connect to database
    console.log('\n🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    try {
        // Setup test user
        const user = await setupTestUser(email);

        // Analyze database
        const { upcomingEvents, categoryCounts } = await getRecentEvents();

        if (upcomingEvents === 0) {
            console.log('\n⚠️  WARNING: No upcoming events in database!');
            console.log('   You may want to run your scrapers first.');
        }

        // Add a test favorite
        await addTestFavorite(user._id);

        // Send the email
        console.log('\n📧 Sending monthly digest email...');
        console.log(`   To: ${user.email}`);
        console.log(`   User preferences:`);
        console.log(`     - Categories: ${user.preferences.selectedCategories.join(', ')}`);
        console.log(`     - Keywords: ${user.preferences.notifications.keywords.join(', ')}`);

        const result = await sendMonthlyDigest(user._id);

        console.log('\n===========================================');
        if (result) {
            console.log('✅ EMAIL SENT SUCCESSFULLY!');
            console.log('===========================================');
            console.log(`\nCheck your inbox at: ${email}`);
            console.log('\nThe email should contain:');
            console.log('  • Header with "Melbourne Events" branding');
            console.log('  • Keyword matches (if any match your keywords)');
            console.log('  • Updated favorites (the event we just marked)');
            console.log('  • Personalized recommendations by category');
            console.log('  • Footer with unsubscribe link\n');

            // Show what was included
            const updatedUser = await User.findById(user._id);
            console.log('Last email sent timestamp updated to:');
            console.log(`  ${updatedUser?.preferences.notifications.lastEmailSent}\n`);

        } else {
            console.log('⚠️  EMAIL NOT SENT');
            console.log('===========================================');
            console.log('\nPossible reasons:');
            console.log('  • No new content matching user preferences');
            console.log('  • Email notifications disabled for user');
            console.log('  • No events added since last email');
            console.log('\nTry:');
            console.log('  1. Run your event scrapers to add fresh events');
            console.log('  2. Check user preferences are correctly set');
            console.log(`  3. Manually reset lastEmailSent to longer ago\n`);
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('✓ Disconnected from MongoDB\n');
    }
}

main().catch(console.error);