// ============================================
// deduplication.ts - Enhanced Multi-Source Deduplication
// Handles date discrepancies, merges subcategories, enriches data
// Time: O(n * k), Space: O(n)
// ============================================

import stringSimilarity from 'string-similarity';
import type { EventForDedup, DuplicateMatch } from '../scrapers/types';
import { isValidSubcategory } from '../categories';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    TITLE_THRESHOLD: 0.75,
    OVERALL_THRESHOLD: 0.78,
    DATE_WINDOW_DAYS: 14,  // Events within 2 weeks could be same run
};

const SOURCE_PRIORITY: Record<string, number> = {
    marriner: 5,      // Official venue - best for dates/booking
    ticketmaster: 4,  // Ticketing platform - best for prices
    whatson: 3,       // Government curated - best for descriptions
};

// ============================================
// NORMALISATION
// ============================================

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'at', 'to', 'for', 'of', 'in', 'on',
    'live', 'presents', 'featuring', 'feat', 'ft', 'show', 'tour', 'melbourne',
]);

const VENUE_SUFFIXES = /\s*(theatre|theater|centre|center|arena|stadium|hall|auditorium|melbourne|vic|victoria)$/gi;

function normalise(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normaliseTitle(title: string): string {
    return normalise(title).split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w)).join(' ');
}

function normaliseVenue(venue: string): string {
    return normalise(venue).replace(VENUE_SUFFIXES, '').trim();
}

function getBucketKey(title: string): string {
    const words = normaliseTitle(title).split(' ').slice(0, 3);
    return words.join(' ');
}

// ============================================
// SIMILARITY SCORING
// ============================================

function titleSimilarity(t1: string, t2: string): number {
    const n1 = normaliseTitle(t1), n2 = normaliseTitle(t2);
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.95;
    return stringSimilarity.compareTwoStrings(n1, n2);
}

function venueSimilarity(v1: string, v2: string): number {
    const n1 = normaliseVenue(v1), n2 = normaliseVenue(v2);
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.95;
    return stringSimilarity.compareTwoStrings(n1, n2);
}

/**
 * Check if date ranges overlap or are close enough to be same event run
 * Improved to handle date discrepancies better
 */
function dateOverlap(e1: EventForDedup, e2: EventForDedup): number {
    const s1 = e1.startDate.getTime(), e1End = (e1.endDate || e1.startDate).getTime();
    const s2 = e2.startDate.getTime(), e2End = (e2.endDate || e2.startDate).getTime();

    // Ranges overlap
    if (s1 <= e2End && s2 <= e1End) return 1.0;

    // Within window (for shows that might have slightly different listed dates)
    const windowMs = CONFIG.DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const gaps = [
        Math.abs(s1 - s2),
        Math.abs(e1End - e2End),
        Math.abs(s1 - e2End),
        Math.abs(s2 - e1End)
    ];
    const minGap = Math.min(...gaps);

    if (minGap <= windowMs) return 0.85;
    if (minGap <= windowMs * 2) return 0.5;
    return 0;
}

function matchScore(e1: EventForDedup, e2: EventForDedup): { score: number; breakdown: string } {
    const title = titleSimilarity(e1.title, e2.title);
    const venue = venueSimilarity(e1.venue.name, e2.venue.name);
    const date = dateOverlap(e1, e2);

    // Weighted: title most important, then date, then venue
    const score = title * 0.50 + date * 0.30 + venue * 0.20;
    return { score, breakdown: `t:${(title * 100).toFixed(0)} d:${(date * 100).toFixed(0)} v:${(venue * 100).toFixed(0)}` };
}

// ============================================
// CORE DEDUPLICATION
// ============================================

export function findDuplicates(events: (EventForDedup & { _id: string })[]): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];
    const buckets = new Map<string, (EventForDedup & { _id: string })[]>();

    // Bucket by title prefix
    for (const event of events) {
        const key = getBucketKey(event.title);
        if (!key) continue;

        // Add to primary bucket
        const bucket = buckets.get(key) || [];
        bucket.push(event);
        buckets.set(key, bucket);

        // Also add to first-word bucket for fuzzy matching
        const firstWord = key.split(' ')[0];
        if (firstWord && firstWord !== key) {
            const shortBucket = buckets.get(firstWord) || [];
            if (!shortBucket.includes(event)) {
                shortBucket.push(event);
                buckets.set(firstWord, shortBucket);
            }
        }
    }

    // Compare within buckets
    const compared = new Set<string>();

    for (const bucket of buckets.values()) {
        if (bucket.length < 2) continue;

        for (let i = 0; i < bucket.length; i++) {
            for (let j = i + 1; j < bucket.length; j++) {
                const e1 = bucket[i], e2 = bucket[j];
                if (e1.source === e2.source) continue;

                const pairKey = [e1._id, e2._id].sort().join('|');
                if (compared.has(pairKey)) continue;
                compared.add(pairKey);

                const { score, breakdown } = matchScore(e1, e2);

                if (score >= CONFIG.OVERALL_THRESHOLD) {
                    duplicates.push({
                        event1Id: e1._id,
                        event2Id: e2._id,
                        confidence: score,
                        reason: `${(score * 100).toFixed(0)}% (${breakdown})`,
                    });
                }
            }
        }
    }

    return duplicates;
}

