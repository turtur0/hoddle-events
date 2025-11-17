import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/app/lib/db';
import { fetchAllTicketmasterEvents } from '@/app/lib/scrapers/ticketmaster';
import { normaliseTicketmasterEvent } from '@/app/lib/utils/normalisation';
import Event from '@/app/lib/models/Event';

async function scrapeTicketmaster() {
  try {
    console.log('Starting Ticketmaster scraper...\n');
    
    await connectDB();
    
    const rawEvents = await fetchAllTicketmasterEvents();
    console.log(`\n Fetched ${rawEvents.length} events from Ticketmaster API\n`);
    
    if (rawEvents.length === 0) {
      console.log('No events to process');
      return;
    }
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const rawEvent of rawEvents) {
      try {
        const normalised = normaliseTicketmasterEvent(rawEvent);
        
        // Check if event already exists (by title + venue + source)
        const existing = await Event.findOne({
          title: normalised.title,
          'venue.name': normalised.venue.name,
          source: normalised.source,
        });
        
        if (existing) {
          // Update existing event, extending date range if needed
          const { scrapedAt, ...updateData } = normalised;
          
          // If this occurrence has an earlier start date, update startDate
          const newStartDate = normalised.startDate < existing.startDate 
            ? normalised.startDate 
            : existing.startDate;
          
          // If this occurrence has a later date, set/update endDate
          let newEndDate = existing.endDate;
          if (normalised.endDate && (!newEndDate || normalised.endDate > newEndDate)) {
            newEndDate = normalised.endDate;
          } else if (!existing.endDate && normalised.startDate > existing.startDate) {
            // Multi-day event detected: set endDate to the later start date
            newEndDate = normalised.startDate;
          }
          
          await Event.updateOne(
            { _id: existing._id },
            { 
              $set: {
                ...updateData,
                startDate: newStartDate,
                endDate: newEndDate,
                lastUpdated: new Date(),
              }
            }
          );
          updated++;
          console.log(`Updated (extended dates): ${normalised.title}`);
        } else {
          // Create new event
          await Event.create(normalised);
          inserted++;
          console.log(`✅ Inserted: ${normalised.title}`);
        }
        
      } catch (error: any) {
        if (error.code === 11000) {
          skipped++;
          console.log(`⏭️  Skipped duplicate: ${rawEvent.name}`);
        } else {
          errors++;
          console.error(`❌ Error processing ${rawEvent.name}:`, error.message);
        }
      }
    }
    
    const totalInDb = await Event.countDocuments();
    
    console.log('\n Scraping Summary:');
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total in DB: ${totalInDb}\n`);
    
  } catch (error) {
    console.error('Scraper failed:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

scrapeTicketmaster();