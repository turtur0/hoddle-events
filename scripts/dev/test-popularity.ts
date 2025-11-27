// scripts/debug/debug-popularity.ts
// Run this to diagnose popularity update issues
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB } from '@/lib/db';
import Event from '@/lib/models/Event';
import { CATEGORIES } from '@/lib/constants/categories';
import { calculateRawPopularityScore } from '@/lib/ml/popularityService';

async function diagnose() {
    console.log('🔍 Starting popularity update diagnostics...\n');

    try {
        // Step 1: Connect to database
        console.log('Step 1: Connecting to database...');
        await connectDB();
        console.log('✅ Connected to database\n');

        // Step 2: Check if events exist
        console.log('Step 2: Checking events in database...');
        const totalEvents = await Event.countDocuments();
        console.log(`✅ Found ${totalEvents} total events\n`);

        if (totalEvents === 0) {
            console.log('❌ ERROR: No events in database!');
            console.log('   Run your scraper scripts first to add events.');
            process.exit(1);
        }

        // Step 3: Check events by category
        console.log('Step 3: Events per category:');
        const categories = CATEGORIES.map(cat => cat.value);

        for (const category of categories) {
            const count = await Event.countDocuments({ category });
            console.log(`   ${category}: ${count} events`);
        }
        console.log();

        // Step 4: Sample event data
        console.log('Step 4: Checking sample event structure...');
        const sampleEvent = await Event.findOne().lean();

        if (!sampleEvent) {
            console.log('❌ ERROR: Could not fetch sample event');
            process.exit(1);
        }

        console.log('Sample event:');
        console.log(`   ID: ${sampleEvent._id}`);
        console.log(`   Title: ${sampleEvent.title}`);
        console.log(`   Category: ${sampleEvent.category}`);
        console.log(`   Stats:`, sampleEvent.stats);
        console.log();

        // Step 5: Check if stats field exists
        if (!sampleEvent.stats) {
            console.log('❌ ERROR: Events missing stats field!');
            console.log('   Your Event schema might not have stats initialized.');
            console.log('   Fix: Update your scraper to include stats when creating events.');
            process.exit(1);
        }

        // Step 6: Test popularity calculation
        console.log('Step 5: Testing popularity calculation...');
        try {
            const rawScore = calculateRawPopularityScore(sampleEvent);
            console.log(`✅ Calculated raw popularity score: ${rawScore.toFixed(2)}`);
            console.log();
        } catch (error) {
            console.log('❌ ERROR: Popularity calculation failed');
            console.log('   Error:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }

        // Step 7: Test update on single event
        console.log('Step 6: Testing database update...');
        try {
            const testUpdate = await Event.findByIdAndUpdate(
                sampleEvent._id,
                {
                    $set: {
                        'stats.categoryPopularityPercentile': 0.5,
                        'stats.rawPopularityScore': 100,
                        'stats.lastPopularityUpdate': new Date(),
                    },
                },
                { new: true }
            );

            console.log('✅ Test update successful');
            console.log('   Updated stats:', testUpdate?.stats);
            console.log();
        } catch (error) {
            console.log('❌ ERROR: Database update failed');
            console.log('   Error:', error instanceof Error ? error.message : String(error));
            console.log('   Your Event schema might need the new fields added.');
            process.exit(1);
        }

        // Step 8: Run full update on ONE category
        console.log('Step 7: Running full update on "music" category...');
        const musicEvents = await Event.find({ category: 'music' }).lean();
        console.log(`   Found ${musicEvents.length} music events`);

        if (musicEvents.length === 0) {
            console.log('   ⚠️  No music events found, trying another category...');

            // Find first category with events
            for (const cat of categories) {
                const count = await Event.countDocuments({ category: cat });
                if (count > 0) {
                    console.log(`   Using category: ${cat} (${count} events)`);
                    const testCategory = cat;
                    await updateSingleCategory(testCategory);
                    break;
                }
            }
        } else {
            await updateSingleCategory('music');
        }

        console.log('\n✅ Diagnostics complete!');
        console.log('   If you see this message, the update should be working.');
        console.log('   Check MongoDB to verify the stats fields are updated.');

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack trace:', error.stack);
        }
        process.exit(1);
    }

    process.exit(0);
}

async function updateSingleCategory(category: string) {
    const events = await Event.find({ category }).lean();

    console.log(`\n   Calculating scores for ${events.length} events...`);

    // Calculate scores
    const eventsWithScores = events.map(event => ({
        id: event._id,
        title: event.title,
        score: calculateRawPopularityScore(event),
    }));

    // Sort by score
    eventsWithScores.sort((a, b) => a.score - b.score);

    console.log(`   Sorted events by score.`);
    console.log(`   Lowest: "${eventsWithScores[0]?.title}" (${eventsWithScores[0]?.score.toFixed(2)})`);
    console.log(`   Highest: "${eventsWithScores[eventsWithScores.length - 1]?.title}" (${eventsWithScores[eventsWithScores.length - 1]?.score.toFixed(2)})`);

    // Assign percentiles
    const totalEvents = eventsWithScores.length;
    let updateCount = 0;

    console.log(`\n   Updating ${totalEvents} events...`);

    for (let i = 0; i < eventsWithScores.length; i++) {
        const percentile = totalEvents === 1 ? 0.5 : i / (totalEvents - 1);

        try {
            await Event.findByIdAndUpdate(eventsWithScores[i].id, {
                $set: {
                    'stats.rawPopularityScore': eventsWithScores[i].score,
                    'stats.categoryPopularityPercentile': percentile,
                    'stats.lastPopularityUpdate': new Date(),
                },
            });
            updateCount++;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`   ❌ Failed to update event ${eventsWithScores[i].id}: ${errorMsg}`);
        }

        // Progress indicator
        if ((i + 1) % 10 === 0) {
            console.log(`   Progress: ${i + 1}/${totalEvents}...`);
        }
    }

    console.log(`   ✅ Updated ${updateCount}/${totalEvents} events`);

    // Verify one update
    const verifyEvent = await Event.findById(eventsWithScores[0].id);
    console.log(`\n   Verification - checking first event:`);
    console.log(`   Title: ${verifyEvent?.title}`);
    console.log(`   Percentile: ${verifyEvent?.stats?.categoryPopularityPercentile}`);

    // Type-safe access to potentially undefined properties
    const stats = verifyEvent?.stats as any;
    console.log(`   Raw Score: ${stats?.rawPopularityScore ?? 'N/A'}`);
    console.log(`   Last Updated: ${stats?.lastPopularityUpdate ?? 'N/A'}`);
}

diagnose();