import stringSimilarity from "string-similarity";
import type { EventForDedup, DuplicateMatch } from "../scrapers/types";

/**
 * Deduplication Configuration
 *
 * These thresholds control how aggressively events are matched:
 * - OVERALL_THRESHOLD: Minimum weighted score to flag cross-source duplicates (0-1 scale)
 * - SAME_SOURCE_TITLE_THRESHOLD: Stricter title threshold for same-source duplicates
 * - SAME_SOURCE_VENUE_THRESHOLD: Minimum venue similarity for same-source duplicates
 * - DATE_WINDOW_DAYS: Maximum days apart for events to potentially be the same run
 * - QUICK_REJECT_THRESHOLD: Character overlap threshold for fast rejection (0-1 scale)
 */
const CONFIG = {
  TITLE_THRESHOLD: 0.75,
  OVERALL_THRESHOLD: 0.78,
  SAME_SOURCE_TITLE_THRESHOLD: 0.9,
  SAME_SOURCE_VENUE_THRESHOLD: 0.85,
  DATE_WINDOW_DAYS: 14,
  QUICK_REJECT_THRESHOLD: 0.3
};

/**
 * Source priority for determining which event data to prefer when merging.
 * Higher values indicate more reliable/complete data.
 */
const SOURCE_PRIORITY: Record<string, number> = {
  marriner: 5, // Official venue - best for dates/booking
  ticketmaster: 4, // Ticketing platform - best for prices
  whatson: 3 // Government curated - best for descriptions
};

/** Common words to ignore when normalising titles */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "at",
  "to",
  "for",
  "of",
  "in",
  "on",
  "live",
  "presents",
  "featuring",
  "feat",
  "ft",
  "show",
  "tour",
  "melbourne"
]);

/** Venue suffixes to remove during normalisation */
const VENUE_SUFFIXES =
  /\s*(melbourne|vic|victoria|cbd|australia|nsw|qld|wa|sa|tas|nt|act)$/gi;

/**
 * Caches for normalised strings to avoid repeated string operations.
 * Cleared automatically when size exceeds 10,000 entries.
 */
const normalisedTitleCache = new Map<string, string>();
const normalisedVenueCache = new Map<string, string>();

// String Normalisation

/** Normalises text by converting to lowercase, removing punctuation, and collapsing whitespace. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalises event title by removing stop words and non-significant terms.
 * Results are cached to avoid repeated normalisation.
 */
function normaliseTitle(title: string): string {
  if (normalisedTitleCache.has(title)) return normalisedTitleCache.get(title)!;

  const normalised = normalise(title)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .join(" ");

  normalisedTitleCache.set(title, normalised);
  return normalised;
}

/**
 * Normalises venue name by removing common geographic suffixes and standardising format.
 * Results are cached to avoid repeated normalisation.
 */
function normaliseVenue(venue: string): string {
  if (normalisedVenueCache.has(venue)) return normalisedVenueCache.get(venue)!;

  let normalised = normalise(venue);

  // Iteratively remove geographic suffixes
  let prev = "";
  while (normalised !== prev && normalised.length > 0) {
    prev = normalised;
    normalised = normalised.replace(VENUE_SUFFIXES, "").trim();
  }

  // Safety check: if we removed everything, fall back to original normalised text
  if (!normalised || normalised.length < 2) normalised = normalise(venue);

  normalisedVenueCache.set(venue, normalised);
  return normalised;
}

// Similarity Scoring

/** Calculates similarity between two titles (0-1 scale). */
function titleSimilarity(t1: string, t2: string): number {
  const n1 = normaliseTitle(t1);
  const n2 = normaliseTitle(t2);

  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.95;

  return stringSimilarity.compareTwoStrings(n1, n2);
}

/** Calculates similarity between two venue names (0-1 scale). */
function venueSimilarity(v1: string, v2: string): number {
  const n1 = normaliseVenue(v1);
  const n2 = normaliseVenue(v2);

  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.95;

  return stringSimilarity.compareTwoStrings(n1, n2);
}

/**
 * Calculates date overlap score between two events (0-1 scale).
 *
 * Returns:
 * - 1.0 if date ranges overlap
 * - 0.85 if within 2 weeks (same event run with slightly different dates)
 * - 0.5 if within 4 weeks (possible extended run)
 * - 0 otherwise
 */
