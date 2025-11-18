import { TicketmasterEvent } from '../types';

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// Melbourne coordinates for radius search
const MELBOURNE_LAT = '-37.8136';
const MELBOURNE_LNG = '144.9631';
const RADIUS = '50'; // km

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

    const url = `${TICKETMASTER_BASE_URL}/events.json?${params}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data._embedded?.events) {
            console.log('No events found from Ticketmaster');
            return [];
        }

        return data._embedded.events;
    } catch (error) {
        console.error('Error fetching Ticketmaster events:', error);
        throw error;
    }
}

/**
 * Create a unique key for deduplication based on event name and venue
 * This handles cases where Ticketmaster creates separate entries for:
 * - Different dates of the same show
 * - Different ticket types
 */
function createEventKey(event: TicketmasterEvent): string {
    const venueName = event._embedded?.venues?.[0]?.name || 'unknown-venue';
    // Normalize event name: lowercase, remove special chars, trim
    const normalizedName = event.name
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    return `${normalizedName}::${venueName}`;
}

/**
 * Merge multiple date entries into a single event with date range
 */
function mergeEventDates(existing: TicketmasterEvent, incoming: TicketmasterEvent): TicketmasterEvent {
    // Keep the event with the earliest start date as the primary
    const existingDate = new Date(existing.dates.start.localDate);
    const incomingDate = new Date(incoming.dates.start.localDate);

    if (incomingDate < existingDate) {
        // Incoming has earlier date, use it as primary
        return {
            ...incoming,
            dates: {
                ...incoming.dates,
                end: existing.dates.end || { localDate: existing.dates.start.localDate }
            }
        };
    }

    // Keep existing as primary, extend end date if needed
    return {
        ...existing,
        dates: {
            ...existing.dates,
            end: {
                localDate: incoming.dates.end?.localDate || incoming.dates.start.localDate
            }
        }
    };
}

export async function fetchAllTicketmasterEvents(): Promise<TicketmasterEvent[]> {
    const uniqueEventsMap = new Map<string, TicketmasterEvent>();
    let page = 0;
    let hasMore = true;
    let totalRawEventsFetched = 0;
    let duplicatesSkipped = 0;
    const MAX_PAGES = 10;

    console.log('Fetching unique Ticketmaster events...\n');

    while (hasMore && page < MAX_PAGES) {
        try {
            const events = await fetchTicketmasterEvents(page, 100);

            if (events.length === 0) {
                hasMore = false;
                break;
            }

            totalRawEventsFetched += events.length;

            // DEBUG: Log first event's classification structure
            if (page === 0 && events.length > 0) {
                console.log('\n=== DEBUG: Sample Event Classification ===');
                console.log('Event:', events[0].name);
                console.log('Classifications:', JSON.stringify(events[0].classifications, null, 2));
                console.log('=========================================\n');
            }

            events.forEach(event => {
                const eventKey = createEventKey(event);

                if (!uniqueEventsMap.has(eventKey)) {
                    uniqueEventsMap.set(eventKey, event);
                } else {
                    const existing = uniqueEventsMap.get(eventKey)!;
                    const merged = mergeEventDates(existing, event);
                    uniqueEventsMap.set(eventKey, merged);
                    duplicatesSkipped++;
                }
            });

            console.log(`   Page ${page + 1}: ${events.length} raw events | ${uniqueEventsMap.size} unique so far (${duplicatesSkipped} duplicates merged)`);
            page++;

            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`Failed to fetch page ${page}:`, error);
            hasMore = false;
        }
    }

    const uniqueEvents = Array.from(uniqueEventsMap.values());

    console.log(`\nFetch complete:`);
    console.log(`   Total raw events fetched: ${totalRawEventsFetched}`);
    console.log(`   Unique events: ${uniqueEvents.length}`);
    console.log(`   Duplicates merged: ${duplicatesSkipped} (${Math.round((duplicatesSkipped / totalRawEventsFetched) * 100)}%)`);
    console.log(`   API efficiency: ~${Math.round((uniqueEvents.length / totalRawEventsFetched) * 100)}% of raw data was unique\n`);

    return uniqueEvents;
}