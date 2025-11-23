// lib/ml/vectorService.ts
import { IEvent } from '@/lib/models/Event';
import { CATEGORIES } from '../categories';

// ============================================
// CONFIGURATION
// ============================================

// Main category mapping
const MAIN_CATEGORIES = CATEGORIES.map(cat => cat.value);
// ['music', 'theatre', 'sports', 'arts', 'family', 'other']

// All possible subcategories (flattened)
const ALL_SUBCATEGORIES = CATEGORIES.flatMap(cat =>
  (cat.subcategories || []).map(sub => `${cat.value}:${sub}`)
);

// Venue tier classification
const VENUE_TIERS: Record<string, number> = {
  // Stadiums & Major Venues (1.0 = mainstream)
  'Marvel Stadium': 1.0,
  'Rod Laver Arena': 1.0,
  'Melbourne Cricket Ground': 1.0,
  'MCG': 1.0,
  'AAMI Park': 0.95,

  // Large Theatres & Concert Halls (0.7-0.9)
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

  // Mid-Size Venues (0.5-0.7)
  'The Tivoli': 0.65,
  'Margaret Court Arena': 0.65,
  'John Cain Arena': 0.65,
  'Plenary': 0.6,
  'The Athenaeum Theatre': 0.6,
  'Malthouse Theatre': 0.55,
  'Melbourne Theatre Company': 0.55,

  // Small Venues & Clubs (0.3-0.5)
  'Northcote Social Club': 0.4,
  'The Corner Hotel': 0.4,
  'Cherry Bar': 0.35,
  'The Tote': 0.35,
  '170 Russell': 0.4,
  'Max Watts': 0.45,

  // Community & Alternative Spaces (0.2-0.3)
  'The Owl Sanctuary': 0.25,
  'Brunswick Ballroom': 0.3,
};

// Price percentiles
const PRICE_PERCENTILES = {
  p10: 0,
  p25: 35,
  p50: 85,
  p75: 150,
  p90: 250,
  max: 500,
};

// ============================================
// FEATURE WEIGHTS
// ============================================
// These weights control how much each feature type influences similarity

export const FEATURE_WEIGHTS = {
  category: 10.0,        // Most important - category match is critical
  subcategory: 5.0,      // Second most important - subcategory refinement
  popularity: 3.0,       // Third - mainstream vs niche preference
  price: 1.0,            // Less important - just for context
  venue: 1.0,            // Less important - just for context
};

// ============================================
// VECTOR INTERFACE
// ============================================

export interface EventVector {
  eventId: string;

  // Category features (one-hot encoded)
  categoryVector: number[];  // 6 dimensions, weighted by FEATURE_WEIGHTS.category

  // Subcategory features (multi-hot encoded)
  subcategoryVector: number[];  // ~40 dimensions, weighted by FEATURE_WEIGHTS.subcategory

  // Numerical features (normalise 0-1)
  priceNormalised: number;      // weighted by FEATURE_WEIGHTS.price
  venueTier: number;            // weighted by FEATURE_WEIGHTS.venue
  popularityScore: number;      // weighted by FEATURE_WEIGHTS.popularity

  // Metadata
  isFree: boolean;

  // Combined weighted feature vector (for similarity calculations)
  fullVector: number[];
}

// ============================================
// MAIN FEATURE EXTRACTION
// ============================================

/**
 * Convert an event into a weighted numerical vector representation
 * Features are weighted by importance: category > subcategory > popularity > price/venue
 */
