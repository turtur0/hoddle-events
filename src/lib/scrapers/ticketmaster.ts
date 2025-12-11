import { TicketmasterEvent, NormalisedEvent } from './types';
import { mapTicketmasterCategory } from '../utils/category-mapper';

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';
const MELBOURNE_LAT = '-37.8136';
const MELBOURNE_LNG = '144.9631';
const RADIUS = '50';

/**
 * Fetches a single page of events from Ticketmaster API.
 */
export async function fetchTicketmasterEvents(
  page = 0,
  size = 100
): Promise<TicketmasterEvent[]> {
  const API_KEY = process.env.TICKETMASTER_API_KEY;
  if (!API_KEY) {
    throw new Error('TICKETMASTER_API_KEY not found in environment variables');
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
    latlong: `${MELBOURNE_LAT},${MELBOURNE_LNG}`,
    radius: RADIUS,
    unit: 'km',
    size: size.toString(),
    page: page.toString(),
    sort: 'date,asc',
  });

  const response = await fetch(`${TICKETMASTER_BASE_URL}/events.json?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Ticketmaster API error: ${response.status}`);
  }

  const data = await response.json();
  return data._embedded?.events || [];
}

/**
 * Fetches all available events from Ticketmaster API with pagination.
 * Groups events by their ID to handle multi-day events properly.
 */
export async function fetchAllTicketmasterEvents(): Promise<TicketmasterEvent[]> {
  const eventsByIdMap = new Map<string, TicketmasterEvent>();
  let page = 0;
  let hasMore = true;
  const maxPages = 100;

  console.log('[Ticketmaster] Fetching events');

  while (hasMore && page < maxPages) {
    try {
      const events = await fetchTicketmasterEvents(page, 200);

      if (events.length === 0) {
        console.log('[Ticketmaster] No more events found, stopping');
        hasMore = false;
        break;
      }

      // Group by event ID - this is the key fix
      events.forEach(event => {
        if (!eventsByIdMap.has(event.id)) {
          eventsByIdMap.set(event.id, event);
        } else {
          // Event already exists - merge the dates
          const existing = eventsByIdMap.get(event.id)!;
          eventsByIdMap.set(event.id, mergeEventDates(existing, event));
        }
      });

      console.log(`[Ticketmaster] Page ${page + 1}: ${eventsByIdMap.size} unique events`);
      page++;

      await delay(200);
    } catch (error) {
      console.error(`[Ticketmaster] Failed page ${page}:`, error);
      hasMore = false;
    }
  }

  const uniqueEvents = Array.from(eventsByIdMap.values());
  console.log(`[Ticketmaster] Total: ${uniqueEvents.length} unique events`);
  return uniqueEvents;
}

/**
 * Normalises a Ticketmaster event to the standard event format.
 */
export function normaliseTicketmasterEvent(event: TicketmasterEvent): NormalisedEvent {
  const classification = event.classifications?.[0];
  const segment = classification?.segment?.name;
  const genre = classification?.genre?.name;
  const subGenre = classification?.subGenre?.name;

  const { category, subcategory } = mapTicketmasterCategory(
    segment,
    genre,
    subGenre,
    event.name
  );

  const startDate =
    parseDate(event.dates.start.localDate, event.dates.start.localTime) ||
    getFallbackDate();

  const endDate = event.dates.end?.localDate
    ? parseDate(event.dates.end.localDate, event.dates.end.localTime)
    : undefined;

  const venue = event._embedded?.venues?.[0];
  const { priceMin, priceMax, isFree } = extractPriceInfo(event);
  const imageUrl = event.images?.sort((a, b) => b.width - a.width)[0]?.url;

  return {
    title: event.name,
    description: event.description || 'No description available',
    category,
    subcategory,
    startDate,
    endDate,
    venue: {
      name: venue?.name || 'Venue TBA',
      address: venue?.address?.line1 || 'TBA',
      suburb: venue?.city?.name || 'Melbourne',
    },
    priceMin,
    priceMax,
    isFree,
    bookingUrl: event.url || `https://www.ticketmaster.com.au/event/${event.id}`,
    imageUrl,
    source: 'ticketmaster',
    sourceId: event.id,
    scrapedAt: new Date(),
    lastUpdated: new Date(),
  };
}

/**
 * Merges date ranges when the same event (by ID) appears multiple times.
 * Keeps the earliest start date and latest end date.
 */
function mergeEventDates(
  existing: TicketmasterEvent,
  incoming: TicketmasterEvent
): TicketmasterEvent {
  const existingStart = new Date(existing.dates.start.localDate);
  const incomingStart = new Date(incoming.dates.start.localDate);

  const existingEnd = existing.dates.end?.localDate
    ? new Date(existing.dates.end.localDate)
    : existingStart;

  const incomingEnd = incoming.dates.end?.localDate
    ? new Date(incoming.dates.end.localDate)
    : incomingStart;

  // Find earliest start and latest end
  const finalStart = existingStart < incomingStart ? existingStart : incomingStart;
  const finalEnd = existingEnd > incomingEnd ? existingEnd : incomingEnd;

  // Use the existing event as base, update dates
  return {
    ...existing,
    dates: {
      ...existing.dates,
      start: {
        ...existing.dates.start,
        localDate: finalStart.toISOString().split('T')[0],
      },
      end: finalStart.getTime() !== finalEnd.getTime()
        ? {
          localDate: finalEnd.toISOString().split('T')[0],
        }
        : undefined,
    },
  };
}

/**
 * Extracts price information from Ticketmaster event data.
 */
function extractPriceInfo(event: TicketmasterEvent): {
  priceMin?: number;
  priceMax?: number;
  isFree: boolean;
} {
  if (!event.priceRanges?.length) {
    return { isFree: false };
  }

  const mins = event.priceRanges
    .map(r => r.min)
    .filter((n): n is number => n != null && !isNaN(n));

  const maxs = event.priceRanges
    .map(r => r.max)
    .filter((n): n is number => n != null && !isNaN(n));

  const priceMin = mins.length > 0 ? Math.round(Math.min(...mins)) : undefined;
  const priceMax = maxs.length > 0 ? Math.round(Math.max(...maxs)) : undefined;

  return {
    priceMin: priceMin && priceMin > 0 ? priceMin : undefined,
    priceMax: priceMax && priceMax > 0 ? priceMax : undefined,
    isFree: priceMin === 0,
  };
}

/**
 * Parses date and time strings into a Date object.
 */
function parseDate(date: string | undefined, time?: string): Date | undefined {
  if (!date) return undefined;

  try {
    const dateStr = time ? `${date}T${time}` : `${date}T12:00:00`;
    const parsed = new Date(dateStr);

    if (isNaN(parsed.getTime())) {
      console.warn(`[Ticketmaster] Invalid date: ${dateStr}`);
      return undefined;
    }

    return parsed;
  } catch (error) {
    console.warn(`[Ticketmaster] Error parsing date: ${date}, ${time}`);
    return undefined;
  }
}

/**
 * Returns a fallback date 30 days in the future for events with missing dates.
 */
function getFallbackDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}

/**
 * Simple delay utility for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}