function dateOverlap(e1: EventForDedup, e2: EventForDedup): number {
  const s1 = e1.startDate.getTime();
  const e1End = (e1.endDate || e1.startDate).getTime();
  const s2 = e2.startDate.getTime();
  const e2End = (e2.endDate || e2.startDate).getTime();

  if (s1 <= e2End && s2 <= e1End) return 1.0;

  const windowMs = CONFIG.DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const minGap = Math.min(
    Math.abs(s1 - s2),
    Math.abs(e1End - e2End),
    Math.abs(s1 - e2End),
    Math.abs(s2 - e1End)
  );

  if (minGap <= windowMs) return 0.85;
  if (minGap <= windowMs * 2) return 0.5;

  return 0;
}

/**
 * Calculates overall match score between two events.
 * Weights: Title (50%), Date (30%), Venue (20%)
 */
function matchScore(
  e1: EventForDedup,
  e2: EventForDedup
): { score: number; breakdown: string } {
  const title = titleSimilarity(e1.title, e2.title);
  const venue = venueSimilarity(e1.venue.name, e2.venue.name);
  const date = dateOverlap(e1, e2);

  const score = title * 0.5 + date * 0.3 + venue * 0.2;
  const breakdown = `t:${(title * 100).toFixed(0)} d:${(date * 100).toFixed(0)} v:${(venue * 100).toFixed(0)}`;

  return { score, breakdown };
}

// Internal Helpers

/**
 * Quick rejection filter using character overlap (Jaccard similarity on character sets).
 * Much faster than full string comparison (~10x). Returns true if events are too
 * dissimilar and should be skipped before running the full similarity check.
 */
function quickRejectCheck(t1: string, t2: string): boolean {
  const n1 = normaliseTitle(t1);
  const n2 = normaliseTitle(t2);

  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return false;

  const chars1 = new Set(n1);
  const chars2 = new Set(n2);
  const intersection = new Set([...chars1].filter((c) => chars2.has(c)));
  const union = new Set([...chars1, ...chars2]);

  return intersection.size / union.size < CONFIG.QUICK_REJECT_THRESHOLD;
}

/** Creates a bucket key from the first 3 significant words of a title. */
function getBucketKey(title: string): string {
  return normaliseTitle(title).split(" ").slice(0, 3).join(" ");
}

/** Pre-filters events with missing required fields. */
function filterValidEvents(events: (EventForDedup & { _id: string })[]) {
  return events.filter((e) => e.title && e.venue?.name && e.startDate);
}

/**
 * Performs pairwise comparisons for a list of events and appends any matches
 * above the given threshold to the results array.
 *
 * Shared by both `findDuplicates` and `findSameSourceDuplicates` to avoid repetition.
 */
function comparePairs(
  events: (EventForDedup & { _id: string })[],
  compared: Set<string>,
  results: DuplicateMatch[],
  options: {
    skipSameSource: boolean;
    titleThreshold?: number;
    venueThreshold?: number;
    scoreThreshold: number;
    reasonPrefix?: string;
  }
): void {
  const {
    skipSameSource,
    titleThreshold,
    venueThreshold,
    scoreThreshold,
    reasonPrefix = ""
  } = options;

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const e1 = events[i];
      const e2 = events[j];

      if (skipSameSource && e1.source === e2.source) continue;

      const pairKey = [e1._id, e2._id].sort().join("|");
      if (compared.has(pairKey)) continue;
      compared.add(pairKey);

      if (quickRejectCheck(e1.title, e2.title)) continue;

      // Optional early exits for stricter per-field thresholds
      if (titleThreshold) {
        const title = titleSimilarity(e1.title, e2.title);
        if (title < titleThreshold) continue;
      }

      if (venueThreshold) {
        const title = titleSimilarity(e1.title, e2.title);
        // If title is near-identical, don't block on venue for same-source matches
        if (title < 0.95) {
          const venue = venueSimilarity(e1.venue.name, e2.venue.name);
          if (venue < venueThreshold) continue;
        }
      }

      const { score, breakdown } = matchScore(e1, e2);
      if (score < scoreThreshold) continue;

      // Date must overlap for same-source matches
      if (!skipSameSource && dateOverlap(e1, e2) === 0) continue;

      const prefix = reasonPrefix ? `${reasonPrefix} ` : "";
      results.push({
        event1Id: e1._id,
        event2Id: e2._id,
        confidence: score,
        reason: `${prefix}${(score * 100).toFixed(0)}% (${breakdown})`
      });
    }
  }
}

