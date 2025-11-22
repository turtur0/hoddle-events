// ============================================
// debug-accessibility.ts
// Script to check your accessibility data
// ============================================

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/app/lib/db';
import Event from '@/app/lib/models/Event';

async function debugAccessibility() {
  await connectDB();

  console.log('🔍 Debugging Accessibility Data\n');

  // 1. Total events
  const total = await Event.countDocuments();
  console.log(`Total events: ${total}`);

  // 2. Events with accessibility field
  const withField = await Event.countDocuments({ 
    accessibility: { $exists: true } 
  });
  console.log(`Events with accessibility field: ${withField}`);

  // 3. Events with empty array
  const emptyArray = await Event.countDocuments({ 
    accessibility: { $size: 0 } 
  });
  console.log(`Events with empty array []: ${emptyArray}`);

  // 4. Events with at least one accessibility feature
  const withFeatures = await Event.countDocuments({ 
    'accessibility.0': { $exists: true } 
  });
  console.log(`Events with accessibility features: ${withFeatures}`);

  // 5. Show sample accessible events
  console.log('\n📋 Sample Accessible Events:');
  const samples = await Event.find({ 
    'accessibility.0': { $exists: true } 
  })
    .select('title accessibility')
    .limit(5);

  samples.forEach(event => {
    console.log(`\n- ${event.title}`);
    console.log(`  Accessibility: ${event.accessibility?.join(', ')}`);
  });

  // 6. Show sample events with empty accessibility
  console.log('\n📋 Sample Events with Empty Accessibility:');
  const emptySamples = await Event.find({ 
    accessibility: { $size: 0 } 
  })
    .select('title accessibility')
    .limit(3);

  emptySamples.forEach(event => {
    console.log(`\n- ${event.title}`);
    console.log(`  Accessibility: [] (empty)`);
  });

  // 7. Test the actual filter query
  console.log('\n🧪 Testing Actual Filter Query:');
  const now = new Date();
  const testQuery = {
    startDate: { $gte: now },
    'accessibility.0': { $exists: true }
  };

  const upcomingAccessible = await Event.countDocuments(testQuery);
  console.log(`Upcoming accessible events: ${upcomingAccessible}`);

  // 8. Show breakdown by source
  console.log('\n📊 Accessibility by Source:');
  const bySource = await Event.aggregate([
    {
      $match: {
        'accessibility.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$primarySource',
        count: { $sum: 1 }
      }
    }
  ]);

  bySource.forEach(group => {
    console.log(`  ${group._id}: ${group.count} events`);
  });

  await disconnectDB();
}

debugAccessibility().catch(console.error);

// Run with: tsx scripts/debug-accessibility.ts