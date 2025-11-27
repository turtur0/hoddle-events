// ============================================
// POPULARITY SERVICE
// ============================================
export {
    calculateRawPopularityScore,
    updateCategoryPopularityPercentiles,
    getPopularEventsInCategory,
    getHiddenGems,
    getColdStartPopularityScore,
    compareToCategory,
} from './popularityService';

// ============================================
// RECOMMENDATION SERVICE
// ============================================
export {
    getTrendingEvents,
    getRisingStars,
    getUndiscoveredGems,
    getSimilarEvents,
    getPersonalizedRecommendations,
} from './recommendationService';

// ============================================
// USER PROFILE SERVICE
// ============================================
export {
    buildUserVectorFromInteractions,
    buildUserVectorFromPreferences,
    computeUserProfile,
    scoreEventForUser,
    getPersonalizedRecommendations as getPersonalizedRecommendationsDetailed,
    getSimilarEvents as getSimilarEventsDetailed,
    updateStoredUserProfile,
} from './userProfileService';

export type {
    UserProfile,
    ScoredEvent,
} from './userProfileService';

// ============================================
// VECTOR SERVICE
// ============================================
export {
    extractEventFeatures,
    cosineSimilarity,
    euclideanDistance,
    getCategoryPopularityPercentile,
    normaliseVector,
    FEATURE_WEIGHTS,
} from './vectorService';

export type {
    EventVector,
} from './vectorService';

// ============================================
// DEFAULT EXPORT (Main ML Service Interface)
// ============================================
import * as popularityService from './popularityService';
import * as recommendationService from './recommendationService';
import * as userProfileService from './userProfileService';
import * as vectorService from './vectorService';

export default {
    // Popularity
    calculateRawPopularityScore: popularityService.calculateRawPopularityScore,
    updateCategoryPopularityPercentiles: popularityService.updateCategoryPopularityPercentiles,
    getPopularEventsInCategory: popularityService.getPopularEventsInCategory,
    getHiddenGems: popularityService.getHiddenGems,
    getColdStartPopularityScore: popularityService.getColdStartPopularityScore,
    compareToCategory: popularityService.compareToCategory,

    // Recommendations
    getTrendingEvents: recommendationService.getTrendingEvents,
    getRisingStars: recommendationService.getRisingStars,
    getUndiscoveredGems: recommendationService.getUndiscoveredGems,
    getSimilarEvents: recommendationService.getSimilarEvents,
    getPersonalizedRecommendations: recommendationService.getPersonalizedRecommendations,

    // User Profile
    computeUserProfile: userProfileService.computeUserProfile,
    scoreEventForUser: userProfileService.scoreEventForUser,
    updateStoredUserProfile: userProfileService.updateStoredUserProfile,

    // Vector Operations
    extractEventFeatures: vectorService.extractEventFeatures,
    cosineSimilarity: vectorService.cosineSimilarity,
    euclideanDistance: vectorService.euclideanDistance,
} as const;