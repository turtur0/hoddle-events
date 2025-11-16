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
    // CHECK API KEY FIRST - before making the fetch call
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

        // Handle case where no events found
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

export async function fetchAllTicketmasterEvents(): Promise<TicketmasterEvent[]> {
    const allEvents: TicketmasterEvent[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && page < 10) { // Limit to 10 pages (1000 events) for MVP
        console.log(`Fetching Ticketmaster page ${page}...`);

        try {
            const events = await fetchTicketmasterEvents(page);

            if (events.length === 0) {
                hasMore = false;
            } else {
                allEvents.push(...events);
                page++;

                // Rate limiting: wait 200ms between requests (well under API limits)
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.error(`Failed to fetch page ${page}:`, error);
            hasMore = false;
        }
    }

    console.log(`Fetched ${allEvents.length} events from Ticketmaster`);
    return allEvents;
}