// src/app/api/events/archived/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { FilterQuery } from 'mongoose';
import { Event, type IEvent } from '@/lib/models';

const EVENTS_PER_PAGE = 18;

type SortOption = 'date-recent' | 'date-old' | 'popular' | 'recently-archived';

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const searchQuery = searchParams.get('q') || '';
        const sortOption = (searchParams.get('sort') as SortOption) || 'date-recent';

        const matchConditions = buildMatchConditions(searchParams);

        // Handle search
        if (searchQuery.trim()) {
            return await fetchSearchResults(matchConditions, searchQuery, page, sortOption);
        }

        // Handle standard queries
        return await fetchArchivedEvents(matchConditions, page, sortOption);
    } catch (error) {
        console.error('Archived events API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch archived events' },
            { status: 500 }
        );
    }
}

function buildMatchConditions(searchParams: URLSearchParams): FilterQuery<IEvent> {
    const matchConditions: FilterQuery<IEvent> = {
        isArchived: true, // Only archived events
    };

    // Category filter
    const category = searchParams.get('category');
    if (category && category !== 'all') {
        matchConditions.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    // Subcategory filter
    const subcategory = searchParams.get('subcategory');
    if (subcategory && subcategory !== 'all') {
        matchConditions.subcategories = {
            $elemMatch: { $regex: new RegExp(`^${subcategory}$`, 'i') },
        };
    }

    // Price filters
    const freeOnly = searchParams.get('free') === 'true';
    if (freeOnly) {
        matchConditions.isFree = true;
    }

    return matchConditions;
}

function getSortConfig(sortOption: SortOption): Record<string, 1 | -1> {
    const configs: Record<SortOption, Record<string, 1 | -1>> = {
        'date-recent': { startDate: -1 },
        'date-old': { startDate: 1 },
        popular: { 'stats.categoryPopularityPercentile': -1, startDate: -1 },
        'recently-archived': { archivedAt: -1, startDate: -1 },
    };

    return configs[sortOption] || configs['date-recent'];
}

async function fetchArchivedEvents(
    matchConditions: FilterQuery<IEvent>,
    page: number,
    sortOption: SortOption
) {
    const skip = (page - 1) * EVENTS_PER_PAGE;
    const sortConfig = getSortConfig(sortOption);

    const [events, totalEvents] = await Promise.all([
        Event.find(matchConditions)
            .sort(sortConfig)
            .skip(skip)
            .limit(EVENTS_PER_PAGE)
            .lean(),
        Event.countDocuments(matchConditions),
    ]);

    return NextResponse.json({
        events: events.map(serialiseEvent),
        pagination: buildPagination(page, totalEvents),
    });
}

async function fetchSearchResults(
    matchConditions: FilterQuery<IEvent>,
    searchQuery: string,
    page: number,
    sortOption: SortOption
) {
    const skip = (page - 1) * EVENTS_PER_PAGE;
    const escapedQuery = searchQuery.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const searchConditions: FilterQuery<IEvent> = {
        ...matchConditions,
        $or: [
            { title: { $regex: escapedQuery, $options: 'i' } },
            { description: { $regex: escapedQuery, $options: 'i' } },
            { 'venue.name': { $regex: escapedQuery, $options: 'i' } },
            { category: { $regex: escapedQuery, $options: 'i' } },
            { subcategories: { $elemMatch: { $regex: escapedQuery, $options: 'i' } } },
        ],
    };

    const sortConfig = getSortConfig(sortOption);

    const [events, totalEvents] = await Promise.all([
        Event.find(searchConditions)
            .sort(sortConfig)
            .skip(skip)
            .limit(EVENTS_PER_PAGE)
            .lean(),
        Event.countDocuments(searchConditions),
    ]);

    return NextResponse.json({
        events: events.map(serialiseEvent),
        pagination: buildPagination(page, totalEvents),
    });
}

function serialiseEvent(event: any) {
    return {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        category: event.category,
        subcategories: event.subcategories || [],
        startDate: event.startDate instanceof Date
            ? event.startDate.toISOString()
            : new Date(event.startDate).toISOString(),
        endDate: event.endDate
            ? (event.endDate instanceof Date
                ? event.endDate.toISOString()
                : new Date(event.endDate).toISOString())
            : undefined,
        venue: event.venue,
        priceMin: event.priceMin,
        priceMax: event.priceMax,
        isFree: event.isFree,
        bookingUrl: event.bookingUrl,
        bookingUrls: event.bookingUrls,
        imageUrl: event.imageUrl,
        accessibility: event.accessibility || [],
        duration: event.duration,
        ageRestriction: event.ageRestriction,
        sources: event.sources || [],
        primarySource: event.primarySource,
        scrapedAt: event.scrapedAt instanceof Date
            ? event.scrapedAt.toISOString()
            : new Date(event.scrapedAt).toISOString(),
        lastUpdated: event.lastUpdated instanceof Date
            ? event.lastUpdated.toISOString()
            : new Date(event.lastUpdated).toISOString(),
        archivedAt: event.archivedAt instanceof Date
            ? event.archivedAt.toISOString()
            : new Date(event.archivedAt).toISOString(),
        isArchived: true,
        stats: event.stats,
    };
}

function buildPagination(page: number, totalEvents: number) {
    const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

    return {
        currentPage: page,
        totalPages,
        totalEvents,
        hasMore: page < totalPages,
    };
}