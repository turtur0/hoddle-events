/**
 * Canonical event response type - the ONLY shape components should know about.
 * This is your API contract.
 */
export interface EventResponse {
    id: string;
    title: string;
    description: string;
    category: string;
    subcategories: string[];

    schedule: {
        start: string;
        end: string | null;
    };

    venue: {
        name: string;
        location: string;
        capacity?: number;
        tier?: number;
    };

    pricing: {
        min?: number;
        max?: number;
        isFree: boolean;
    };

    booking: {
        url: string;
        source: string;
    };

    media: {
        imageUrl: string | null;
    };

    engagement: {
        views: number;
        favourites: number;
        clicks: number;
    };

    // Additional optional fields
    duration?: string;
    ageRestriction?: string;
    accessibility?: string[];
    sources?: string[];
}

export interface RecommendationResponse extends EventResponse {
    recommendation: {
        score: number;
        reason: string;
    };
}

export function transformEvent(event: any): EventResponse {
    // Safe date conversion
    const toISOString = (date: any): string => {
        if (!date) return new Date().toISOString();
        if (date instanceof Date) return date.toISOString();
        return new Date(date).toISOString();
    };

    return {
        id: event._id?.toString() || event.id?.toString(),
        title: event.title || 'Untitled Event',
        description: event.description || '',
        category: event.category || 'other',
        subcategories: event.subcategories || [],

        schedule: {
            start: toISOString(event.startDate),
            end: event.endDate ? toISOString(event.endDate) : null,
        },

        venue: {
            name: event.venue?.name || 'TBA',
            location: event.venue?.location || event.venue?.suburb || 'Melbourne',
            capacity: event.venue?.capacity,
            tier: event.venue?.tier,
        },

        pricing: {
            min: event.priceMin,
            max: event.priceMax,
            isFree: event.isFree || false,
        },

        booking: {
            url: event.bookingUrl || '',
            source: event.primarySource || 'website',
        },

        media: {
            imageUrl: event.imageUrl || null,
        },

        engagement: {
            views: event.stats?.viewCount || 0,
            favourites: event.stats?.favouriteCount || 0,
            clicks: event.stats?.clickthroughCount || 0,
        },

        // Optional fields
        duration: event.duration,
        ageRestriction: event.ageRestriction,
        accessibility: event.accessibility || [],
        sources: event.sources || [],
    };
}

/**
 * Transform event with recommendation metadata
 */
export function transformRecommendation(
    event: any,
    score: number,
    reason: string
): RecommendationResponse {
    return {
        ...transformEvent(event),
        recommendation: {
            score,
            reason,
        },
    };
}
