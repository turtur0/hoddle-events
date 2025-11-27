import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';

import { updateCategoryPopularityPercentiles } from '@/lib/ml';
;

async function main() {
  console.log('Starting popularity update job');

  try {
    await connectDB();
    console.log('Connected to database');

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
