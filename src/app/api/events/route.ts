import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/app/lib/db';
import Event from '@/app/lib/models/Event';

const EVENTS_PER_PAGE = 12;

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    
    // Get query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const searchQuery = searchParams.get('q') || '';

    // Build MongoDB query
    const query: any = {
      startDate: { $gte: new Date() }, // Only upcoming events
    };

    // Add text search if query exists
    if (searchQuery.trim()) {
      query.$text = { $search: searchQuery.trim() };
    }

    // Calculate pagination
    const skip = (page - 1) * EVENTS_PER_PAGE;

    // Execute query with pagination
    const [events, totalEvents] = await Promise.all([
      Event.find(query)
        .sort(searchQuery.trim() ? { score: { $meta: 'textScore' }, startDate: 1 } : { startDate: 1 })
        .skip(skip)
        .limit(EVENTS_PER_PAGE)
        .lean(),
      Event.countDocuments(query),
    ]);

    // Serialize dates
    const serializedEvents = events.map((event) => ({
      _id: event._id.toString(),
      title: event.title,
      description: event.description,
      category: event.category,
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