export interface NormalisedEvent {
  title: string;
  description: string;
  category: string;
  subcategory?: string;

  startDate: Date;
  endDate?: Date;

  venue: {
    name: string;
    address: string;
    suburb: string;
  };

  priceMin?: number;
  priceMax?: number;
  isFree: boolean;

  bookingUrl: string;
  imageUrl?: string;

  source: 'ticketmaster' | 'artscentre' | 'marriner';
  sourceId: string;
  scrapedAt: Date;
  lastUpdated: Date;
}

// Ticketmaster API response types
export interface TicketmasterEvent {
  id: string;
  name: string;
  description?: string;
  url?: string;
  dates: {
    start: { localDate: string; localTime?: string };
    end?: { localDate: string; localTime?: string };
  };
  classifications?: Array<{
    segment?: { name: string };
    genre?: { name: string };
    subGenre?: { name: string };
  }>;
  priceRanges?: Array<{ min?: number; max?: number }>;
  images?: Array<{ url: string; width: number }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: { line1?: string };
      city?: { name: string };
    }>;
  };
}

// Scraper options
export interface ScrapeOptions {
  maxCategories?: number;
  maxEventsPerCategory?: number;
  specificCategories?: string[];
}

// Scrape result with stats
export interface ScrapeResult {
  events: NormalisedEvent[];
  stats: {
    source: string;
    fetched: number;
    normalised: number;
    errors: number;
    duration: number;
  };
}