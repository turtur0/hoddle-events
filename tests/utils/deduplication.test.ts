import {
    normaliseTitle,
    normaliseVenue,
    titleSimilarity,
    venueSimilarity,
    dateOverlap,
    matchScore,
    mergeEvents,
    findDuplicates,
    CONFIG,
    type EventForDedup,
} from '@/lib/utils/deduplication';

describe('Deduplication Algorithm', () => {
    // ============================================================================
    // Text Normalisation Tests
    // ============================================================================
    describe('normaliseTitle', () => {
        it('should convert to lowercase and remove punctuation', () => {
            expect(normaliseTitle("Hamilton: The Musical!")).toBe('hamilton musical');
        });

        it('should remove stop words', () => {
            expect(normaliseTitle('The Lion King at the Theatre')).toBe('lion king theatre');
        });

        it('should remove common venue terms', () => {
            expect(normaliseTitle('Hamilton Live in Melbourne')).toBe('hamilton');
        });

        it('should collapse multiple spaces', () => {
            expect(normaliseTitle('Swan    Lake   Ballet')).toBe('swan lake ballet');
        });

        it('should handle empty strings', () => {
            expect(normaliseTitle('')).toBe('');
        });

        it('should handle strings with only stop words', () => {
            expect(normaliseTitle('The A An')).toBe('');
        });
    });

    describe('normaliseVenue', () => {
        it('should remove geographic suffixes only', () => {
            expect(normaliseVenue('Princess Theatre Melbourne')).toBe('princess theatre');
            expect(normaliseVenue('Arts Centre Melbourne')).toBe('arts centre');
        });

        it('should iteratively remove multiple geographic suffixes', () => {
            expect(normaliseVenue('Forum Theatre Melbourne VIC')).toBe('forum theatre');
        });

        it('should preserve venue type words', () => {
            expect(normaliseVenue('Princess Theatre')).toBe('princess theatre');
            expect(normaliseVenue('Forum Hall')).toBe('forum hall');
        });

        it('should prevent false matches between different venue types', () => {
            const theatre = normaliseVenue('Princess Theatre');
            const cinema = normaliseVenue('Princess Cinema');
            expect(theatre).not.toBe(cinema);
        });

        it('should handle punctuation in venue names', () => {
            expect(normaliseVenue("Her Majesty's Theatre")).toBe('her majesty s theatre');
        });
    });


    // ============================================================================
    // Similarity Calculation Tests
    // ============================================================================
    describe('titleSimilarity', () => {
        it('should return 1.0 for exact matches', () => {
            expect(titleSimilarity('Hamilton', 'Hamilton')).toBe(1.0);
        });

        it('should return 0.95 for substring matches', () => {
            expect(titleSimilarity('Hamilton', 'Hamilton: The Musical')).toBe(0.95);
            expect(titleSimilarity('Hamilton: The Musical', 'Hamilton')).toBe(0.95);
        });

        it('should return high scores for similar titles', () => {
            const score = titleSimilarity('Swan Lake Ballet', 'Swan Lake');
            expect(score).toBeGreaterThan(0.7);
        });

        it('should return low scores for different titles', () => {
            const score = titleSimilarity('Hamilton', 'Swan Lake');
            expect(score).toBeLessThan(0.3);
        });

        it('should handle empty strings as substring matches', () => {
            expect(titleSimilarity('', '')).toBe(1.0);
            expect(titleSimilarity('Hamilton', '')).toBe(0.95);
        });
    });

    describe('venueSimilarity', () => {
        it('should match venues with different formatting', () => {
            const score = venueSimilarity('Princess Theatre', 'Princess Theatre Melbourne');
            expect(score).toBeGreaterThan(0.9);
        });

        it('should match venues with different suffixes', () => {
            const score = venueSimilarity('Arts Centre', 'Arts Centre Melbourne');
            expect(score).toBeGreaterThan(0.9);
        });

        it('should return low scores for different venues', () => {
            const score = venueSimilarity('Princess Theatre', 'Forum Theatre');
            expect(score).toBeLessThan(0.5);
        });
    });

    describe('dateOverlap', () => {
        const createEvent = (start: Date, end?: Date): EventForDedup => ({
            title: 'Test Event',
            description: 'Test',
            category: 'music',
            startDate: start,
            endDate: end,
            venue: { name: 'Test Venue', address: 'Test', suburb: 'Melbourne' },
            isFree: false,
            bookingUrl: 'https://example.com',
            source: 'ticketmaster',
            sourceId: 'test-123',
        });

        it('should return 1.0 for overlapping date ranges', () => {
            const event1 = createEvent(new Date('2025-01-01'), new Date('2025-01-15'));
            const event2 = createEvent(new Date('2025-01-10'), new Date('2025-01-20'));
            expect(dateOverlap(event1, event2)).toBe(1.0);
        });

        it('should return 1.0 for identical date ranges', () => {
            const event1 = createEvent(new Date('2025-01-01'), new Date('2025-01-15'));
            const event2 = createEvent(new Date('2025-01-01'), new Date('2025-01-15'));
            expect(dateOverlap(event1, event2)).toBe(1.0);
        });

        it('should return 0.85 for dates within 14 days', () => {
            const event1 = createEvent(new Date('2025-01-01'), new Date('2025-01-10'));
            const event2 = createEvent(new Date('2025-01-12'), new Date('2025-01-20'));
            expect(dateOverlap(event1, event2)).toBe(0.85);
        });

        it('should return 0.5 for dates within 28 days', () => {
            const event1 = createEvent(new Date('2025-01-01'), new Date('2025-01-05'));
            const event2 = createEvent(new Date('2025-01-20'), new Date('2025-01-25'));
            expect(dateOverlap(event1, event2)).toBe(0.5);
        });

        it('should return 0 for dates more than 28 days apart', () => {
            const event1 = createEvent(new Date('2025-01-01'), new Date('2025-01-05'));
            const event2 = createEvent(new Date('2025-03-01'), new Date('2025-03-05'));
            expect(dateOverlap(event1, event2)).toBe(0);
        });

        it('should handle events without end dates', () => {
            const event1 = createEvent(new Date('2025-01-01'));
            const event2 = createEvent(new Date('2025-01-01'));
            expect(dateOverlap(event1, event2)).toBe(1.0);
        });
    });

    describe('matchScore', () => {
        const createEvent = (
            title: string,
            venue: string,
            start: Date,
            end?: Date
        ): EventForDedup => ({
            title,
            description: 'Test',
            category: 'music',
            startDate: start,
            endDate: end,
            venue: { name: venue, address: 'Test', suburb: 'Melbourne' },
            isFree: false,
            bookingUrl: 'https://example.com',
            source: 'ticketmaster',
            sourceId: 'test-123',
        });

        it('should return high score for matching events', () => {
            const event1 = createEvent('Hamilton', 'Princess Theatre', new Date('2025-01-01'));
            const event2 = createEvent('Hamilton: The Musical', 'Princess Theatre Melbourne', new Date('2025-01-01'));

            const { score } = matchScore(event1, event2);
            expect(score).toBeGreaterThan(CONFIG.OVERALL_THRESHOLD);
        });

        it('should return low score for non-matching events', () => {
            const event1 = createEvent('Hamilton', 'Princess Theatre', new Date('2025-01-01'));
            const event2 = createEvent('Swan Lake', 'Arts Centre', new Date('2025-02-01'));

            const { score } = matchScore(event1, event2);
            expect(score).toBeLessThan(CONFIG.OVERALL_THRESHOLD);
        });

        it('should weight title at 50%, date at 30%, venue at 20%', () => {
            const event1 = createEvent('Test Event', 'Test Venue', new Date('2025-01-01'));
            const event2 = createEvent('Test Event', 'Different Venue', new Date('2025-02-01'));

            const { breakdown } = matchScore(event1, event2);
            expect(breakdown).toMatch(/t:\d+ d:\d+ v:\d+/);
        });
    });

    // ============================================================================
    // Event Merging Tests
    // ============================================================================
    describe('mergeEvents', () => {
        const createEvent = (overrides: Partial<EventForDedup> = {}): EventForDedup => ({
            title: 'Test Event',
            description: 'Test description',
            category: 'music',
            subcategories: ['rock'],
            startDate: new Date('2025-01-01'),
            venue: { name: 'Test Venue', address: 'Test', suburb: 'Melbourne' },
            isFree: false,
            bookingUrl: 'https://example.com',
            source: 'ticketmaster',
            sourceId: 'test-123',
            ...overrides,
        });

        it('should use primary event title', () => {
            const primary = createEvent({ title: 'Hamilton' });
            const secondary = createEvent({ title: 'Hamilton: The Musical' });
            const merged = mergeEvents(primary, secondary);
            expect(merged.title).toBe('Hamilton');
        });

        it('should combine unique subcategories', () => {
            const primary = createEvent({ subcategories: ['rock', 'indie'] });
            const secondary = createEvent({ subcategories: ['indie', 'alternative'] });
            const merged = mergeEvents(primary, secondary);

            expect(merged.subcategories).toContain('rock');
            expect(merged.subcategories).toContain('indie');
            expect(merged.subcategories).toContain('alternative');
            expect(merged.subcategories?.length).toBe(3);
        });

        it('should add secondary category as subcategory when categories differ', () => {
            const primary = createEvent({
                category: 'music',
                subcategories: ['rock', 'indie']
            });
            const secondary = createEvent({
                category: 'arts',
                subcategories: ['contemporary']
            });
            const merged = mergeEvents(primary, secondary);

            expect(merged.category).toBe('music'); // Primary category preserved
            expect(merged.subcategories).toContain('rock');
            expect(merged.subcategories).toContain('indie');
            expect(merged.subcategories).toContain('contemporary');
            expect(merged.subcategories).toContain('arts'); // Secondary category added
            expect(merged.subcategories?.length).toBe(4);
        });

        it('should not duplicate category in subcategories', () => {
            const primary = createEvent({
                category: 'music',
                subcategories: ['rock', 'music'] // Already has 'music' in subcategories
            });
            const secondary = createEvent({
                category: 'music',
                subcategories: ['indie']
            });
            const merged = mergeEvents(primary, secondary);

            expect(merged.subcategories).toContain('rock');
            expect(merged.subcategories).toContain('indie');
            expect(merged.subcategories).toContain('music');
            expect(merged.subcategories?.filter(s => s === 'music').length).toBe(1);
            expect(merged.subcategories?.length).toBe(3);
        });


        it('should use earliest start date and latest end date', () => {
            const primary = createEvent({
                startDate: new Date('2025-01-05'),
                endDate: new Date('2025-01-15'),
            });
            const secondary = createEvent({
                startDate: new Date('2025-01-01'),
                endDate: new Date('2025-01-20'),
            });
            const merged = mergeEvents(primary, secondary);
            expect(merged.startDate).toEqual(new Date('2025-01-01'));
            expect(merged.endDate).toEqual(new Date('2025-01-20'));
        });

        it('should prefer longer description', () => {
            const primary = createEvent({ description: 'Short' });
            const secondary = createEvent({ description: 'A much longer and more detailed description' });
            const merged = mergeEvents(primary, secondary);
            expect(merged.description).toBe('A much longer and more detailed description');
        });

        it('should avoid placeholder descriptions', () => {
            const primary = createEvent({ description: 'No description available' });
            const secondary = createEvent({ description: 'Real description' });
            const merged = mergeEvents(primary, secondary);
            expect(merged.description).toBe('Real description');
        });

        it('should use widest price range', () => {
            const primary = createEvent({ priceMin: 50, priceMax: 150 });
            const secondary = createEvent({ priceMin: 45, priceMax: 160 });
            const merged = mergeEvents(primary, secondary);
            expect(merged.priceMin).toBe(45);
            expect(merged.priceMax).toBe(160);
        });

        it('should combine price details', () => {
            const primary = createEvent({ priceDetails: 'Student discounts' });
            const secondary = createEvent({ priceDetails: 'Group bookings available' });
            const merged = mergeEvents(primary, secondary);
            expect(merged.priceDetails).toBe('Student discounts | Group bookings available');
        });

        it('should set isFree if either event is free', () => {
            const primary = createEvent({ isFree: false });
            const secondary = createEvent({ isFree: true });
            const merged = mergeEvents(primary, secondary);
            expect(merged.isFree).toBe(true);
        });

        it('should prefer real address over TBA', () => {
            const primary = createEvent({ venue: { name: 'Test', address: 'TBA', suburb: 'Melbourne' } });
            const secondary = createEvent({ venue: { name: 'Test', address: '123 Real St', suburb: 'Melbourne' } });
            const merged = mergeEvents(primary, secondary);
            expect(merged.venue.address).toBe('123 Real St');
        });

        it('should combine unique accessibility features', () => {
            const primary = createEvent({ accessibility: ['Wheelchair access'] });
            const secondary = createEvent({ accessibility: ['Hearing loop', 'Wheelchair access'] });
            const merged = mergeEvents(primary, secondary);
            expect(merged.accessibility).toContain('Wheelchair access');
            expect(merged.accessibility).toContain('Hearing loop');
            expect(merged.accessibility?.length).toBe(2);
        });

        it('should take first available optional fields', () => {
            const primary = createEvent({ imageUrl: undefined, ageRestriction: '18+' });
            const secondary = createEvent({ imageUrl: 'https://example.com/image.jpg', ageRestriction: undefined });
            const merged = mergeEvents(primary, secondary);
            expect(merged.imageUrl).toBe('https://example.com/image.jpg');
            expect(merged.ageRestriction).toBe('18+');
        });
    });

    // ============================================================================
    // Duplicate Detection Tests
    // ============================================================================
    describe('findDuplicates', () => {
        const createEvent = (
            id: string,
            title: string,
            venue: string,
            startDate: Date,
            source: 'ticketmaster' | 'marriner' | 'whatson',
            overrides: Partial<EventForDedup> = {}
        ): EventForDedup & { _id: string } => ({
            _id: id,
            title,
            description: 'Test',
            category: 'music',
            startDate,
            venue: { name: venue, address: 'Test', suburb: 'Melbourne' },
            isFree: false,
            bookingUrl: 'https://example.com',
            source,
            sourceId: `${source}-${id}`,
            ...overrides,
        });

        it('should detect obvious duplicates from different sources', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
            expect(duplicates[0].confidence).toBeGreaterThan(CONFIG.OVERALL_THRESHOLD);
        });

        it('should detect duplicates with title variations', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton: An American Musical', 'Princess Theatre', new Date('2025-01-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
        });

        it('should detect duplicates with venue variations', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton', 'Princess Theatre Melbourne', new Date('2025-01-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
        });

        it('should detect duplicates with close dates', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton', 'Princess Theatre', new Date('2025-01-05'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
        });

        it('should not flag non-duplicates', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Swan Lake', 'Arts Centre', new Date('2025-02-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(0);
        });

        it('should not flag same event at same venue on different dates', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton', 'Princess Theatre', new Date('2025-06-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(0);
        });

        it('should filter out events with missing required fields', () => {
            const events = [
                createEvent('1', '', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton', '', new Date('2025-01-01'), 'ticketmaster'),
                createEvent('3', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'whatson'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(0);
        });

        it('should handle large datasets efficiently', () => {
            const events = Array.from({ length: 1000 }, (_, i) =>
                createEvent(`${i}`, `Event ${i}`, 'Test Venue', new Date('2025-01-01'), i % 2 === 0 ? 'marriner' : 'ticketmaster')
            );

            const startTime = Date.now();
            findDuplicates(events);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });

        it('should return matches with confidence scores and reasons', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'marriner'),
                createEvent('2', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates[0]).toHaveProperty('event1Id');
            expect(duplicates[0]).toHaveProperty('event2Id');
            expect(duplicates[0]).toHaveProperty('confidence');
            expect(duplicates[0]).toHaveProperty('reason');
            expect(duplicates[0].reason).toMatch(/\d+% \(t:\d+ d:\d+ v:\d+\)/);
        });

        it('should not compare events from same source', () => {
            const events = [
                createEvent('1', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'ticketmaster'),
                createEvent('2', 'Hamilton', 'Princess Theatre', new Date('2025-01-01'), 'ticketmaster'),
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(0);
        });
    });

    // ============================================================================
    // Integration Tests
    // ============================================================================
    describe('Full deduplication workflow', () => {
        it('should correctly identify and merge duplicate events', () => {
            const events = [
                {
                    _id: '1',
                    title: 'Hamilton',
                    description: 'Short description',
                    category: 'theatre',
                    subcategories: ['musical'],
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-01-15'),
                    venue: { name: 'Princess Theatre', address: 'TBA', suburb: 'Melbourne' },
                    priceMin: 50,
                    priceMax: 150,
                    isFree: false,
                    bookingUrl: 'https://marriner.com/hamilton',
                    source: 'marriner' as const,
                    sourceId: 'marriner-ham-1',
                },
                {
                    _id: '2',
                    title: 'Hamilton: An American Musical',
                    description: 'A revolutionary story of passion, unstoppable ambition, and the dawn of a new nation.',
                    category: 'theatre',
                    subcategories: ['musical', 'broadway'],
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-01-20'),
                    venue: { name: 'Princess Theatre Melbourne', address: '163 Spring St', suburb: 'Melbourne' },
                    priceMin: 45,
                    priceMax: 160,
                    priceDetails: 'Student discounts available',
                    isFree: false,
                    bookingUrl: 'https://ticketmaster.com/hamilton',
                    imageUrl: 'https://example.com/hamilton.jpg',
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-ham-1',
                },
            ];

            // Find duplicates
            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);

            // Merge events (marriner is primary based on source priority in deduplication.ts)
            const merged = mergeEvents(events[0], events[1]);

            // Verify merged result
            expect(merged.title).toBe('Hamilton'); // From marriner
            expect(merged.description).toContain('revolutionary'); // Longer from ticketmaster

            expect(merged.startDate).toEqual(new Date('2025-01-01')); // Earliest
            expect(merged.endDate).toEqual(new Date('2025-01-20')); // Latest
            expect(merged.priceMin).toBe(45); // Minimum of both
            expect(merged.priceMax).toBe(160); // Maximum of both
            expect(merged.venue.address).toBe('163 Spring St'); // Real address over TBA
            expect(merged.imageUrl).toBe('https://example.com/hamilton.jpg'); // From ticketmaster
        });
    });
});