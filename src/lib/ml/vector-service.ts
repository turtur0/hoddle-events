import { CATEGORIES } from '../constants/categories';
import { type IEvent } from '@/lib/models';

// ============================================
// CONFIGURATION
// ============================================

const MAIN_CATEGORIES = CATEGORIES.map(cat => cat.value);

// Create a normalised subcategory lookup map
// Maps "category:normalised-subcategory" -> original subcategory for encoding
const SUBCATEGORY_MAP = new Map<string, string>();
const ALL_SUBCATEGORY_KEYS: string[] = [];

CATEGORIES.forEach(cat => {
  (cat.subcategories || []).forEach(sub => {
    const key = `${cat.value}:${sub.toLowerCase()}`;
    SUBCATEGORY_MAP.set(key, sub);
    ALL_SUBCATEGORY_KEYS.push(key);
  });
});

/** Venue tier classification (0.0 = niche, 1.0 = mainstream) */
const VENUE_TIERS: Record<string, number> = {
  'Marvel Stadium': 1.0,
  'Rod Laver Arena': 1.0,
  'Melbourne Cricket Ground': 1.0,
  'MCG': 1.0,
  'AAMI Park': 0.95,
  'Arts Centre Melbourne': 0.85,
  'Hamer Hall': 0.85,
  'State Theatre': 0.85,
  'Princess Theatre': 0.8,
  'Regent Theatre': 0.8,
  'Forum Melbourne': 0.8,
  'Comedy Theatre': 0.75,
  'Sidney Myer Music Bowl': 0.75,
  'Melbourne Recital Centre': 0.7,
  'Palais Theatre': 0.7,
  'The Tivoli': 0.65,
  'Margaret Court Arena': 0.65,
  'John Cain Arena': 0.65,
  'Plenary': 0.6,
  'The Athenaeum Theatre': 0.6,
  'Malthouse Theatre': 0.55,
  'Melbourne Theatre Company': 0.55,
  'Northcote Social Club': 0.4,
  'The Corner Hotel': 0.4,
  'Cherry Bar': 0.35,
  'The Tote': 0.35,
  '170 Russell': 0.4,
  'Max Watts': 0.45,
  'The Owl Sanctuary': 0.25,
  'Brunswick Ballroom': 0.3,
};

const PRICE_PERCENTILES = {
  p10: 0,
  p25: 35,
  p50: 85,
  p75: 150,
  p90: 250,
  max: 500,
} as const;

/**
 * Feature weights control similarity calculation importance
 * Higher weight = more influence on similarity score
 * 
 * Priority: category > subcategory > popularity > price/venue
 */
export const FEATURE_WEIGHTS = {
  category: 10.0,     // Critical: category must match
  subcategory: 5.0,   // Important: subcategory refinement
  popularity: 3.0,    // Moderate: mainstream vs niche
  price: 1.0,         // Minor: contextual only
  venue: 1.0,         // Minor: contextual only
} as const;

// ============================================
// TYPES
// ============================================

/**
 * Event represented as a weighted numerical vector
 * All features are normalised and weighted for similarity calculations
 */
export interface EventVector {
  eventId: string;
  categoryVector: number[];      // One-hot encoded (6 dims)
  subcategoryVector: number[];   // Multi-hot encoded (~40 dims)
  priceNormalised: number;       // Log-scaled (1 dim)
  venueTier: number;             // Mainstream score (1 dim)
  popularityScore: number;       // Engagement-based (1 dim)
  isFree: boolean;
  fullVector: number[];          // All features combined
}

// ============================================
// MAIN FEATURE EXTRACTION
// ============================================

/**
 * Convert event into weighted numerical vector for similarity calculations
 * 
 * Vector structure (total ~49 dimensions):
 * - Category: 6 dims (one-hot, heavily weighted)
 * - Subcategories: ~40 dims (multi-hot, moderately weighted)
 * - Price: 1 dim (log-scaled, lightly weighted)
 * - Venue: 1 dim (tier score, lightly weighted)
 * - Popularity: 1 dim (percentile, moderately weighted)
 * 
 * @param event - Event to vectorise
 * @returns EventVector with weighted features
 */
