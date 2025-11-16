// Ticketmaster raw response types
export interface TicketmasterEvent {
  id: string;
  name: string;
  description?: string;
  url: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
    };
    end?: {
      localDate: string;
      localTime?: string;
    };
  };
  classifications?: Array<{
    segment: { name: string };
    genre?: { name: string };
  }>;
  priceRanges?: Array<{
    min: number;
    max: number;
    currency: string;
  }>;
  images?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: {
        line1?: string;
      };
      city?: {
        name: string;
      };
      state?: {
        name: string;
      };
    }>;
  };
}

// Normalised event format (what goes in MongoDB)
export interface NormalisedEvent {
  title: string;
  description?: string;
  category: string;
  
  startDate: Date;
  endDate?: Date;
  
  venue: {
    name: string;
    address?: string;
    suburb?: string;
  };
  
  priceMin?: number;
  priceMax?: number;
  isFree: boolean;
  
  bookingUrl: string;
  imageUrl?: string;
  
  source: 'ticketmaster' | 'eventbrite' | 'artscentre';
  sourceId: string;
  scrapedAt: Date;
}