// Public API

/**
 * Finds the best duplicate match for a given event ID from a list of duplicate pairs.
 * Returns the highest-confidence pair involving the target ID, or undefined if none.
 */
export function findBestMatch(
  targetId: string,
  duplicates: DuplicateMatch[]
): DuplicateMatch | undefined {
  return duplicates
    .filter((d) => d.event1Id === targetId || d.event2Id === targetId)
    .sort((a, b) => b.confidence - a.confidence)[0];
}

/** Returns the "other" event ID from a duplicate match pair. */
export function getMatchId(targetId: string, match: DuplicateMatch): string {
  return match.event1Id === targetId ? match.event2Id : match.event1Id;
}

/**
 * Finds duplicate events across multiple sources using optimised bucketed comparison.
 *
 * Algorithm:
 * 1. Pre-filters events with missing required data
 * 2. Groups events into buckets by title prefix (first 3 words)
 * 3. Also adds events to single-word buckets for fuzzy cross-bucket matching
 * 4. Sorts buckets by source priority for better matching order
 * 5. Compares events within each bucket, skipping same-source pairs
 * 6. Tracks compared pairs to avoid redundant comparisons across buckets
 * 7. Returns matches above threshold with confidence scores
 *
 * Note: Intentionally skips same-source comparisons.
 * Use `findSameSourceDuplicates` for those.
 *
 * Complexity: O(n + b × k²) where b = buckets, k = avg events per bucket
 */
export function findDuplicates(
  events: (EventForDedup & { _id: string })[]
): DuplicateMatch[] {
  if (normalisedTitleCache.size > 10000) {
    normalisedTitleCache.clear();
    normalisedVenueCache.clear();
  }

  const duplicates: DuplicateMatch[] = [];
  const buckets = new Map<string, (EventForDedup & { _id: string })[]>();
  const compared = new Set<string>();

  // Phase 1: Bucket events by title prefix - O(n)
  for (const event of filterValidEvents(events)) {
    const key = getBucketKey(event.title);
    if (!key) continue;

    // Primary bucket (first 3 words)
    const bucket = buckets.get(key) || [];
    bucket.push(event);
    buckets.set(key, bucket);

    // Single-word bucket for fuzzy cross-bucket matching
    const firstWord = key.split(" ")[0];
    if (firstWord && firstWord !== key) {
      const shortBucket = buckets.get(firstWord) || [];
      if (!shortBucket.includes(event)) {
        shortBucket.push(event);
        buckets.set(firstWord, shortBucket);
      }
    }
  }

  // Phase 2: Pairwise comparison within each bucket - O(b × k²)
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;

    // Sort by source priority so higher-quality sources are compared first
    bucket.sort(
      (a, b) =>
        (SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0)
    );

    comparePairs(bucket, compared, duplicates, {
      skipSameSource: true,
      scoreThreshold: CONFIG.OVERALL_THRESHOLD
    });
  }

  return duplicates;
}

/**
 * Finds duplicate events from the same source using strict matching.
 *
 * Handles cases where a scraper returns the same real-world event under multiple
 * IDs - e.g. Ticketmaster creating separate records per ticket tier or seating zone.
 * These are intentionally excluded from `findDuplicates` since cross-source merging
 * has different semantics to collapsing same-source duplicates.
 *
 * Requires: title similarity >= 0.90 AND date overlap AND venue similarity >= 0.85
 */
export function findSameSourceDuplicates(
  events: (EventForDedup & { _id: string })[]
): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  const compared = new Set<string>();

  // Group by source so we only compare within the same scraper
  const bySource = new Map<string, (EventForDedup & { _id: string })[]>();
  for (const event of filterValidEvents(events)) {
    const group = bySource.get(event.source) || [];
    group.push(event);
    bySource.set(event.source, group);
  }

  for (const sourceEvents of bySource.values()) {
    if (sourceEvents.length < 2) continue;

    comparePairs(sourceEvents, compared, duplicates, {
      skipSameSource: false,
      titleThreshold: CONFIG.SAME_SOURCE_TITLE_THRESHOLD,
      venueThreshold: CONFIG.SAME_SOURCE_VENUE_THRESHOLD,
      scoreThreshold: CONFIG.OVERALL_THRESHOLD,
      reasonPrefix: "same-source"
    });
  }

  return duplicates;
}