export function extractEventFeatures(event: IEvent): EventVector {
  const eventCategory = event.category.toLowerCase();
  const eventSubcategories = (event.subcategories || []).map(sub => sub.toLowerCase());

  // 1. Category (one-hot, weighted)
  const categoryVector = MAIN_CATEGORIES.map(cat =>
    cat === eventCategory ? FEATURE_WEIGHTS.category : 0
  );

  // 2. Subcategories (multi-hot, weighted)
  const subcategoryVector = ALL_SUBCATEGORY_KEYS.map(key => {
    const [category, normalisedSubcat] = key.split(':');

    if (category !== eventCategory) return 0;

    const isActive = eventSubcategories.some(eventSub => {
      // Direct match
      if (eventSub === normalisedSubcat) return true;

      // Match against original subcategory name (lowercase)
      const originalSubcat = SUBCATEGORY_MAP.get(key)?.toLowerCase();
      if (eventSub === originalSubcat) return true;

      // Match first word (e.g., "rock" matches "rock & alternative")
      const firstWord = normalisedSubcat.split(/[\s&]+/)[0];
      if (eventSub === firstWord) return true;

      return false;
    });

    return isActive ? FEATURE_WEIGHTS.subcategory : 0;
  });

  // 3. Price (log-scaled, weighted)
  const priceNormalised = normalisePriceLog(event);
  const priceWeighted = priceNormalised * FEATURE_WEIGHTS.price;

  // 4. Venue tier (weighted)
  const venueTier = getVenueTierWithFallback(event.venue.name, event);
  const venueTierWeighted = venueTier * FEATURE_WEIGHTS.venue;

  // 5. Popularity (weighted)
  const popularityRaw = calculatePopularityScore(event);
  const popularityScore = popularityRaw * FEATURE_WEIGHTS.popularity;

  // Combine into full vector
  const fullVector = [
    ...categoryVector,
    ...subcategoryVector,
    priceWeighted,
    venueTierWeighted,
    popularityScore,
  ];

  return {
    eventId: event._id.toString(),
    categoryVector,
    subcategoryVector,
    priceNormalised,
    venueTier,
    popularityScore,
    isFree: event.isFree,
    fullVector,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalise price using log scale to compress range
 * Free events = 0, expensive events approach 1
 */
function normalisePriceLog(event: IEvent): number {
  if (event.isFree || !event.priceMin) return 0;

  const logPrice = Math.log10(event.priceMin + 1);
  const logMax = Math.log10(PRICE_PERCENTILES.max + 1);

  return Math.min(logPrice / logMax, 1);
}

/**
 * Get venue tier with intelligent fallback
 * Uses predefined tiers, then heuristics, then price/source signals
 */
function getVenueTierWithFallback(venueName: string, event: IEvent): number {
  // Check predefined tiers
  const knownTier = VENUE_TIERS[venueName];
  if (knownTier !== undefined) return knownTier;

  // Fallback heuristics
  const name = venueName.toLowerCase();

  if (name.includes('stadium') || name.includes('arena') ||
    name.includes('ground') || name.includes('park')) return 0.9;

  if (name.includes('theatre') || name.includes('hall') ||
    name.includes('auditorium') || name.includes('playhouse')) return 0.7;

  if (name.includes('club') || name.includes('bar') ||
    name.includes('hotel') || name.includes('pub')) return 0.4;

  if (name.includes('gallery') || name.includes('studio') ||
    name.includes('space') || name.includes('centre')) return 0.5;

  // Price-based proxy
  if (event.priceMin) {
    if (event.priceMin > 200) return 0.85;
    if (event.priceMin > 100) return 0.7;
  }
  if (event.isFree) return 0.3;

  // Source-based proxy
  if (event.primarySource === 'ticketmaster') return 0.65;
  if (event.primarySource === 'marriner') return 0.75;

  return 0.5; // Default mid-tier
}

/**
 * Calculate popularity score from engagement stats
 * Prefers stored category percentile, falls back to raw calculation
 * 
 * @returns Popularity score between 0 (niche) and 1 (mainstream)
 */
function calculatePopularityScore(event: IEvent): number {
  // Use precomputed percentile if available
  if (event.stats?.categoryPopularityPercentile !== undefined) {
    return event.stats.categoryPopularityPercentile;
  }

  // Fallback: raw calculation for new events
  const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};
  const rawScore = viewCount * 0.1 + favouriteCount * 5 + clickthroughCount * 2;

  // Sigmoid to normalise to 0-1
  const scale = 0.01;
  return 1 / (1 + Math.exp(-rawScore * scale));
}

// ============================================
// SIMILARITY CALCULATIONS
// ============================================

/**
 * Calculate cosine similarity between two vectors
 * 
 * Measures angle between vectors (ignores magnitude)
 * Returns 0 (completely different) to 1 (identical)
 * 
 * Note: Vectors are pre-weighted, so similarity directly reflects
 * feature importance (category > subcategory > popularity > others)
 * 
 * @param vectorA - First vector
 * @param vectorB - Second vector
 * @returns Similarity score [0, 1]
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vector length mismatch: ${vectorA.length} vs ${vectorB.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate Euclidean distance between two vectors
 * Measures straight-line distance in vector space
 */
export function euclideanDistance(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vector length mismatch: ${vectorA.length} vs ${vectorB.length}`);
  }

  let sumSquaredDiff = 0;
  for (let i = 0; i < vectorA.length; i++) {
    const diff = vectorA[i] - vectorB[i];
    sumSquaredDiff += diff * diff;
  }

  return Math.sqrt(sumSquaredDiff);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get category-relative popularity percentile
 * Computes event's rank within its category
 */
export async function getCategoryPopularityPercentile(
  event: IEvent,
  categoryEvents: IEvent[]
): Promise<number> {
  const eventScore = calculatePopularityScore(event);
  const scores = categoryEvents.map(e => calculatePopularityScore(e)).sort((a, b) => a - b);

  const rank = scores.filter(s => s < eventScore).length;
  return rank / Math.max(scores.length - 1, 1);
}

/**
 * Normalise vector to unit length (L2 normalisation)
 * Useful for cosine similarity calculations
 */
export function normaliseVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(val => val / magnitude);
}

export default calculatePopularityScore;