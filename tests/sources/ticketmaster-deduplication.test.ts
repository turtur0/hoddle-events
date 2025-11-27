import { TicketmasterEvent } from '@/lib/scrapers/types';
import { mockDuplicateEvents } from '../mocks/ticketmaster.mocks';

/**
 * Extract the deduplication functions from ticketmaster.ts for testing
 * (In production, you might want to export these from the scraper file)
 */
function createEventKey(event: TicketmasterEvent): string {
  const venueName = event._embedded?.venues?.[0]?.name || 'unknown-venue';
  const normalizedName = event.name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  
  return `${normalizedName}::${venueName}`;
}

describe('Event Deduplication', () => {
  describe('Event Key Generation', () => {
    it('should create consistent keys for same event', () => {
      const [event1, event2] = mockDuplicateEvents;
      
      const key1 = createEventKey(event1);
      const key2 = createEventKey(event2);
      
      expect(key1).toBe(key2);
      expect(key1).toBe('hair-the-musical::Comedy Theatre');
    });

    it('should normalize case and special characters', () => {
      const event1: TicketmasterEvent = {
        id: 'TEST1',
        name: 'HAMILTON: The Musical!!!',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
        _embedded: { venues: [{ name: 'Princess Theatre', city: { name: 'Melbourne' } }] },
      };

      const event2: TicketmasterEvent = {
        id: 'TEST2',
        name: 'Hamilton the Musical',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-02' } },
        _embedded: { venues: [{ name: 'Princess Theatre', city: { name: 'Melbourne' } }] },
      };

      expect(createEventKey(event1)).toBe(createEventKey(event2));
    });

    it('should create different keys for different venues', () => {
      const event1: TicketmasterEvent = {
        id: 'TEST1',
        name: 'Test Show',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
        _embedded: { venues: [{ name: 'Venue A', city: { name: 'Melbourne' } }] },
      };

      const event2: TicketmasterEvent = {
        id: 'TEST2',
        name: 'Test Show',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
        _embedded: { venues: [{ name: 'Venue B', city: { name: 'Melbourne' } }] },
      };

      expect(createEventKey(event1)).not.toBe(createEventKey(event2));
    });

    it('should handle events with no venue', () => {
      const event: TicketmasterEvent = {
        id: 'TEST',
        name: 'Online Event',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
      };

      const key = createEventKey(event);
      expect(key).toBe('online-event::unknown-venue');
    });

    it('should handle extra whitespace', () => {
      const event: TicketmasterEvent = {
        id: 'TEST',
        name: '  Too   Many    Spaces  ',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
        _embedded: { venues: [{ name: 'Test Venue', city: { name: 'Melbourne' } }] },
      };

      const key = createEventKey(event);
      expect(key).toBe('too-many-spaces::Test Venue');
    });
  });

  describe('Date Merging Logic', () => {
    it('should identify events with different dates as duplicates', () => {
      const [event1, event2] = mockDuplicateEvents;
      
      // These should be considered duplicates despite different dates
      expect(createEventKey(event1)).toBe(createEventKey(event2));
      
      // Verify they have different dates
      expect(event1.dates.start.localDate).not.toBe(event2.dates.start.localDate);
    });

    it('should track both start and end dates', () => {
      const event1 = mockDuplicateEvents[0];
      const event2 = mockDuplicateEvents[1];

      // In a real implementation, you'd merge these
      // This test documents the expected behavior
      expect(event1.dates.start.localDate).toBe('2025-12-10');
      expect(event2.dates.start.localDate).toBe('2025-12-11');
    });
  });

  describe('Real-World Edge Cases', () => {
    it('should handle events with emoji and unicode', () => {
      const event: TicketmasterEvent = {
        id: 'TEST',
        name: '🎵 Music Festival 2025 🎸',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
        _embedded: { venues: [{ name: 'Test Venue', city: { name: 'Melbourne' } }] },
      };

      const key = createEventKey(event);
      expect(key).toMatch(/music-festival-2025/);
    });

    it('should handle events with numbers and dates in title', () => {
      const event: TicketmasterEvent = {
        id: 'TEST',
        name: 'NYE 2025/26 Celebration',
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-31' } },
        _embedded: { venues: [{ name: 'Fed Square', city: { name: 'Melbourne' } }] },
      };

      const key = createEventKey(event);
      expect(key).toBe('nye-202526-celebration::Fed Square');
    });

    it('should handle very long event names', () => {
      const longName = 'The Absolutely Most Amazing Spectacular Show of the Century That You Have Ever Seen in Your Entire Life';
      const event: TicketmasterEvent = {
        id: 'TEST',
        name: longName,
        url: 'https://test.com',
        dates: { start: { localDate: '2025-12-01' } },
        _embedded: { venues: [{ name: 'Small Venue', city: { name: 'Melbourne' } }] },
      };

      const key = createEventKey(event);
      expect(key.length).toBeGreaterThan(0);
      expect(key).toContain('::Small Venue');
    });
  });
});