export function extractEventFeatures(event: IEvent): EventVector {
  // 1. One-hot encode main category (WEIGHTED)
  const categoryVector = MAIN_CATEGORIES.map(cat =>
    cat === event.category.toLowerCase() ? FEATURE_WEIGHTS.category : 0
  );

  // 2. Multi-hot encode subcategories (WEIGHTED)
  const subcategoryVector = createWeightedSubcategoryVector(event);

  // 3. Normalize price using log scale (WEIGHTED)
  const priceNormalised = normalisePriceLog(event) * FEATURE_WEIGHTS.price;

  // 4. Get venue tier with intelligent fallback (WEIGHTED)
  const venueTier = getVenueTierWithFallback(event.venue.name, event) * FEATURE_WEIGHTS.venue;

  // 5. Popularity score from engagement stats (WEIGHTED)
  const popularityScore = calculatePopularityScore(event) * FEATURE_WEIGHTS.popularity;

  // 6. Combine everything into weighted full feature vector
  const fullVector = [
    ...categoryVector,        // 6 dimensions (heavily weighted)
    ...subcategoryVector,     // ~40 dimensions (moderately weighted)
    priceNormalised,          // 1 dimension (lightly weighted)
    venueTier,                // 1 dimension (lightly weighted)
    popularityScore,          // 1 dimension (moderately weighted)
  ];

  return {
    eventId: event._id.toString(),
    categoryVector,
    subcategoryVector,
    priceNormalised: priceNormalised / FEATURE_WEIGHTS.price, // Store unweighted for inspection
    venueTier: venueTier / FEATURE_WEIGHTS.venue,
    popularityScore: popularityScore / FEATURE_WEIGHTS.popularity,
    isFree: event.isFree,
    fullVector,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create weighted multi-hot encoded vector for subcategories
 */
function createWeightedSubcategoryVector(event: IEvent): number[] {
  return ALL_SUBCATEGORIES.map(fullSubcat => {
    const [category, subcat] = fullSubcat.split(':');

    // Only encode subcategories for this event's category
    if (category !== event.category.toLowerCase()) {
      return 0;
    }

    // Check if this subcategory is active for this event
    const isActive = event.subcategories?.includes(subcat) ? 1 : 0;
    return isActive * FEATURE_WEIGHTS.subcategory;
  });
}

/**
 * Normalize price using log scale
 */
function normalisePriceLog(event: IEvent): number {
  if (event.isFree || !event.priceMin) {
    return 0;
  }

  const logPrice = Math.log10(event.priceMin + 1);
  const logMax = Math.log10(PRICE_PERCENTILES.max + 1);

  return Math.min(logPrice / logMax, 1);
}

/**
 * Get venue tier with intelligent fallback
 */
function getVenueTierWithFallback(venueName: string, event: IEvent): number {
  // Check if venue is in our predefined list
  const knownTier = VENUE_TIERS[venueName];
  if (knownTier !== undefined) {
    return knownTier;
  }

  // FALLBACK HEURISTICS
  const nameLower = venueName.toLowerCase();

  // Major venue keywords
  if (nameLower.includes('stadium') || nameLower.includes('arena') ||
    nameLower.includes('ground') || nameLower.includes('park')) {
    return 0.9;
  }

  // Theatre/hall keywords
  if (nameLower.includes('theatre') || nameLower.includes('hall') ||
    nameLower.includes('auditorium') || nameLower.includes('playhouse')) {
    return 0.7;
  }

  // Club/bar keywords
  if (nameLower.includes('club') || nameLower.includes('bar') ||
    nameLower.includes('hotel') || nameLower.includes('pub')) {
    return 0.4;
  }

  // Gallery/community spaces
  if (nameLower.includes('gallery') || nameLower.includes('studio') ||
    nameLower.includes('space') || nameLower.includes('centre')) {
    return 0.5;
  }

  // Use price as a proxy
  if (event.priceMin && event.priceMin > 200) return 0.85;
  if (event.priceMin && event.priceMin > 100) return 0.7;
  if (event.isFree) return 0.3;

  // Use source as a signal
  if (event.primarySource === 'ticketmaster') return 0.65;
  if (event.primarySource === 'marriner') return 0.75;

  return 0.5; // Default mid-tier
}

/**
 * Calculate popularity score from engagement stats
 * Higher score = more mainstream/popular
 */
export default function calculatePopularityScore(event: IEvent): number {
  // Prefer category-relative percentile if available
  if (event.stats?.categoryPopularityPercentile !== undefined) {
    return event.stats.categoryPopularityPercentile;
  }

  // Fallback: Raw calculation (for new events before first popularity update)
  const { viewCount = 0, favouriteCount = 0, clickthroughCount = 0 } = event.stats || {};

  // Weighted sum: favorites matter most
  const rawScore = (
    viewCount * 0.1 +
    favouriteCount * 5 +
    clickthroughCount * 2
  );

  // Sigmoid function to keep between 0-1
  const scale = 0.01;
  return 1 / (1 + Math.exp(-rawScore * scale));
}

// ============================================
// SIMILARITY CALCULATIONS
// ============================================

/**
 * Calculate cosine similarity between two vectors
 * Returns value between 0 (completely different) and 1 (identical)
 * 
 * Note: Vectors are already weighted, so this directly reflects
 * the importance of category > subcategory > popularity > others
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

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate Euclidean distance between two vectors
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
 * Normalize a vector to unit length
 */
export function normaliseVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map(val => val / magnitude);
}