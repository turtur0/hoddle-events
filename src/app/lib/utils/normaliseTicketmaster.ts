import { TicketmasterEvent, NormalisedEvent } from '../types';

export function normaliseTicketmasterEvent(
  event: TicketmasterEvent
): NormalisedEvent {
  const classification = event.classifications?.[0];
  const segment = classification?.segment?.name || 'Other';
  const genre = classification?.genre?.name || '';
  const subGenre = classification?.subGenre?.name || '';

  // Map to our category system
  const { category, subcategory } = mapCategory(segment, genre, subGenre, event.name);

  // Parse dates
  const startDate = parseDate(event.dates.start.localDate, event.dates.start.localTime);
  const endDate = parseEndDate(event.dates.end, event.dates.start.localDate);

  // Extract venue
  const venue = event._embedded?.venues?.[0];
  const venueInfo = {
    name: venue?.name || 'Venue TBA',
    address: venue?.address?.line1 || 'TBA',
    suburb: venue?.city?.name || 'Melbourne',
  };

  // Extract pricing
  const { priceMin, priceMax, isFree } = extractPriceInfo(event);

  // Get best quality image
  const imageUrl = event.images?.sort((a, b) => b.width - a.width)[0]?.url;

  // Fallback booking URL
  const bookingUrl = event.url || `https://www.ticketmaster.com.au/event/${event.id}`;

  return {
    title: event.name,
    description: event.description || 'No description available',
    category,
    subcategory,
    startDate,
    endDate,
    venue: venueInfo,
    priceMin,
    priceMax,
    isFree,
    bookingUrl,
    imageUrl,
    source: 'ticketmaster',
    sourceId: event.id,
    scrapedAt: new Date(),
  };
}

/**
 * Map Ticketmaster categories to our simplified system
 */
function mapCategory(
  segment: string,
  genre: string,
  subGenre: string,
  title: string
): { category: string; subcategory?: string } {
  const seg = segment.toLowerCase();
  const combined = `${genre} ${subGenre} ${title}`.toLowerCase();

  // MUSIC
  if (seg === 'music') {
    return { category: 'music', subcategory: getMusicSubcategory(combined) };
  }

  // SPORTS
  if (seg === 'sports') {
    return { category: 'sports', subcategory: getSportsSubcategory(combined) };
  }

  // THEATRE & ARTS
  if (seg.includes('theatre') || seg === 'arts') {
    return { category: 'theatre', subcategory: getTheatreSubcategory(combined) };
  }

  // FAMILY
  if (seg.includes('family') || combined.includes('family') || combined.includes('kids')) {
    return { category: 'family', subcategory: getFamilySubcategory(combined) };
  }

  // FILM
  if (seg === 'film') {
    return { category: 'arts', subcategory: 'Film & Cinema' };
  }

  // OTHER
  return { category: 'other' };
}

/**
 * Music subcategory mapping
 */
function getMusicSubcategory(text: string): string | undefined {
  if (text.match(/rock|alternative|indie/)) return 'Rock & Alternative';
  if (text.match(/pop|electronic|dance|edm|techno/)) return 'Pop & Electronic';
  if (text.match(/hip hop|hip-hop|rap|r&b|rnb/)) return 'Hip Hop & R&B';
  if (text.match(/jazz|blues/)) return 'Jazz & Blues';
  if (text.match(/classical|orchestra|symphony|philharmonic/)) return 'Classical & Orchestra';
  if (text.match(/country|folk|bluegrass|americana/)) return 'Country & Folk';
  if (text.match(/metal|punk|hardcore/)) return 'Metal & Punk';
  if (text.match(/world|latin|reggae|african|ethnic/)) return 'World Music';
  return undefined;
}

/**
 * Sports subcategory mapping
 */
function getSportsSubcategory(text: string): string | undefined {
  if (text.match(/\bafl\b|australian football/)) return 'AFL';
  if (text.match(/cricket/)) return 'Cricket';
  if (text.match(/soccer|football/) && !text.includes('afl')) return 'Soccer';
  if (text.match(/basketball|nbl/)) return 'Basketball';
  if (text.match(/tennis/)) return 'Tennis';
  if (text.match(/rugby|nrl/)) return 'Rugby';
  if (text.match(/motor|racing|\bf1\b|formula|nascar/)) return 'Motorsports';
  return 'Other Sports';
}

/**
 * Theatre subcategory mapping
 */
function getTheatreSubcategory(text: string): string | undefined {
  if (text.match(/musical/)) return 'Musicals';
  if (text.match(/ballet|dance/)) return 'Ballet & Dance';
  if (text.match(/opera/)) return 'Opera';
  if (text.match(/comedy/) && !text.match(/festival/)) return 'Comedy Shows';
  if (text.match(/shakespeare/)) return 'Shakespeare';
  if (text.match(/cabaret/)) return 'Cabaret';
  if (text.match(/circus|magic|illusionist/)) return 'Circus & Magic';
  if (text.match(/drama|play/)) return 'Drama';
  return undefined;
}

/**
 * Family subcategory mapping
 */
function getFamilySubcategory(text: string): string | undefined {
  if (text.match(/circus|magic/)) return 'Circus & Magic';
  if (text.match(/kids|children/)) return 'Kids Shows';
  if (text.match(/education|learning/)) return 'Educational';
  return 'Family Entertainment';
}

/**
 * Extract price information from event
 */
function extractPriceInfo(event: TicketmasterEvent): {
  priceMin?: number;
  priceMax?: number;
  isFree: boolean;
} {
  if (!event.priceRanges?.length) {
    return { priceMin: undefined, priceMax: undefined, isFree: false };
  }

  // Collect all valid min and max prices separately
  const validMins: number[] = [];
  const validMaxs: number[] = [];

  for (const range of event.priceRanges) {
    // Add valid min prices
    if (range.min != null && !isNaN(range.min)) {
      validMins.push(range.min);
    }

    // Add valid max prices
    if (range.max != null && !isNaN(range.max)) {
      validMaxs.push(range.max);
    }
  }

  // If no valid prices found at all
  if (validMins.length === 0 && validMaxs.length === 0) {
    return { priceMin: undefined, priceMax: undefined, isFree: false };
  }

  const priceMin = validMins.length > 0 ? Math.min(...validMins) : undefined;
  const priceMax = validMaxs.length > 0 ? Math.max(...validMaxs) : undefined;
  const isFree = priceMin === 0;

  return {
    priceMin: priceMin !== undefined && priceMin > 0 ? Math.round(priceMin) : undefined,
    priceMax: priceMax !== undefined && priceMax > 0 ? Math.round(priceMax) : undefined,
    isFree,
  };
}
/**
 * Parse Ticketmaster date with optional time
 */
function parseDate(date: string, time?: string): Date {
  const dateStr = time ? `${date}T${time}` : `${date}T12:00:00`;
  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  return parsed;
}

/**
 * Parse end date if it exists and is different from start date
 */
function parseEndDate(
  endDateObj?: { localDate: string; localTime?: string },
  startDate?: string
): Date | undefined {
  if (!endDateObj?.localDate || endDateObj.localDate === startDate) {
    return undefined;
  }

  try {
    return parseDate(endDateObj.localDate, endDateObj.localTime);
  } catch {
    return undefined; // Invalid end date, skip silently
  }
}