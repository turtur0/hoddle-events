import { normaliseTicketmasterEvent } from '@/app/lib/scrapers';
import {
  mockTicketmasterEvent,
  mockFreeEvent,
  mockMinimalEvent,
  mockMultiDayEvent,
  mockInvalidDateEvent,
} from '../mocks/ticketmaster.mocks';

describe('Ticketmaster Normalisation', () => {
  describe('Complete Event Normalisation', () => {
    it('should normalise a complete Ticketmaster event correctly', () => {
      const normalised = normaliseTicketmasterEvent(mockTicketmasterEvent);

      expect(normalised).toMatchObject({
        title: 'Test Concert',
        description: 'An amazing test concert',
        category: 'music', // Changed from 'Music'
        source: 'ticketmaster',
        sourceId: 'TM001',
        isFree: false,
      });

      expect(normalised.venue).toEqual({
        name: 'Test Arena',
        address: '123 Test St',
        suburb: 'Melbourne',
      });

      expect(normalised.priceMin).toBe(50);
      expect(normalised.priceMax).toBe(150);
      expect(normalised.bookingUrl).toBe('https://ticketmaster.com/test');
      expect(normalised.imageUrl).toBe('https://example.com/image1.jpg');
    });

    it('should parse start date and time correctly', () => {
      const normalised = normaliseTicketmasterEvent(mockTicketmasterEvent);

      expect(normalised.startDate).toBeInstanceOf(Date);
      expect(normalised.startDate.getFullYear()).toBe(2025);
      expect(normalised.startDate.getMonth()).toBe(11); // December (0-indexed)
      expect(normalised.startDate.getDate()).toBe(15);
      expect(normalised.startDate.getHours()).toBe(19);
      expect(normalised.startDate.getMinutes()).toBe(0);
    });

    it('should include scrapedAt timestamp', () => {
      const normalised = normaliseTicketmasterEvent(mockTicketmasterEvent);

      expect(normalised.scrapedAt).toBeInstanceOf(Date);
      expect(normalised.scrapedAt.getTime()).toBeCloseTo(Date.now(), -2);
    });
  });

  describe('Free Events', () => {
    it('should correctly identify free events (price = 0)', () => {
      const normalised = normaliseTicketmasterEvent(mockFreeEvent);

      expect(normalised.isFree).toBe(true);
      expect(normalised.priceMin).toBeUndefined();
      expect(normalised.priceMax).toBeUndefined();
    });

    it('should handle events with no price information', () => {
      const noPriceEvent = { ...mockMinimalEvent };
      delete noPriceEvent.priceRanges;

      const normalised = normaliseTicketmasterEvent(noPriceEvent);

      expect(normalised.isFree).toBe(false);
      expect(normalised.priceMin).toBeUndefined();
      expect(normalised.priceMax).toBeUndefined();
    });
  });

  describe('Minimal/Missing Fields', () => {
    it('should handle events with minimal data', () => {
      const normalised = normaliseTicketmasterEvent(mockMinimalEvent);

      expect(normalised.title).toBe('Minimal Event');
      expect(normalised.description).toBe('No description available');
      expect(normalised.category).toBe('other'); // Changed from 'Other'
      expect(normalised.venue.name).toBe('Venue TBA');
      expect(normalised.venue.address).toBe('TBA');
      expect(normalised.venue.suburb).toBe('Melbourne');
      expect(normalised.imageUrl).toBeUndefined();
    });

    it('should use default time (12:00) when time is missing', () => {
      const normalised = normaliseTicketmasterEvent(mockMinimalEvent);

      expect(normalised.startDate.getHours()).toBe(12);
      expect(normalised.startDate.getMinutes()).toBe(0);
    });
  });

  describe('Multi-Day Events', () => {
    it('should parse end date for multi-day events', () => {
      const normalised = normaliseTicketmasterEvent(mockMultiDayEvent);

      expect(normalised.startDate).toBeInstanceOf(Date);
      expect(normalised.endDate).toBeInstanceOf(Date);

      expect(normalised.startDate.getDate()).toBe(20);
      expect(normalised.endDate?.getDate()).toBe(22);
    });

    it('should not set endDate if same as startDate', () => {
      const sameDayEvent = {
        ...mockMultiDayEvent,
        dates: {
          start: { localDate: '2025-12-20', localTime: '10:00:00' },
          end: { localDate: '2025-12-20', localTime: '23:00:00' },
        },
      };

      const normalised = normaliseTicketmasterEvent(sameDayEvent);
      expect(normalised.endDate).toBeUndefined();
    });

    it('should handle invalid end date gracefully', () => {
      const invalidEndDate = {
        ...mockMultiDayEvent,
        dates: {
          start: { localDate: '2025-12-20', localTime: '10:00:00' },
          end: { localDate: 'invalid-date' },
        },
      };

      const normalised = normaliseTicketmasterEvent(invalidEndDate);
      expect(normalised.endDate).toBeUndefined();
    });
  });

  describe('Category Normalisation', () => {
    it('should normalise "Arts & Theatre" to "theatre"', () => {
      const theatreEvent = {
        ...mockTicketmasterEvent,
        classifications: [{ segment: { name: 'Arts & Theatre' } }],
      };

      const normalised = normaliseTicketmasterEvent(theatreEvent);
      expect(normalised.category).toBe('theatre'); // Changed from 'Theatre'
    });

    it('should normalise "Miscellaneous" to "other"', () => {
      const miscEvent = {
        ...mockTicketmasterEvent,
        classifications: [{ segment: { name: 'Miscellaneous' } }],
      };

      const normalised = normaliseTicketmasterEvent(miscEvent);
      expect(normalised.category).toBe('other'); // Changed from 'Other'
    });

    it('should normalise known categories to lowercase', () => {
      const categoryMappings = [
        { input: 'Music', expected: 'music' },
        { input: 'Sports', expected: 'sports' },
        { input: 'Film', expected: 'arts' }, // Film maps to arts category
      ];

      categoryMappings.forEach(({ input, expected }) => {
        const event = {
          ...mockTicketmasterEvent,
          classifications: [{ segment: { name: input } }],
        };

        const normalised = normaliseTicketmasterEvent(event);
        expect(normalised.category).toBe(expected);
      });
    });
  });

  describe('Price Extraction', () => {
    it('should round prices to nearest integer', () => {
      const decimalPriceEvent = {
        ...mockTicketmasterEvent,
        priceRanges: [{ min: 49.99, max: 149.50, currency: 'AUD' }],
      };

      const normalised = normaliseTicketmasterEvent(decimalPriceEvent);
      expect(normalised.priceMin).toBe(50);
      expect(normalised.priceMax).toBe(150);
    });

    it('should handle multiple price ranges correctly', () => {
      const multiPriceEvent = {
        ...mockTicketmasterEvent,
        priceRanges: [
          { min: 30, max: 50, currency: 'AUD' },
          { min: 60, max: 100, currency: 'AUD' },
          { min: 120, max: 200, currency: 'AUD' },
        ],
      };

      const normalised = normaliseTicketmasterEvent(multiPriceEvent);
      expect(normalised.priceMin).toBe(30);
      expect(normalised.priceMax).toBe(200);
    });

    it('should ignore invalid price values', () => {
      const invalidPriceEvent = {
        ...mockTicketmasterEvent,
        priceRanges: [
          { min: NaN, max: 100, currency: 'AUD' },
          { min: 50, max: null as any, currency: 'AUD' },
        ],
      };

      const normalised = normaliseTicketmasterEvent(invalidPriceEvent);
      expect(normalised.priceMin).toBe(50);
      expect(normalised.priceMax).toBe(100);
    });
  });

  describe('Image Selection', () => {
    it('should select highest resolution image', () => {
      const normalised = normaliseTicketmasterEvent(mockTicketmasterEvent);
      expect(normalised.imageUrl).toBe('https://example.com/image1.jpg');
    });

    it('should handle missing images', () => {
      const noImageEvent = { ...mockMinimalEvent };
      delete noImageEvent.images;

      const normalised = normaliseTicketmasterEvent(noImageEvent);
      expect(normalised.imageUrl).toBeUndefined();
    });

    it('should handle empty images array', () => {
      const emptyImagesEvent = { ...mockTicketmasterEvent, images: [] };
      const normalised = normaliseTicketmasterEvent(emptyImagesEvent);
      expect(normalised.imageUrl).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid start date', () => {
      expect(() => {
        normaliseTicketmasterEvent(mockInvalidDateEvent);
      }).toThrow('Invalid date');
    });

    it('should generate fallback booking URL if missing', () => {
      const noUrlEvent = { ...mockMinimalEvent, url: '' };
      const normalised = normaliseTicketmasterEvent(noUrlEvent);

      expect(normalised.bookingUrl).toBe(
        'https://www.ticketmaster.com.au/event/TM003'
      );
    });
  });
});