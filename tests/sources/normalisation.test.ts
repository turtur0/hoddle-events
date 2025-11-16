import { normalizeTicketmasterEvent } from '../../src/app/lib/utils/normalisation';
import {
    mockTicketmasterEvent,
    mockFreeEvent,
    mockMinimalEvent
} from '../mocks/ticketmaster.mocks';

describe('Ticketmaster Normalisation', () => {
    describe('normalizeTicketmasterEvent', () => {
        it('should normalize a complete event with all fields', () => {
            const result = normalizeTicketmasterEvent(mockTicketmasterEvent);

            expect(result).toMatchObject({
                title: 'Taylor Swift | The Eras Tour',
                description: expect.any(String),
                category: 'Music',
                source: 'ticketmaster',
                sourceId: 'vv17G9Z9MaNYD4P',
                bookingUrl: 'https://www.ticketmaster.com.au/event/123456',
                isFree: false,
            });

            expect(result.startDate).toBeInstanceOf(Date);
            expect(result.startDate.getFullYear()).toBe(2025);
            expect(result.startDate.getMonth()).toBe(11); // December (0-indexed)
            expect(result.startDate.getDate()).toBe(15);
            expect(result.startDate.getHours()).toBe(19);
            expect(result.startDate.getMinutes()).toBe(30);

            expect(result.priceMin).toBe(89.5);
            expect(result.priceMax).toBe(299.99);

            expect(result.venue).toMatchObject({
                name: 'Marvel Stadium',
                address: 'Olympic Boulevard',
                suburb: 'Melbourne',
            });

            // Check that we got the larger image (not the thumbnail)
            expect(result.imageUrl).toBe('https://s1.ticketm.net/dam/a/123/image.jpg');
            expect(result.imageUrl).not.toContain('thumb.jpg');

            expect(result.scrapedAt).toBeInstanceOf(Date);
        });

        it('should handle free events correctly', () => {
            const result = normalizeTicketmasterEvent(mockFreeEvent);

            expect(result.isFree).toBe(true);
            expect(result.priceMin).toBe(0);
            expect(result.priceMax).toBe(0);
        });

        it('should handle minimal events with missing optional fields', () => {
            const result = normalizeTicketmasterEvent(mockMinimalEvent);

            expect(result.title).toBe('Mystery Event');
            expect(result.category).toBe('Other'); // Default category
            expect(result.description).toBeUndefined();
            expect(result.priceMin).toBeUndefined();
            expect(result.priceMax).toBeUndefined();
            expect(result.isFree).toBe(true); // No price = free
            expect(result.venue.name).toBe('Venue TBA');
            expect(result.imageUrl).toBeUndefined();
        });

        it('should default to midday when no time specified', () => {
            const result = normalizeTicketmasterEvent(mockMinimalEvent);

            expect(result.startDate.getHours()).toBe(12);
            expect(result.startDate.getMinutes()).toBe(0);
        });

        it('should normalize category names consistently', () => {
            const eventWithTheatre = {
                ...mockMinimalEvent,
                classifications: [{ segment: { name: 'Arts & Theatre' } }],
            };

            const result = normalizeTicketmasterEvent(eventWithTheatre);
            expect(result.category).toBe('Theatre');
        });

        it('should handle events with multiple images', () => {
            const result = normalizeTicketmasterEvent(mockTicketmasterEvent);

            // Should pick the largest image (1024x768, not 205x115)
            expect(result.imageUrl).toContain('image.jpg');
            expect(result.imageUrl).not.toContain('thumb.jpg');
        });
    });
});