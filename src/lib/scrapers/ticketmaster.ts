import { TicketmasterEvent, NormalisedEvent } from './types';
import { mapTicketmasterCategory } from '../utils/category-mapper';

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';
const MELBOURNE_LAT = '-37.8136';
const MELBOURNE_LNG = '144.9631';
const RADIUS = '50';

/**
 * Fetches a single page of events from Ticketmaster API.
 * 
 * @param page - Zero-based page number
 * @param size - Number of events per page (max 100)
 * @returns Array of raw Ticketmaster events
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
 * Deduplicates events that appear multiple times due to multiple dates.
 * 
 * @returns Array of unique Ticketmaster events
 */
export async function fetchAllTicketmasterEvents(): Promise<TicketmasterEvent[]> {
  const uniqueEventsMap = new Map<string, TicketmasterEvent>();
  let page = 0;
  let hasMore = true;
  const maxPages = 100; // Safety limit to prevent infinite loops

  console.log('[Ticketmaster] Fetching events (unlimited mode)');

  while (hasMore && page < maxPages) {
    try {
      const events = await fetchTicketmasterEvents(page, 200); // Increased from 100

      if (events.length === 0) {
        console.log('[Ticketmaster] No more events found, stopping');
        hasMore = false;
        break;
      }

      events.forEach(event => {
        const key = createEventKey(event);

        if (!uniqueEventsMap.has(key)) {
          uniqueEventsMap.set(key, event);
        } else {
          const existing = uniqueEventsMap.get(key)!;
          uniqueEventsMap.set(key, mergeEventDates(existing, event));
        }
      });

      console.log(`[Ticketmaster] Page ${page + 1}: ${uniqueEventsMap.size} unique events`);
      page++;

      await delay(200);
    } catch (error) {
      console.error(`[Ticketmaster] Failed page ${page}:`, error);
      hasMore = false;
    }
  }

  console.log(`[Ticketmaster] Total: ${Array.from(uniqueEventsMap.values()).length} events`);
  return Array.from(uniqueEventsMap.values());
}
/**
 * Normalises a Ticketmaster event to the standard event format.
 * 
 * @param event - Raw Ticketmaster event data
 * @returns Normalised event object
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
 * Creates a unique key for deduplication based on event name and venue.
 */
function createEventKey(event: TicketmasterEvent): string {
  const venue = event._embedded?.venues?.[0]?.name || 'unknown';
  const name = event.name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${name}::${venue}`;
}

/**
 * Merges date ranges when the same event appears multiple times.
 * Keeps the earliest start date and latest end date.
 */
function mergeEventDates(
  existing: TicketmasterEvent,
  incoming: TicketmasterEvent
): TicketmasterEvent {
  const existingDate = new Date(existing.dates.start.localDate);
  const incomingDate = new Date(incoming.dates.start.localDate);

  if (incomingDate < existingDate) {
    return {
      ...incoming,
      dates: {
        ...incoming.dates,
        end: existing.dates.end || { localDate: existing.dates.start.localDate },
      },
    };
  }

  return {
    ...existing,
    dates: {
      ...existing.dates,
      end: {
        localDate: incoming.dates.end?.localDate || incoming.dates.start.localDate,
      },
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