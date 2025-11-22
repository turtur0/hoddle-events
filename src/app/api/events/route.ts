import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Event, { IEvent } from '@/lib/models/Event';
import { Types, FilterQuery } from 'mongoose';

const EVENTS_PER_PAGE = 18;

interface AggregatedEvent extends IEvent {
  _id: Types.ObjectId;
  relevanceScore?: number;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const searchQuery = searchParams.get('q') || '';

    // Filter parameters
    const category = searchParams.get('category') || '';
    const subcategory = searchParams.get('subcategory') || '';
    const dateFilter = searchParams.get('date') || '';
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const freeOnly = searchParams.get('free') === 'true';
    const accessibleOnly = searchParams.get('accessible') === 'true';

    const skip = (page - 1) * EVENTS_PER_PAGE;

    // Build base match conditions
    const matchConditions: FilterQuery<IEvent> = {
      startDate: { $gte: new Date() }
    };

    // Category filter (case-insensitive)
    if (category) {
      matchConditions.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    // Subcategory filter - check subcategories array
    if (subcategory) {
      const subcatRegex = new RegExp(`^${subcategory}$`, 'i');
      matchConditions.subcategories = { $elemMatch: { $regex: subcatRegex } };
    }

    // Date range filter
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateFilter) {
        case 'today': {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          matchConditions.startDate = { $gte: today, $lt: tomorrow };
          break;
        }
        case 'this-week': {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          matchConditions.startDate = { $gte: today, $lt: weekEnd };
          break;
        }
        case 'this-month': {
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          matchConditions.startDate = { $gte: today, $lt: monthEnd };
          break;
        }
        case 'next-month': {
          const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
          matchConditions.startDate = { $gte: nextMonthStart, $lt: nextMonthEnd };
          break;
        }
      }
    }

    // Price filters
    if (freeOnly) {
      matchConditions.isFree = true;
    } else {
      if (priceMin) {
        matchConditions.priceMin = { $gte: parseInt(priceMin) };
      }
      if (priceMax) {
        matchConditions.priceMax = { $lte: parseInt(priceMax) };
      }
    }

    // FIXED: Accessibility filter
    if (accessibleOnly) {
      matchConditions.$and = matchConditions.$and || [];
      matchConditions.$and.push({
        accessibility: { 
          $exists: true,      // Field must exist
          $ne: null,          // Must not be null
          $not: { $size: 0 }  // Must not be empty array
        }
      });
      console.log('Accessibility filter enabled');
    }

    // Debug: log the final query
    console.log('Final matchConditions:', JSON.stringify(matchConditions, null, 2));

    // Search query conditions
    if (searchQuery.trim()) {
      const normalisedQuery = searchQuery.trim().toLowerCase();
      matchConditions.$or = [
        { category: { $regex: normalisedQuery, $options: 'i' } },
        { subcategories: { $elemMatch: { $regex: normalisedQuery, $options: 'i' } } },
        { title: { $regex: normalisedQuery, $options: 'i' } },
        { description: { $regex: normalisedQuery, $options: 'i' } },
        { 'venue.name': { $regex: normalisedQuery, $options: 'i' } },
      ];
    }

    // Simple query (no search)
    if (!searchQuery.trim()) {
      const [events, totalEvents] = await Promise.all([
        Event.find(matchConditions)
          .sort({ startDate: 1 })
          .skip(skip)
          .limit(EVENTS_PER_PAGE)
          .lean(),
        Event.countDocuments(matchConditions),
      ]);

      const serializedEvents = events.map((event) => ({
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        category: event.category,
        subcategories: event.subcategories,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString(),
        venue: event.venue,
        priceMin: event.priceMin,
        priceMax: event.priceMax,
        isFree: event.isFree,
        bookingUrl: event.bookingUrl,
        bookingUrls: event.bookingUrls,
        imageUrl: event.imageUrl,
        accessibility: event.accessibility,
        duration: event.duration,
        ageRestriction: event.ageRestriction,
        sources: event.sources,
        sourceIds: event.sourceIds,
        primarySource: event.primarySource,
        scrapedAt: event.scrapedAt.toISOString(),
        lastUpdated: event.lastUpdated.toISOString(),
      }));

      return NextResponse.json({
        events: serializedEvents,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalEvents / EVENTS_PER_PAGE),
          totalEvents,
          hasMore: page < Math.ceil(totalEvents / EVENTS_PER_PAGE),
        },
      });
    }

    // Advanced search with relevance scoring
    const normalisedQuery = searchQuery.trim().toLowerCase();

    const pipeline = [
      { $match: matchConditions },
      {
        $addFields: {
          relevanceScore: {
            $sum: [
              { $cond: [{ $regexMatch: { input: { $toLower: '$category' }, regex: `^${normalisedQuery}$` } }, 100, 0] },
              { $cond: [{ $regexMatch: { input: { $toLower: '$category' }, regex: normalisedQuery } }, 50, 0] },
              { $cond: [{ $regexMatch: { input: { $toLower: '$title' }, regex: `^${normalisedQuery}` } }, 40, 0] },
              { $cond: [{ $regexMatch: { input: { $toLower: '$title' }, regex: normalisedQuery } }, 20, 0] },
              { $cond: [{ $regexMatch: { input: { $toLower: '$venue.name' }, regex: normalisedQuery } }, 10, 0] },
              { $cond: [{ $regexMatch: { input: { $toLower: '$description' }, regex: normalisedQuery } }, 5, 0] },
            ],
          },
        },
      },
      { $sort: { relevanceScore: -1 as const, startDate: 1 as const } },
      {
        $facet: {
          events: [{ $skip: skip }, { $limit: EVENTS_PER_PAGE }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const results = await Event.aggregate(pipeline);
    const events: AggregatedEvent[] = results[0]?.events || [];
    const totalEvents = results[0]?.totalCount[0]?.count || 0;

    const serializedEvents = events.map((event: AggregatedEvent) => ({
      _id: event._id.toString(),
      title: event.title,
      description: event.description,
      category: event.category,
      subcategories: event.subcategories,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate?.toISOString(),
      venue: event.venue,
      priceMin: event.priceMin,
      priceMax: event.priceMax,
      isFree: event.isFree,
      bookingUrl: event.bookingUrl,
      bookingUrls: event.bookingUrls,
      imageUrl: event.imageUrl,
      accessibility: event.accessibility,
      duration: event.duration,
      ageRestriction: event.ageRestriction,
      sources: event.sources,
      sourceIds: event.sourceIds,
      primarySource: event.primarySource,
      scrapedAt: event.scrapedAt.toISOString(),
      lastUpdated: event.lastUpdated.toISOString(),
    }));

    return NextResponse.json({
      events: serializedEvents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalEvents / EVENTS_PER_PAGE),
        totalEvents,
        hasMore: page < Math.ceil(totalEvents / EVENTS_PER_PAGE),
      },
    });
  } catch (error) {
    console.error('Events API error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}