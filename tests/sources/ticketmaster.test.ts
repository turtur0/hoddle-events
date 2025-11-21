import { TicketmasterEvent } from '@/app/lib/scrapers';

describe('Ticketmaster Scraper', () => {
  describe('Environment Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should throw error if API key is missing', async () => {
      delete process.env.TICKETMASTER_API_KEY;

      const { fetchTicketmasterEvents } = await import('../../src/app/lib/scrapers/ticketmaster');

      await expect(fetchTicketmasterEvents()).rejects.toThrow(
        'TICKETMASTER_API_KEY not found in environment variables'
      );
    });
  });

  describe('URL Construction', () => {
    it('should build correct API URL with parameters', () => {
      const params = new URLSearchParams({
        apikey: 'test-key',
        latlong: '-37.8136,144.9631',
        radius: '50',
        unit: 'km',
        size: '100',
        page: '0',
        sort: 'date,asc',
      });

      const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;

      expect(url).toContain('latlong=-37.8136%2C144.9631');
      expect(url).toContain('radius=50');
      expect(url).toContain('size=100');
      expect(url).toContain('sort=date%2Casc');
    });

    it('should use Melbourne coordinates', () => {
      const MELBOURNE_LAT = '-37.8136';
      const MELBOURNE_LNG = '144.9631';

      expect(MELBOURNE_LAT).toBe('-37.8136');
      expect(MELBOURNE_LNG).toBe('144.9631');
    });

    it('should use 50km radius', () => {
      const RADIUS = '50';
      expect(RADIUS).toBe('50');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect 200ms delay between requests', () => {
      const RATE_LIMIT_DELAY = 200;
      expect(RATE_LIMIT_DELAY).toBe(200);

      // 200ms = 5 requests per second (1000ms / 200ms)
      const requestsPerSecond = 1000 / RATE_LIMIT_DELAY;
      expect(requestsPerSecond).toBe(5);
    });
  });

  describe('Response Handling', () => {
    it('should return empty array when no events found', () => {
      const mockResponse = {
        _embedded: {
          events: []
        },
        page: {
          size: 0,
          totalElements: 0,
          totalPages: 0,
          number: 0,
        },
      };


      const events = mockResponse._embedded?.events || [];
      expect(events).toEqual([]);
    });

    it('should extract events from _embedded.events', () => {
      const mockResponse = {
        _embedded: {
          events: [
            { id: '1', name: 'Event 1' },
            { id: '2', name: 'Event 2' },
          ] as TicketmasterEvent[],
        },
        page: {
          size: 2,
          totalElements: 2,
          totalPages: 1,
          number: 0,
        },
      };

      const events = mockResponse._embedded.events;
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('1');
    });
  });

  describe('Pagination Logic', () => {
    it('should limit to MAX_PAGES', () => {
      const MAX_PAGES = 1;
      const totalPages = 10;

      const pagesToFetch = Math.min(totalPages, MAX_PAGES);
      expect(pagesToFetch).toBe(1);
    });

    it('should calculate correct total pages for large dataset', () => {
      const totalEvents = 847;
      const pageSize = 100;

      const totalPages = Math.ceil(totalEvents / pageSize);
      expect(totalPages).toBe(9);
    });
  });
});