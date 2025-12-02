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
} from './popularity-service';

// ============================================
// RECOMMENDATION SERVICE
// ============================================
export {
    getTrendingEvents,
    getUndiscoveredGems,
    getSimilarEvents,
} from './recommendation-service';

// ============================================
// USER PROFILE SERVICE
// ============================================
export {
    buildUserVectorFromInteractions,
    buildUserVectorFromPreferences,
    computeUserProfile,
    scoreEventForUser,
    getPersonalisedRecommendations,
    getSimilarEvents as getSimilarEventsDetailed,
    updateStoredUserProfile,
} from './user-profile-service';

export type {
    UserProfile,
    ScoredEvent,
} from './user-profile-service';

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
} from './vector-service';

export type {
    EventVector,
} from './vector-service';

// ============================================
// DEFAULT EXPORT (Main ML Service Interface)
// ============================================
import * as popularityService from './popularity-service';
import * as recommendationService from './recommendation-service';
import * as userProfileService from './user-profile-service';
import * as vectorService from './vector-service';

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
    getUndiscoveredGems: recommendationService.getUndiscoveredGems,
    getSimilarEvents: recommendationService.getSimilarEvents,

    // User Profile
    computeUserProfile: userProfileService.computeUserProfile,
    scoreEventForUser: userProfileService.scoreEventForUser,
    updateStoredUserProfile: userProfileService.updateStoredUserProfile,

    // Vector Operations
    extractEventFeatures: vectorService.extractEventFeatures,
    cosineSimilarity: vectorService.cosineSimilarity,
    euclideanDistance: vectorService.euclideanDistance,
} as const;