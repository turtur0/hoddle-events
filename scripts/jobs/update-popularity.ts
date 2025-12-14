import dotenv from 'dotenv';
import path from 'path';

// Only load .env.local if not in CI environment
if (!process.env.CI) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

import { connectDB, disconnectDB } from '@/lib/db';
import { updateCategoryPopularityPercentiles, enrichWithSpotifyData } from '@/lib/ml';

async function main() {
  console.log('Starting popularity update job');

  try {
    await connectDB();
    console.log('Connected to database');

    // Step 1: Enrich music events with Spotify data (50 events per day)
    console.log('Enriching music events with Spotify data...');
    const enrichedCount = await enrichWithSpotifyData(50);
    console.log(`Enriched ${enrichedCount} music events with Spotify data`);

    // Step 2: Update popularity percentiles for all categories
    console.log('Updating popularity percentiles...');
    await updateCategoryPopularityPercentiles();
    console.log('Popularity percentiles updated successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error updating popularity:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  main();
}

export default main;