// ============================================
// MERGE STRATEGY - ENHANCED
// ============================================

export function selectPrimaryEvent(e1: EventForDedup, e2: EventForDedup): 'event1' | 'event2' {
    const p1 = SOURCE_PRIORITY[e1.source] || 0;
    const p2 = SOURCE_PRIORITY[e2.source] || 0;
    if (p1 !== p2) return p1 > p2 ? 'event1' : 'event2';

    // Compare completeness
    const score = (e: EventForDedup) => {
        let s = 0;
        if (e.description && e.description.length > 100) s += 2;
        if (e.imageUrl) s += 1;
        if (e.priceMin !== undefined) s += 1;
        if (e.priceDetails) s += 1;
        if (e.endDate) s += 1;
        if (e.venue.address && !e.venue.address.includes('TBA')) s += 1;
        if (e.accessibility?.length) s += 1;
        return s;
    };

    return score(e1) >= score(e2) ? 'event1' : 'event2';
}

/**
 * Merge two events, keeping best data from each source
 * ENHANCED: Better subcategory handling, date resolution, enrichment
 */
export function mergeEvents(primary: EventForDedup, secondary: EventForDedup): EventForDedup {
    // ============================================
    // 1. CATEGORY & SUBCATEGORIES
    // ============================================
    // Use primary's category as the main category
    const category = primary.category || secondary.category || 'other';

    // Merge all subcategories, but validate them against the main category
    const allSubcats = new Set<string>();
    [
        primary.subcategory,
        secondary.subcategory,
        ...(primary.subcategories || []),
        ...(secondary.subcategories || [])
    ].filter(Boolean).forEach(s => {
        if (s && isValidSubcategory(category, s)) {
            allSubcats.add(s);
        }
    });
    const subcategories = Array.from(allSubcats);

    // ============================================
    // 2. DATES - Handle discrepancies
    // ============================================
    // Use the earlier start date (events often list different opening dates)
    const startDate = primary.startDate < secondary.startDate ? primary.startDate : secondary.startDate;

    // Use the later end date to capture full run
    const endDate = (() => {
        const e1 = primary.endDate || primary.startDate;
        const e2 = secondary.endDate || secondary.startDate;
        return e1 > e2 ? e1 : e2;
    })();

    // ============================================
    // 3. DESCRIPTION - Best quality
    // ============================================
    const description = (() => {
        const p = primary.description || '';
        const s = secondary.description || '';
        if (p.includes('No description')) return s || p;
        if (s.includes('No description')) return p || s;
        // Prefer longer, more detailed descriptions
        return p.length > s.length ? p : s;
    })();

    // ============================================
    // 4. PRICES - Wider range
    // ============================================
    const allPrices = [
        primary.priceMin,
        primary.priceMax,
        secondary.priceMin,
        secondary.priceMax
    ].filter(p => p !== undefined && p !== null) as number[];

    const priceMin = allPrices.length > 0 ? Math.min(...allPrices) : undefined;
    const priceMax = allPrices.length > 0 ? Math.max(...allPrices) : undefined;

    // Combine price details
    const priceDetails = [primary.priceDetails, secondary.priceDetails]
        .filter(Boolean)
        .join(' | ');

    // ============================================
    // 5. VENUE - Most complete info
    // ============================================
    const venue = {
        name: primary.venue.name.length > secondary.venue.name.length
            ? primary.venue.name
            : secondary.venue.name,
        address: primary.venue.address.includes('TBA')
            ? secondary.venue.address
            : primary.venue.address,
        suburb: primary.venue.suburb || secondary.venue.suburb || 'Melbourne',
    };

    // ============================================
    // 6. MEDIA - Best available
    // ============================================
    const imageUrl = primary.imageUrl || secondary.imageUrl;
    const videoUrl = primary.videoUrl || secondary.videoUrl;

    // ============================================
    // 7. ACCESSIBILITY - Combine unique values
    // ============================================
    const accessibility = [
        ...(primary.accessibility || []),
        ...(secondary.accessibility || [])
    ].filter((v, i, a) => a.indexOf(v) === i);

    // ============================================
    // 8. OTHER FIELDS
    // ============================================
    const ageRestriction = primary.ageRestriction || secondary.ageRestriction;
    const duration = primary.duration || secondary.duration;
    const isFree = primary.isFree || secondary.isFree || false;
    const bookingUrl = primary.bookingUrl || secondary.bookingUrl || '';

    return {
        ...primary,
        category,
        subcategories,
        description,
        startDate,
        endDate: endDate !== startDate ? endDate : undefined,
        venue,
        priceMin,
        priceMax,
        priceDetails: priceDetails || undefined,
        imageUrl,
        videoUrl,
        accessibility: accessibility.length > 0 ? accessibility : undefined,
        ageRestriction,
        duration,
        isFree,
        bookingUrl,
    };
}

// ============================================
// EXPORTS
// ============================================

export { normaliseTitle, normaliseVenue, matchScore, CONFIG };