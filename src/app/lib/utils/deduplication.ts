import stringSimilarity from 'string-similarity';
import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

const SIMILARITY_THRESHOLDS = {
    EXACT: 1.0,           // Perfect match
    HIGH: 0.90,           // Very likely duplicate (e.g., "The Concert" vs "The Concert!")
    MEDIUM: 0.80,         // Probably duplicate (e.g., "Rock Festival" vs "Rock Music Festival")
    LOW: 0.70,            // Possibly duplicate (manual review recommended)
};

const TIME_WINDOW_HOURS = 4; // Events within 4 hours could be duplicates

// ============================================
// INTERFACES
// ============================================

interface normalisedEvent {
    title: string;
    startDate: Date;
    venue: {
        name: string;
        address: string;
        suburb: string;
    };
    source: string;
    sourceId: string;
}

interface EventFingerprint {
    exactHash: string;
    fuzzyHash: string;
    dateKey: string;
    venueKey: string;
    titleTokens: Set<string>;
    normalisedTitle: string;
    normalisedVenue: string;
}

interface DuplicateMatch {
    event1Id: string;
    event2Id: string;
    confidence: number;
    reason: string;
    shouldMerge: boolean;
}

// ============================================
// NORMALIZATION FUNCTIONS
// ============================================

/**
 * normalise text: lowercase, remove special chars, trim whitespace
 */
function normaliseText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Remove special characters
        .replace(/\s+/g, ' ')       // Collapse whitespace
        .trim();
}

/**
 * Aggressive normalization for venue names
 * Handles: "The Corner Hotel" === "Corner Hotel" === "The Corner"
 */
function normaliseVenue(venueName: string): string {
    let normalised = normaliseText(venueName);

    // Remove common prefixes/suffixes
    const removePatterns = [
        /^the\s+/,
        /\s+hotel$/,
        /\s+theatre$/,
        /\s+theater$/,
        /\s+centre$/,
        /\s+center$/,
        /\s+arena$/,
        /\s+stadium$/,
        /\s+hall$/,
        /\s+auditorium$/,
    ];

    removePatterns.forEach(pattern => {
        normalised = normalised.replace(pattern, '');
    });

    return normalised.trim();
}

/**
 * Tokenize title into significant words
 * Removes stop words and common filler
 */
function tokenizeTitle(title: string): Set<string> {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
        'live', 'presents', 'featuring', 'ft', 'feat',
    ]);

    const words = normaliseText(title).split(/\s+/);

    return new Set(
        words.filter(word => word.length > 2 && !stopWords.has(word))
    );
}

/**
 * Create date key for bucketing (e.g., "2025-11-19")
 */
function createDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Check if two dates are within TIME_WINDOW_HOURS of each other
 */
function datesWithinWindow(date1: Date, date2: Date): boolean {
    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours <= TIME_WINDOW_HOURS;
}

// ============================================
// HASHING FUNCTIONS
// ============================================

/**
 * Create exact hash for perfect duplicate detection
 * Hash of: normalised title + date + normalised venue
 */
function createExactHash(event: normalisedEvent): string {
    const composite = [
        normaliseText(event.title),
        event.startDate.toISOString(),
        normaliseVenue(event.venue.name),
    ].join('||');

    return crypto.createHash('md5').update(composite).digest('hex');
}

/**
 * Create fuzzy hash for near-duplicate detection
 * Uses only date + venue (titles might vary slightly)
 */
function createFuzzyHash(event: normalisedEvent): string {
    const dateKey = createDateKey(event.startDate);
    const venueKey = normaliseVenue(event.venue.name);

    return crypto.createHash('md5')
        .update(`${dateKey}||${venueKey}`)
        .digest('hex');
}

/**
 * Create complete fingerprint for an event
 */
function createFingerprint(event: normalisedEvent): EventFingerprint {
    return {
        exactHash: createExactHash(event),
        fuzzyHash: createFuzzyHash(event),
        dateKey: createDateKey(event.startDate),
        venueKey: normaliseVenue(event.venue.name),
        titleTokens: tokenizeTitle(event.title),
        normalisedTitle: normaliseText(event.title),
        normalisedVenue: normaliseVenue(event.venue.name),
    };
}

// ============================================
// SIMILARITY FUNCTIONS
// ============================================

/**
 * Calculate Jaccard similarity between two token sets
 * Measures overlap: |A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Calculate composite similarity score
 * Combines multiple similarity metrics with weights
 */
