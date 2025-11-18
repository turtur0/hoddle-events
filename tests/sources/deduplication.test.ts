import { findDuplicates, normaliseVenue, tokenizeTitle, calculateSimilarity, createFingerprint } from '@/app/lib/utils/deduplication';

describe('Deduplication Algorithm', () => {
    describe('normaliseVenue', () => {
        test('removes common prefixes and suffixes', () => {
            expect(normaliseVenue('The Corner Hotel')).toBe('corner');
            expect(normaliseVenue('Corner Hotel')).toBe('corner');
            expect(normaliseVenue('The Corner')).toBe('corner');
        });

        test('handles different casings', () => {
            expect(normaliseVenue('THE CORNER HOTEL')).toBe('corner');
            expect(normaliseVenue('The Corner Hotel')).toBe('corner');
        });
    });

    describe('tokenizeTitle', () => {
        test('removes stop words', () => {
            const tokens = tokenizeTitle('The Rolling Stones Live in Concert');
            expect(tokens.has('rolling')).toBe(true);
            expect(tokens.has('stones')).toBe(true);
            expect(tokens.has('concert')).toBe(true);
            expect(tokens.has('the')).toBe(false);
            expect(tokens.has('in')).toBe(false);
        });
    });

    describe('findDuplicates - Real World Scenarios', () => {
        test('detects very similar titles with minor differences', () => {
            const events = [
                {
                    _id: '1',
                    title: 'The Rolling Stones Live in Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Rolling Stones Live Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
            expect(duplicates[0].confidence).toBeGreaterThan(0.85);
        });

        test('detects duplicates with different word order', () => {
            const events = [
                {
                    _id: '1',
                    title: 'Melbourne Comedy Festival Gala',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Forum Theatre', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Comedy Festival Melbourne Gala',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Forum Theatre', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
            expect(duplicates[0].confidence).toBeGreaterThan(0.75);
        });

        test('handles moderate title differences correctly', () => {
            const events = [
                {
                    _id: '1',
                    title: 'Rock Music Festival',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Rock Festival',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
            // This is a medium confidence match (70-80%)
            expect(duplicates[0].confidence).toBeGreaterThan(0.7);
            expect(duplicates[0].confidence).toBeLessThan(0.85);
            expect(duplicates[0].shouldMerge).toBe(true);
        });

        test('correctly identifies non-duplicates at same venue', () => {
            const events = [
                {
                    _id: '1',
                    title: 'Classical Music Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Heavy Metal Festival',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(0);
        });

        test('handles special characters and punctuation', () => {
            const events = [
                {
                    _id: '1',
                    title: "The Blues Brothers' Tribute Show",
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Corner Hotel', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Blues Brothers Tribute Show',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'The Corner Hotel', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(1);
            expect(duplicates[0].confidence).toBeGreaterThan(0.85);
        });

        test('respects time window for duplicates', () => {
            const events = [
                {
                    _id: '1',
                    title: 'Rock Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Rock Concert',
                    startDate: new Date('2025-12-01T22:00:00'), // 3 hours later (within 4-hour window)
                    venue: { name: 'Rod Laver Arena', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
                {
                    _id: '3',
                    title: 'Rock Concert',
                    startDate: new Date('2025-12-02T02:00:00'), // 7 hours later (outside 4-hour window from event 1, but within window from event 2)
                    venue: { name: 'Rod Laver Arena', address: '789 St', suburb: 'Melbourne' },
                    source: 'artscentre' as const,
                    sourceId: 'ac-001',
                },
            ];

            const duplicates = findDuplicates(events);

            // Event 1 and 2 are within window (3 hours apart)
            // Event 2 and 3 are within window (4 hours apart)
            // Event 1 and 3 are NOT within window (7 hours apart)
            // So we should get 2 duplicate pairs
            expect(duplicates.length).toBe(2);

            // Verify the pairs
            const hasPair12 = duplicates.some(
                d => (d.event1Id === '1' && d.event2Id === '2') || (d.event1Id === '2' && d.event2Id === '1')
            );
            const hasPair23 = duplicates.some(
                d => (d.event1Id === '2' && d.event2Id === '3') || (d.event1Id === '3' && d.event2Id === '2')
            );
            const hasPair13 = duplicates.some(
                d => (d.event1Id === '1' && d.event2Id === '3') || (d.event1Id === '3' && d.event2Id === '1')
            );

            expect(hasPair12).toBe(true);
            expect(hasPair23).toBe(true);
            expect(hasPair13).toBe(false); // Should NOT find this pair (7 hours apart)
        });

        test('does not compare events from same source', () => {
            const events = [
                {
                    _id: '1',
                    title: 'Rock Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Rock Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '456 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const, // Same source
                    sourceId: 'tm-002',
                },
            ];

            const duplicates = findDuplicates(events);
            expect(duplicates.length).toBe(0); // Should not detect as duplicate
        });
    });

    describe('Confidence Levels', () => {
        test('categorizes duplicates by confidence level', () => {
            const events = [
                // High confidence (exact match)
                {
                    _id: '1',
                    title: 'Taylor Swift Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'MCG', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-001',
                },
                {
                    _id: '2',
                    title: 'Taylor Swift Concert',
                    startDate: new Date('2025-12-01T19:00:00'),
                    venue: { name: 'MCG', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-001',
                },
                // Medium confidence
                {
                    _id: '3',
                    title: 'Ed Sheeran Live Tour',
                    startDate: new Date('2025-12-15T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '123 St', suburb: 'Melbourne' },
                    source: 'ticketmaster' as const,
                    sourceId: 'tm-002',
                },
                {
                    _id: '4',
                    title: 'Ed Sheeran Tour',
                    startDate: new Date('2025-12-15T19:00:00'),
                    venue: { name: 'Rod Laver Arena', address: '456 St', suburb: 'Melbourne' },
                    source: 'eventbrite' as const,
                    sourceId: 'eb-002',
                },
            ];

            const duplicates = findDuplicates(events);

            const highConfidence = duplicates.filter(d => d.confidence >= 0.9);
            const mediumConfidence = duplicates.filter(d => d.confidence >= 0.8 && d.confidence < 0.9);

            expect(highConfidence.length).toBeGreaterThan(0);
            expect(duplicates.every(d => d.shouldMerge)).toBe(true);
        });
    });
});