/**
 * Merges two duplicate events, intelligently combining data from both sources.
 *
 * Merge strategy:
 * - Category: Uses primary's category, validates and merges all subcategories
 * - Dates: Takes earliest start date and latest end date to capture full run
 * - Description: Prefers longer, non-placeholder descriptions
 * - Prices: Uses widest price range from both sources
 * - Venue: Combines most complete information
 * - Media: Takes first available image/video
 * - Accessibility: Combines unique values from both sources
 */
export function mergeEvents(
  primary: EventForDedup,
  secondary: EventForDedup
): EventForDedup {
  const category = primary.category || secondary.category || "other";

  // Merge unique subcategories from both events
  const subcategories = Array.from(
    new Set(
      [
        ...(primary.subcategories || []),
        ...(secondary.subcategories || [])
      ].filter(Boolean)
    )
  );

  // If different main categories, add secondary as a subcategory
  if (
    secondary.category &&
    secondary.category !== category &&
    secondary.category !== "other" &&
    !subcategories.includes(secondary.category)
  ) {
    subcategories.push(secondary.category);
  }

  // Earliest start, latest end to capture full event run
  const startDate =
    primary.startDate < secondary.startDate
      ? primary.startDate
      : secondary.startDate;

  const endDate = (() => {
    const e1 = primary.endDate || primary.startDate;
    const e2 = secondary.endDate || secondary.startDate;
    return e1 > e2 ? e1 : e2;
  })();

  // Prefer longer, non-placeholder descriptions
  const description = (() => {
    const p = primary.description || "";
    const s = secondary.description || "";
    if (p.includes("No description")) return s || p;
    if (s.includes("No description")) return p || s;
    return p.length > s.length ? p : s;
  })();

  // Widest price range across both sources
  const allPrices = [
    primary.priceMin,
    primary.priceMax,
    secondary.priceMin,
    secondary.priceMax
  ].filter((p): p is number => p !== undefined && p !== null);

  const priceMin = allPrices.length > 0 ? Math.min(...allPrices) : undefined;
  const priceMax = allPrices.length > 0 ? Math.max(...allPrices) : undefined;

  // Merge price details, avoiding duplication
  const priceDetails = (() => {
    const details = [primary.priceDetails, secondary.priceDetails]
      .filter(Boolean)
      .map((d) => d!.trim());

    if (details.length === 0) return undefined;
    if (details.length === 1) return details[0];
    if (details[0].includes(details[1])) return details[0];
    if (details[1].includes(details[0])) return details[1];

    const uniqueDetails = Array.from(
      new Set(
        details
          .flatMap((d) => d.split(/\s*\|\s*/))
          .map((d) => d.trim())
          .filter(Boolean)
      )
    );

    return uniqueDetails.join(" | ");
  })();

  // Most complete venue information
  const venue = {
    name:
      primary.venue.name.length > secondary.venue.name.length
        ? primary.venue.name
        : secondary.venue.name,
    address: primary.venue.address.includes("TBA")
      ? secondary.venue.address
      : primary.venue.address,
    suburb: primary.venue.suburb || secondary.venue.suburb || "Melbourne"
  };

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
    priceDetails,
    imageUrl: primary.imageUrl || secondary.imageUrl,
    videoUrl: primary.videoUrl || secondary.videoUrl,
    accessibility: Array.from(
      new Set([
        ...(primary.accessibility || []),
        ...(secondary.accessibility || [])
      ])
    ),
    ageRestriction: primary.ageRestriction || secondary.ageRestriction,
    duration: primary.duration || secondary.duration,
    isFree: primary.isFree || secondary.isFree || false,
    bookingUrl: primary.bookingUrl || secondary.bookingUrl || ""
  };
}

export {
  normaliseTitle,
  normaliseVenue,
  matchScore,
  titleSimilarity,
  venueSimilarity,
  dateOverlap,
  CONFIG,
  type EventForDedup
};