function calculateSimilarity(
    fp1: EventFingerprint,
    fp2: EventFingerprint
): number {
    // String similarity for titles (Dice coefficient)
    const titleSimilarity = stringSimilarity.compareTwoStrings(
        fp1.normalisedTitle,
        fp2.normalisedTitle
    );

    // Token overlap (Jaccard)
    const tokenSimilarity = jaccardSimilarity(fp1.titleTokens, fp2.titleTokens);

    // Venue similarity
    const venueSimilarity = stringSimilarity.compareTwoStrings(
        fp1.normalisedVenue,
        fp2.normalisedVenue
    );

    // Weighted combination
    const weights = {
        title: 0.50,    // Title is most important
        tokens: 0.30,   // Token overlap catches rewordings
        venue: 0.20,    // Venue is secondary (same venue, different events)
    };

    return (
        titleSimilarity * weights.title +
        tokenSimilarity * weights.tokens +
        venueSimilarity * weights.venue
    );
}

// ============================================
// CORE DEDUPLICATION ALGORITHM
// ============================================

/**
 * Main deduplication function
 * Time Complexity: O(n log n) average case due to bucketing
 * Space Complexity: O(n)
 */
export function findDuplicates(
    events: (normalisedEvent & { _id: string })[]
): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];

    // Step 1: Create fingerprints for all events
    // O(n)
    const fingerprints = new Map<string, EventFingerprint & { event: normalisedEvent & { _id: string } }>();

    events.forEach(event => {
        const fp = createFingerprint(event);
        fingerprints.set(event._id, { ...fp, event });
    });

    // Step 2: Group events by fuzzy hash (same date + venue)
    // O(n)
    const buckets = new Map<string, (EventFingerprint & { event: normalisedEvent & { _id: string } })[]>();

    fingerprints.forEach((fp, id) => {
        const bucket = buckets.get(fp.fuzzyHash) || [];
        bucket.push(fp);
        buckets.set(fp.fuzzyHash, bucket);
    });

    // Step 3: Compare events within each bucket
    // O(n * k) where k is average bucket size (typically small)
    buckets.forEach(bucket => {
        // Only compare within buckets that have multiple events
        if (bucket.length < 2) return;

        for (let i = 0; i < bucket.length; i++) {
            for (let j = i + 1; j < bucket.length; j++) {
                const fp1 = bucket[i];
                const fp2 = bucket[j];

                // Skip if from same source (already deduplicated at source)
                if (fp1.event.source === fp2.event.source) continue;

                // Skip if dates don't match within window
                if (!datesWithinWindow(fp1.event.startDate, fp2.event.startDate)) {
                    continue;
                }

                // Tier 1: Exact match
                if (fp1.exactHash === fp2.exactHash) {
                    duplicates.push({
                        event1Id: fp1.event._id,
                        event2Id: fp2.event._id,
                        confidence: 1.0,
                        reason: 'Exact match (title, date, venue)',
                        shouldMerge: true,
                    });
                    continue;
                }

                // Tier 2: Fuzzy match
                const similarity = calculateSimilarity(fp1, fp2);

                if (similarity >= SIMILARITY_THRESHOLDS.HIGH) {
                    duplicates.push({
                        event1Id: fp1.event._id,
                        event2Id: fp2.event._id,
                        confidence: similarity,
                        reason: `High similarity (${(similarity * 100).toFixed(1)}%)`,
                        shouldMerge: true,
                    });
                } else if (similarity >= SIMILARITY_THRESHOLDS.MEDIUM) {
                    duplicates.push({
                        event1Id: fp1.event._id,
                        event2Id: fp2.event._id,
                        confidence: similarity,
                        reason: `Medium similarity (${(similarity * 100).toFixed(1)}%)`,
                        shouldMerge: true,
                    });
                } else if (similarity >= SIMILARITY_THRESHOLDS.LOW) {
                    // Low confidence - still merge but log for review
                    duplicates.push({
                        event1Id: fp1.event._id,
                        event2Id: fp2.event._id,
                        confidence: similarity,
                        reason: `Low similarity (${(similarity * 100).toFixed(1)}%) - review recommended`,
                        shouldMerge: true,
                    });
                }
            }
        }
    });

    return duplicates;
}

// ============================================
// MERGE STRATEGY
// ============================================

/**
 * Determine which event to keep when merging duplicates
 * Priority: 1. Official source, 2. More complete data, 3. More recent scrape
 */
export function selectPrimaryEvent(
    event1: normalisedEvent,
    event2: normalisedEvent
): 'event1' | 'event2' {
    // Source priority (official sources first)
    const sourcePriority: Record<string, number> = {
        ticketmaster: 3,
        eventbrite: 2,
        artscentre: 1,
    };

    const priority1 = sourcePriority[event1.source] || 0;
    const priority2 = sourcePriority[event2.source] || 0;

    if (priority1 !== priority2) {
        return priority1 > priority2 ? 'event1' : 'event2';
    }

    // If same priority, prefer more complete data
    // (you'd expand this with actual field checks)

    return 'event1';
}

// ============================================
// UTILITY EXPORTS
// ============================================

export {
    normaliseText,
    normaliseVenue,
    tokenizeTitle,
    createFingerprint,
    calculateSimilarity,
    SIMILARITY_THRESHOLDS,
};