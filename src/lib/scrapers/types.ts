export interface NormalisedEvent {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  subcategories?: string[];

  startDate: Date;
  endDate?: Date;

  venue: {
    name: string;
    address: string;
    suburb: string;
  };

  priceMin?: number;
  priceMax?: number;
  priceDetails?: string;
  isFree: boolean;

  bookingUrl: string;
  imageUrl?: string;
  videoUrl?: string;

  accessibility?: string[];
  ageRestriction?: string;
  duration?: string;

  source: 'ticketmaster' | 'marriner' | 'whatson' | 'feverup';
  sourceId: string;
  scrapedAt: Date;
  lastUpdated: Date;
}

export interface EventForDedup {
  _id?: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  venue: { name: string; address: string; suburb: string };
  source: string;
  sourceId: string;
  description?: string;
  category?: string;
  subcategory?: string;
  subcategories?: string[];
  imageUrl?: string;
  videoUrl?: string;
  priceMin?: number;
  priceMax?: number;
  priceDetails?: string;
  isFree?: boolean;
  bookingUrl?: string;
  accessibility?: string[];
  ageRestriction?: string;
  duration?: string;
}

export interface DuplicateMatch {
  event1Id: string;
  event2Id: string;
  confidence: number;
  reason: string;
}

export interface TicketmasterEvent {
  id: string;
  name: string;
  description?: string;
  info?: string;
  url?: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
    end?: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
    timezone?: string;
    status?: {
      code?: string;
    };
  };
  classifications?: Array<{
    primary?: boolean;
    segment?: {
      id?: string;
      name: string;
    };
    genre?: {
      id?: string;
      name: string;
    };
    subGenre?: {
      id?: string;
      name: string;
    };
    type?: {
      id?: string;
      name?: string;
    };
    subType?: {
      id?: string;
      name?: string;
    };
  }>;
  priceRanges?: Array<{
    type?: string;
    currency?: string;
    min?: number;
    max?: number;
  }>;
  images?: Array<{
    url: string;
    width: number;
    height?: number;
    ratio?: string;
    fallback?: boolean;
  }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      type?: string;
      id?: string;
      address?: {
        line1?: string;
        line2?: string;
      };
      city?: {
        name: string;
      };
      state?: {
        name: string;
        stateCode?: string;
      };
      country?: {
        name?: string;
        countryCode?: string;
      };
      postalCode?: string;
      location?: {
        longitude?: string;
        latitude?: string;
      };
    }>;
    attractions?: Array<{
      id: string;
      name: string;
      type?: string;
      url?: string;
      images?: Array<{
        url: string;
        width: number;
        height?: number;
      }>;
    }>;
  };
  sales?: {
    public?: {
      startDateTime?: string;
      endDateTime?: string;
    };
  };
  seatmap?: {
    staticUrl?: string;
  };
  accessibility?: {
    info?: string;
  };
  ageRestrictions?: {
    legalAgeEnforced?: boolean;
  };
  ticketLimit?: {
    info?: string;
  };
  pleaseNote?: string;
  locale?: string;
  promoter?: {
    id?: string;
    name?: string;
  };
}

export interface ScrapeOptions {
  maxCategories?: number;
  maxEventsPerCategory?: number;
  specificCategories?: string[];
}

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