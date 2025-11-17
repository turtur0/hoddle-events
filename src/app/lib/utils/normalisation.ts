import { TicketmasterEvent, NormalisedEvent } from '../types';

export function normaliseTicketmasterEvent(
  event: TicketmasterEvent
): NormalisedEvent {
  const category = event.classifications?.[0]?.segment?.name || 'Other';

  const startDate = parseTicketmasterDate(
    event.dates.start.localDate,
    event.dates.start.localTime
  );

  let endDate: Date | undefined;
  if (event.dates.end?.localDate && event.dates.end.localDate !== event.dates.start.localDate) {
    try {
      endDate = parseTicketmasterDate(
        event.dates.end.localDate, 
        event.dates.end.localTime
      );
    } catch {
      // Silently skip invalid end date
    }
  }

  const venue = event._embedded?.venues?.[0];
  const venueInfo = {
    name: venue?.name || 'Venue TBA',
    address: venue?.address?.line1 || 'TBA',
    suburb: venue?.city?.name || 'Melbourne',
  };

  const { priceMin, priceMax, isFree } = extractPriceInfo(event);

  const imageUrl = event.images
    ?.sort((a, b) => b.width - a.width)[0]?.url;

  const bookingUrl = event.url || `https://www.ticketmaster.com.au/event/${event.id}`;

  return {
    title: event.name,
    description: event.description || 'No description available',
    category: normaliseCategory(category),

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
 * Extract price information from Ticketmaster event
 */
function extractPriceInfo(event: TicketmasterEvent): {
  priceMin?: number;
  priceMax?: number;
  isFree: boolean;
} {
  if (!event.priceRanges || event.priceRanges.length === 0) {
    return {
      priceMin: undefined,
      priceMax: undefined,
      isFree: false,
    };
  }

  const prices = event.priceRanges;

  const allMins = prices
    .map(p => p.min)
    .filter(p => p !== undefined && p !== null && !isNaN(p));

  const allMaxs = prices
    .map(p => p.max)
    .filter(p => p !== undefined && p !== null && !isNaN(p));

  const priceMin = allMins.length > 0 ? Math.min(...allMins) : undefined;
  const priceMax = allMaxs.length > 0 ? Math.max(...allMaxs) : undefined;

  const isFree = priceMin === 0 || (priceMin === undefined && priceMax === 0);

  return {
    priceMin: priceMin && priceMin > 0 ? Math.round(priceMin) : undefined,
    priceMax: priceMax && priceMax > 0 ? Math.round(priceMax) : undefined,
    isFree,
  };
}

function parseTicketmasterDate(date: string, time?: string): Date {
  const parsed = time
    ? new Date(`${date}T${time}`)
    : new Date(`${date}T12:00:00`);

  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}${time ? `T${time}` : ''}`);
  }

  return parsed;
}

function normaliseCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'Music': 'Music',
    'Sports': 'Sports',
    'Arts & Theatre': 'Theatre',
    'Film': 'Film',
    'Miscellaneous': 'Other',
  };

  return categoryMap[category] || category;
}
