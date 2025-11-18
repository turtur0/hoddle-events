import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/app/lib/db';
import Event, { IEvent } from '@/app/lib/models/Event';
import { Types } from 'mongoose';

const EVENTS_PER_PAGE = 12;

// Type for aggregation result (raw objects, not Mongoose documents)
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
    const skip = (page - 1) * EVENTS_PER_PAGE;

    if (!searchQuery.trim()) {
      // No search query - simple fetch
      const [events, totalEvents] = await Promise.all([
        Event.find({ startDate: { $gte: new Date() } })
          .sort({ startDate: 1 })
          .skip(skip)
          .limit(EVENTS_PER_PAGE)
          .lean(),
        Event.countDocuments({ startDate: { $gte: new Date() } }),
      ]);

      const serializedEvents = events.map((event) => ({
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        category: event.category,
        subcategory: event.subcategory,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString(),
        venue: event.venue,
        priceMin: event.priceMin,
        priceMax: event.priceMax,
        isFree: event.isFree,
        bookingUrl: event.bookingUrl,
        imageUrl: event.imageUrl,
        source: event.source,
        sourceId: event.sourceId,
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

    // Advanced search with custom relevance scoring
    const normalisedQuery = searchQuery.trim().toLowerCase();

    const pipeline = [
      // Stage 1: Match upcoming events with search criteria
      {
        $match: {
          startDate: { $gte: new Date() },
          $or: [
            { category: { $regex: normalisedQuery, $options: 'i' } },
            { subcategory: { $regex: normalisedQuery, $options: 'i' } },
            { title: { $regex: normalisedQuery, $options: 'i' } },
            { description: { $regex: normalisedQuery, $options: 'i' } },
            { 'venue.name': { $regex: normalisedQuery, $options: 'i' } },
          ],
        },
      },

      // Stage 2: Calculate custom relevance score
      {
        $addFields: {
          relevanceScore: {
            $sum: [
              // Exact category match: 100 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: '$category' }, regex: `^${normalisedQuery}$` } },
                  100,
                  0
                ]
              },

              // Exact subcategory match: 100 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: { $ifNull: ['$subcategory', ''] } }, regex: `^${normalisedQuery}$` } },
                  100,
                  0
                ]
              },

              // Category contains query: 50 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: '$category' }, regex: normalisedQuery } },
                  50,
                  0
                ]
              },

              // Subcategory contains query: 50 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: { $ifNull: ['$subcategory', ''] } }, regex: normalisedQuery } },
                  50,
                  0
                ]
              },

              // Title starts with query: 40 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: '$title' }, regex: `^${normalisedQuery}` } },
                  40,
                  0
                ]
              },

              // Title contains query: 20 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: '$title' }, regex: normalisedQuery } },
                  20,
                  0
                ]
              },

              // Venue name contains query: 10 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: '$venue.name' }, regex: normalisedQuery } },
                  10,
                  0
                ]
              },

              // Description contains query: 5 points
              {
                $cond: [
                  { $regexMatch: { input: { $toLower: '$description' }, regex: normalisedQuery } },
                  5,
                  0
                ]
              },
            ],
          },
        },
      },

      // Stage 3: Sort by relevance, then by date
      {
        $sort: {
          relevanceScore: -1 as const,
          startDate: 1 as const
        },
      },

      // Stage 4: Get total count
      {
        $facet: {
          events: [
            { $skip: skip },
            { $limit: EVENTS_PER_PAGE },
          ],
          totalCount: [
            { $count: 'count' },
          ],
        },
      },
    ];

    const results = await Event.aggregate(pipeline);

    const events: AggregatedEvent[] = results[0]?.events || [];
    const totalEvents = results[0]?.totalCount[0]?.count || 0;

    // Serialize dates
    const serializedEvents = events.map((event: AggregatedEvent) => ({
      _id: event._id.toString(),
      title: event.title,
      description: event.description,
      category: event.category,
      subcategory: event.subcategory,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate?.toISOString(),
      venue: event.venue,
      priceMin: event.priceMin,
      priceMax: event.priceMax,
      isFree: event.isFree,
      bookingUrl: event.bookingUrl,
      imageUrl: event.imageUrl,
      source: event.source,
      sourceId: event.sourceId,
      scrapedAt: event.scrapedAt.toISOString(),
      lastUpdated: event.lastUpdated.toISOString(),
    }));

    const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

    return NextResponse.json({
      events: serializedEvents,
      pagination: {
        currentPage: page,
        totalPages,
        totalEvents,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Events API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}