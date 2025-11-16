// lib/utils/normalization.ts
import { TicketmasterEvent, NormalisedEvent } from '../types';

export function normaliseTicketmasterEvent(
  event: TicketmasterEvent
): NormalisedEvent {
  // Extract category from classifications
  const category = event.classifications?.[0]?.segment?.name || 'Other';
  
  // Parse dates
  const startDate = parseTicketmasterDate(
    event.dates.start.localDate,
    event.dates.start.localTime
  );
  
  const endDate = event.dates.end
    ? parseTicketmasterDate(event.dates.end.localDate, event.dates.end.localTime)
    : undefined;
  
  // Extract venue info
  const venue = event._embedded?.venues?.[0];
  const venueInfo = {
    name: venue?.name || 'Venue TBA',
    address: venue?.address?.line1,
    suburb: venue?.city?.name,
  };
  
  // Extract price info
  const priceRange = event.priceRanges?.[0];
  const priceMin = priceRange?.min;
  const priceMax = priceRange?.max;
  const isFree = priceMin === 0 || (!priceMin && !priceMax);
  
  // Get best quality image (largest width)
  const imageUrl = event.images
    ?.sort((a, b) => b.width - a.width)[0]?.url;
  
  return {
    title: event.name,
    description: event.description,
    category: normaliseCategory(category),
    
    startDate,
    endDate,
    
    venue: venueInfo,
    
    priceMin,
    priceMax,
    isFree,
    
    bookingUrl: event.url,
    imageUrl,
    
    source: 'ticketmaster',
    sourceId: event.id,
    scrapedAt: new Date(),
  };
}

function parseTicketmasterDate(date: string, time?: string): Date {
  // date format: "2025-11-20"
  // time format: "19:30:00" (optional)
  
  if (time) {
    return new Date(`${date}T${time}`);
  }
  
  // If no time, set to midday to avoid timezone issues
  return new Date(`${date}T12:00:00`);
}

function normaliseCategory(category: string): string {
  // Standardise category names
  const categoryMap: Record<string, string> = {
    'Music': 'Music',
    'Sports': 'Sports',
    'Arts & Theatre': 'Theatre',
    'Film': 'Film',
    'Miscellaneous': 'Other',
  };
  
  return categoryMap[category] || category;
}