import mongoose from 'mongoose';
import { IEvent, IUser, IUserInteraction } from '@/lib/models';

/**
 * Shared test data factory for consistent mock creation across all tests
 */

export const createMockEvent = (overrides: Partial<IEvent> = {}): IEvent => ({
    _id: new mongoose.Types.ObjectId(),
    title: 'Test Event',
    description: 'Test description',
    category: 'music',
    subcategories: ['rock'],
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    venue: {
        name: 'Test Venue',
        address: 'Test Address',
        suburb: 'Melbourne',
    },
    priceMin: 50,
    isFree: false,
    bookingUrl: 'https://example.com',
    sources: ['ticketmaster'],
    primarySource: 'ticketmaster',
    sourceIds: { ticketmaster: 'test-123' },
    scrapedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    lastUpdated: new Date(),
    isArchived: false,
    stats: {
        viewCount: 10,
        favouriteCount: 5,
        clickthroughCount: 3,
        categoryPopularityPercentile: 0.7,
        rawPopularityScore: 7,
    },
    ...overrides,
});

/**
 * Shared factory for creating mock users
 */
export const createMockUser = (overrides: Partial<IUser> = {}): IUser => ({
    email: 'test@example.com',
    name: 'Test User',
    favorites: [],
    preferences: {
        selectedCategories: ['music'],
        selectedSubcategories: ['rock', 'indie'],
        categoryWeights: { music: 1.0, sports: 0.5 },
        priceRange: { min: 0, max: 200 },
        popularityPreference: 0.5,
        locations: ['Melbourne'],
        notifications: {
            inApp: true,
            email: false,
            emailFrequency: 'weekly',
            keywords: [],
            smartFiltering: {
                enabled: true,
                minRecommendationScore: 0.6,
            },
            includeFavouriteUpdates: false,
            recommendationsSize: 'minimal'
        },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

/**
 * Shared factory for creating mock interactions
 */
export const createMockInteraction = (
    eventId: mongoose.Types.ObjectId,
    type: 'view' | 'favourite' | 'unfavourite' | 'clickthrough',
    daysAgo: number,
    event: IEvent
): IUserInteraction & { eventId: IEvent } => ({
    userId: new mongoose.Types.ObjectId(),
    eventId: event,
    interactionType: type,
    source: 'homepage',
    timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
} as any);


export const createMockQueryChain = (resolvedValue: any) => {
    return {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(resolvedValue),
        select: jest.fn().mockReturnThis(),
    };
};