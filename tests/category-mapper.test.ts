import {
    mapWhatsOnCategory,
    mapTicketmasterCategory,
    mapMarrinerCategory,
} from '@/lib/utils/category-mapper';

describe('Category Mapper', () => {
    // ============================================================================
    // What's On Melbourne Category Mapping Tests
    // ============================================================================
    describe('mapWhatsOnCategory', () => {
        it('should classify theatre events correctly', () => {
            expect(mapWhatsOnCategory('Theatre and Musicals', 'Hamilton: The Musical').subcategory).toBe('Musicals');
            expect(mapWhatsOnCategory('Theatre and Musicals', 'Swan Lake Ballet').subcategory).toBe('Ballet & Dance');
            expect(mapWhatsOnCategory('Comedy', 'Stand-up Comedy Night').subcategory).toBe('Comedy Shows');
            expect(mapWhatsOnCategory('Theatre and Musicals', 'The Glass Menagerie').subcategory).toBe('Drama');
        });

        it('should detect Shakespeare plays correctly', () => {
            expect(mapWhatsOnCategory('Theatre and Musicals', 'Hamlet').subcategory).toBe('Shakespeare');
            expect(mapWhatsOnCategory('Theatre and Musicals', 'Romeo and Juliet').subcategory).toBe('Shakespeare');
            expect(mapWhatsOnCategory('Theatre and Musicals', 'Macbeth by Shakespeare').subcategory).toBe('Shakespeare');
            expect(mapWhatsOnCategory('Theatre and Musicals', 'A Modern Take on Othello').subcategory).toBe('Shakespeare');
            expect(mapWhatsOnCategory('Theatre and Musicals', 'The Merchant of Venice').subcategory).toBe('Shakespeare');
        });

        it('should classify music events correctly', () => {
            expect(mapWhatsOnCategory('Music and Concerts', 'Symphony Orchestra Concert').subcategory).toBe('Classical & Orchestra');
            expect(mapWhatsOnCategory('Music and Concerts', 'Melbourne Jazz Festival').subcategory).toBe('Jazz & Blues');
            expect(mapWhatsOnCategory('Music and Concerts', 'Rock Concert Live').subcategory).toBe('Rock & Alternative');
            expect(mapWhatsOnCategory('Music and Concerts', 'Heavy Metal Concert').subcategory).toBe('Metal & Punk');
            expect(mapWhatsOnCategory('Music and Concerts', 'Live Music Performance').subcategory).toBe('Pop & Electronic');
        });

        it('should classify festivals correctly', () => {
            expect(mapWhatsOnCategory('Festival', 'Melbourne Comedy Festival')).toEqual({
                category: 'arts',
                subcategory: 'Comedy Festival'
            });
            expect(mapWhatsOnCategory('Festival', 'Rock Music Festival')).toEqual({
                category: 'music',
                subcategory: 'Rock & Alternative'
            });
        });

        it('should classify family and arts events correctly', () => {
            expect(mapWhatsOnCategory('Family and Kids', 'Kids Magic Show').subcategory).toBe('Kids Shows');
            expect(mapWhatsOnCategory('Exhibition', 'Gallery Exhibition').subcategory).toBe('Art Exhibitions');
            expect(mapWhatsOnCategory('Market', 'Artisan Market').subcategory).toBe('Markets & Fairs');
        });

        it('should handle unknown categories and case insensitivity', () => {
            expect(mapWhatsOnCategory('Events', 'Some Event').category).toBe('other');
            expect(mapWhatsOnCategory('music and concerts', 'JAZZ Concert').subcategory).toBe('Jazz & Blues');
        });
    });

    // ============================================================================
    // Ticketmaster Category Mapping Tests
    // ============================================================================
    describe('mapTicketmasterCategory', () => {
        it('should classify music segments correctly', () => {
            expect(mapTicketmasterCategory('Music', 'Alternative Rock', undefined).subcategory).toBe('Rock & Alternative');
            expect(mapTicketmasterCategory('Music', 'Jazz and Blues', undefined).subcategory).toBe('Jazz & Blues');
            expect(mapTicketmasterCategory('Music', 'Classical', undefined).subcategory).toBe('Classical & Orchestra');
            expect(mapTicketmasterCategory('Music', 'Hard Rock/Metal', undefined).subcategory).toBe('Metal & Punk');
            expect(mapTicketmasterCategory('Music', 'Dance/Electronic', undefined).subcategory).toBe('Pop & Electronic');
        });

        it('should classify sports segments correctly', () => {
            expect(mapTicketmasterCategory('Sport', 'AFL', undefined)).toEqual({
                category: 'sports',
                subcategory: 'AFL'
            });
            expect(mapTicketmasterCategory('Sport', 'Cricket', undefined).subcategory).toBe('Cricket');
            expect(mapTicketmasterCategory('Sport', 'Motorsport', undefined).subcategory).toBe('Motorsports');
            expect(mapTicketmasterCategory('Sport', 'Netball', undefined).subcategory).toBe('Other Sports');
        });

        it('should classify theatre segments correctly', () => {
            expect(mapTicketmasterCategory('Arts, Theatre & Comedy', 'Musicals', undefined).subcategory).toBe('Musicals');
            expect(mapTicketmasterCategory('Arts, Theatre & Comedy', 'Opera', undefined).subcategory).toBe('Opera');
            expect(mapTicketmasterCategory('Arts, Theatre & Comedy', 'Comedy', undefined).subcategory).toBe('Comedy Shows');
            expect(mapTicketmasterCategory('Arts & Theatre', undefined, undefined).subcategory).toBe('Drama');
        });

        it('should detect Shakespeare plays in Ticketmaster events', () => {
            expect(mapTicketmasterCategory('Arts, Theatre & Comedy', 'Plays', undefined, 'King Lear').subcategory).toBe('Shakespeare');
            expect(mapTicketmasterCategory('Arts & Theatre', undefined, undefined, 'Much Ado About Nothing').subcategory).toBe('Shakespeare');
        });

        it('should classify family and film segments correctly', () => {
            expect(mapTicketmasterCategory('Family & Attractions', 'Circus', undefined).subcategory).toBe('Circus & Magic');
            expect(mapTicketmasterCategory('Film', undefined, undefined)).toEqual({
                category: 'arts',
                subcategory: 'Film & Cinema'
            });
        });

        it('should use title fallback when segment is missing', () => {
            expect(mapTicketmasterCategory(undefined, undefined, undefined, 'Jazz Concert Tonight')).toEqual({
                category: 'music',
                subcategory: 'Jazz & Blues'
            });
            expect(mapTicketmasterCategory(undefined, undefined, undefined, 'AFL Grand Final').category).toBe('sports');
        });

        it('should handle undefined parameters gracefully', () => {
            expect(mapTicketmasterCategory()).toEqual({
                category: 'other',
                subcategory: 'Community Events'
            });
        });
    });

    // ============================================================================
    // Marriner Group Category Mapping Tests
    // ============================================================================
    describe('mapMarrinerCategory', () => {
        it('should use Marriner categories when provided', () => {
            expect(mapMarrinerCategory('Hamilton', 'Princess Theatre', 'Musical').subcategory).toBe('Musicals');
            expect(mapMarrinerCategory('Symphony Night', 'Arts Centre', 'Concert').category).toBe('music');
            expect(mapMarrinerCategory('Stand-up Show', 'Forum Theatre', 'Comedy').subcategory).toBe('Comedy Shows');
        });

        it('should classify music events by title', () => {
            expect(mapMarrinerCategory('Melbourne Symphony Orchestra Concert', 'Arts Centre', undefined).subcategory).toBe('Classical & Orchestra');
            expect(mapMarrinerCategory('Jazz Night Live', 'Forum Theatre', undefined).subcategory).toBe('Jazz & Blues');
            expect(mapMarrinerCategory('Rock Band Tour', 'Palais Theatre', undefined).subcategory).toBe('Rock & Alternative');
        });

        it('should classify theatre events by title', () => {
            expect(mapMarrinerCategory('Hamilton: The Musical', 'Princess Theatre', undefined).subcategory).toBe('Musicals');
            expect(mapMarrinerCategory('Swan Lake Ballet', 'Arts Centre', undefined).subcategory).toBe('Ballet & Dance');
            expect(mapMarrinerCategory('The Play', 'MTC Theatre', undefined).subcategory).toBe('Drama');
        });

        it('should detect Shakespeare plays in Marriner events', () => {
            expect(mapMarrinerCategory('The Tempest', 'Arts Centre', undefined).subcategory).toBe('Shakespeare');
            expect(mapMarrinerCategory('Twelfth Night', 'Princess Theatre', 'Play').subcategory).toBe('Shakespeare');
            expect(mapMarrinerCategory('Julius Caesar', 'MTC Theatre', undefined).subcategory).toBe('Shakespeare');
        });

        it('should not confuse similar keywords', () => {
            expect(mapMarrinerCategory('La Bohème Opera', 'State Theatre', undefined)).toEqual({
                category: 'theatre',
                subcategory: 'Opera'
            });
        });

        it('should handle case insensitivity', () => {
            expect(mapMarrinerCategory('SYMPHONY ORCHESTRA', 'Arts Centre', 'CONCERT').category).toBe('music');
        });
    });

    // ============================================================================
    // Integration Tests
    // ============================================================================
    describe('Cross-source consistency', () => {
        it('should produce consistent categories for same event across sources', () => {
            const whatsOn = mapWhatsOnCategory('Music and Concerts', 'Jazz Night at the Basement');
            const ticketmaster = mapTicketmasterCategory('Music', 'Jazz and Blues', undefined);
            const marriner = mapMarrinerCategory('Jazz Night Live', 'The Basement', 'Concert');

            expect(whatsOn.category).toBe('music');
            expect(ticketmaster.category).toBe('music');
            expect(marriner.category).toBe('music');

            expect(whatsOn.subcategory).toContain('Jazz');
            expect(ticketmaster.subcategory).toContain('Jazz');
            expect(marriner.subcategory).toContain('Jazz');
        });

        it('should handle musicals consistently across sources', () => {
            const whatsOn = mapWhatsOnCategory('Theatre and Musicals', 'Hamilton: The Musical');
            const ticketmaster = mapTicketmasterCategory('Arts, Theatre & Comedy', 'Musicals', undefined);
            const marriner = mapMarrinerCategory('Hamilton: The Musical', 'Princess Theatre', 'Musical');

            expect(whatsOn.subcategory).toBe('Musicals');
            expect(ticketmaster.subcategory).toBe('Musicals');
            expect(marriner.subcategory).toBe('Musicals');
        });

        it('should detect Shakespeare consistently across sources', () => {
            const whatsOn = mapWhatsOnCategory('Theatre and Musicals', 'Hamlet');
            const ticketmaster = mapTicketmasterCategory('Arts & Theatre', undefined, undefined, 'Hamlet');
            const marriner = mapMarrinerCategory('Hamlet', 'Arts Centre', 'Play');

            expect(whatsOn.subcategory).toBe('Shakespeare');
            expect(ticketmaster.subcategory).toBe('Shakespeare');
            expect(marriner.subcategory).toBe('Shakespeare');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty strings and special characters', () => {
            expect(() => mapWhatsOnCategory('', '')).not.toThrow();
            expect(() => mapTicketmasterCategory('', '', '', '')).not.toThrow();
            expect(() => mapMarrinerCategory('', '', '')).not.toThrow();
            expect(() => mapWhatsOnCategory('Music and Concerts', 'Band @ The Venue!')).not.toThrow();
        });

        it('should return valid category objects for all inputs', () => {
            const result1 = mapWhatsOnCategory('unknown', 'test');
            expect(result1).toHaveProperty('category');
            expect(typeof result1.category).toBe('string');

            const result2 = mapTicketmasterCategory();
            expect(result2).toHaveProperty('category');
            expect(typeof result2.category).toBe('string');
        });
    });
});