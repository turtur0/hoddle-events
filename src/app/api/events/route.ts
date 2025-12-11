import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Types, FilterQuery } from 'mongoose';
import { Event, type IEvent } from '@/lib/models';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPersonalisedRecommendations } from '@/lib/ml/user-profile-service';

const EVENTS_PER_PAGE = 18;

type SortOption =
  | 'recommended'
  | 'popular'
  | 'price-low'
  | 'price-high'
  | 'date-soon'
  | 'date-late'
  | 'recently-added';

interface AggregatedEvent extends IEvent {
  _id: Types.ObjectId;
  relevanceScore?: number;
  mlScore?: number;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const searchQuery = searchParams.get('q') || '';
    const sortOption = (searchParams.get('sort') as SortOption) || null;

    const session = await getServerSession(authOptions);
    const matchConditions = buildMatchConditions(searchParams);

    // Handle personalised recommendations
    if (sortOption === 'recommended' && session?.user?.id) {
      return await fetchRecommendedEvents(
        matchConditions,
        page,
        new Types.ObjectId(session.user.id)
      );
    }

    // Handle search with relevance
    if (searchQuery.trim()) {
      return await fetchSearchResults(
        matchConditions,
        searchQuery,
        page,
        sortOption || 'date-soon'
      );
    }

    // Handle standard sorted queries
    return await fetchSortedEvents(
      matchConditions,
      page,
      sortOption || 'date-soon'
    );
  } catch (error) {
    console.error('Events API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

function buildMatchConditions(searchParams: URLSearchParams): FilterQuery<IEvent> {
  const now = new Date();

  const matchConditions: FilterQuery<IEvent> = {
    // Show events where endDate >= now, or if no endDate, where startDate >= now
    $or: [
      { endDate: { $gte: now } },
      { endDate: { $exists: false }, startDate: { $gte: now } },
      { endDate: null, startDate: { $gte: now } },
    ],
    isArchived: { $ne: true },
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

  // Date range filter
  const dateFilter = searchParams.get('date');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  if (dateFrom || dateTo) {
    applyCustomDateRange(matchConditions, dateFrom || undefined, dateTo || undefined, now);
  } else if (dateFilter && dateFilter !== 'all') {
    applyDateFilter(matchConditions, dateFilter, now);
  }

  // Price filters
  const freeOnly = searchParams.get('free') === 'true';
  if (freeOnly) {
    matchConditions.isFree = true;
  } else {
    applyPriceFilters(matchConditions, searchParams);
  }

  // Accessibility filter
  const accessibleOnly = searchParams.get('accessible') === 'true';
  if (accessibleOnly) {
    matchConditions.accessibility = {
      $exists: true,
      $ne: null,
      $not: { $size: 0 },
    } as any;
  }

  return matchConditions;
}

function applyDateFilter(matchConditions: FilterQuery<IEvent>, dateFilter: string, now: Date) {
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

function applyCustomDateRange(
  matchConditions: FilterQuery<IEvent>,
  dateFrom?: string,
  dateTo?: string,
  now?: Date
) {
  if (!dateFrom && !dateTo) return;

  const today = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date();
  const dateConditions: any = {};

  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    dateConditions.$gte = fromDate >= today ? fromDate : today;
  } else {
    dateConditions.$gte = today;
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setDate(toDate.getDate() + 1);
    toDate.setHours(0, 0, 0, 0);
    dateConditions.$lt = toDate;
  }

  matchConditions.startDate = dateConditions;
}

function applyPriceFilters(
  matchConditions: FilterQuery<IEvent>,
  searchParams: URLSearchParams
) {
  const priceMin = searchParams.get('priceMin');
  const priceMax = searchParams.get('priceMax');

  if (priceMin) {
    matchConditions.priceMin = { $gte: parseInt(priceMin) };
  }
  if (priceMax) {
    matchConditions.priceMax = { $lte: parseInt(priceMax) };
  }
}

function getSortConfig(sortOption: SortOption): Record<string, 1 | -1> {
  const configs: Record<SortOption, Record<string, 1 | -1>> = {
    popular: { 'stats.categoryPopularityPercentile': -1, startDate: 1 },
    'price-low': { priceMin: 1, startDate: 1 },
    'price-high': { priceMax: -1, startDate: 1 },
    'date-soon': { startDate: 1 },
    'date-late': { startDate: -1 },
    'recently-added': { scrapedAt: -1, startDate: 1 },
    recommended: { startDate: 1 },
  };

  return configs[sortOption] || configs['date-soon'];
}

async function fetchRecommendedEvents(
  matchConditions: FilterQuery<IEvent>,
  page: number,
  userId: Types.ObjectId
) {
  try {
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(userId);

    if (!user) {
      return fetchSortedEvents(matchConditions, page, 'date-soon');
    }

    const recommendations = await getPersonalisedRecommendations(userId, user, {
      limit: EVENTS_PER_PAGE * 5,
      excludeFavourited: false,
      category: matchConditions.category?.$regex?.source,
      minDate: matchConditions.startDate?.$gte as Date,
    });

    let filteredEvents = recommendations
      .map(r => r.event)
      .filter(event => !event.isArchived);

    // Apply date filter (endDate or startDate logic)
    const now = new Date();
    filteredEvents = filteredEvents.filter(event => {
      if (event.endDate) {
        return new Date(event.endDate) >= now;
      }
      return new Date(event.startDate) >= now;
    });

    // Apply subcategory filter
    if (matchConditions.subcategories?.$elemMatch) {
      const subcatRegex = matchConditions.subcategories.$elemMatch.$regex;
      if (subcatRegex) {
        filteredEvents = filteredEvents.filter(event =>
          event.subcategories?.some(sub => subcatRegex.test(sub))
        );
      }
    }

    // Apply date range filters
    if (matchConditions.startDate) {
      const { $gte, $lt } = matchConditions.startDate;
      filteredEvents = filteredEvents.filter(event => {
        const eventDate = new Date(event.startDate);
        if ($gte && eventDate < $gte) return false;
        if ($lt && eventDate >= $lt) return false;
        return true;
      });
    }

    // Apply free filter
    if (matchConditions.isFree === true) {
      filteredEvents = filteredEvents.filter(event => event.isFree === true);
    }

    // Apply accessibility filter
    if (matchConditions.accessibility) {
      filteredEvents = filteredEvents.filter(
        event => event.accessibility && event.accessibility.length > 0
      );
    }

    // Paginate
    const skip = (page - 1) * EVENTS_PER_PAGE;
    const paginatedEvents = filteredEvents.slice(skip, skip + EVENTS_PER_PAGE);

    return NextResponse.json({
      events: paginatedEvents.map(serialiseEvent),
      pagination: buildPagination(page, filteredEvents.length),
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return fetchSortedEvents(matchConditions, page, 'date-soon');
  }
}

async function fetchSortedEvents(
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

  const sortConfigs: Record<string, Record<string, 1 | -1>> = {
    popular: { relevanceScore: -1, 'stats.categoryPopularityPercentile': -1, startDate: 1 },
    'price-low': { relevanceScore: -1, priceMin: 1, startDate: 1 },
    'price-high': { relevanceScore: -1, priceMax: -1, startDate: 1 },
    'date-late': { relevanceScore: -1, startDate: -1 },
    'recently-added': { relevanceScore: -1, scrapedAt: -1 },
    default: { relevanceScore: -1, startDate: 1 },
  };

  const finalSort = sortConfigs[sortOption] || sortConfigs.default;

  const pipeline = [
    { $match: searchConditions },
    {
      $addFields: {
        relevanceScore: {
          $sum: [
            { $cond: [{ $regexMatch: { input: { $toLower: '$category' }, regex: `^${escapedQuery}$` } }, 100, 0] },
            { $cond: [{ $regexMatch: { input: { $toLower: '$category' }, regex: escapedQuery } }, 50, 0] },
            { $cond: [{ $regexMatch: { input: { $toLower: '$title' }, regex: `^${escapedQuery}` } }, 40, 0] },
            { $cond: [{ $regexMatch: { input: { $toLower: '$title' }, regex: escapedQuery } }, 20, 0] },
            { $cond: [{ $regexMatch: { input: { $toLower: '$venue.name' }, regex: escapedQuery } }, 10, 0] },
            { $cond: [{ $regexMatch: { input: { $toLower: '$description' }, regex: escapedQuery } }, 5, 0] },
          ],
        },
      },
    },
    { $sort: finalSort },
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
    sourceIds: event.sourceIds,
    primarySource: event.primarySource,
    scrapedAt: event.scrapedAt instanceof Date
      ? event.scrapedAt.toISOString()
      : new Date(event.scrapedAt).toISOString(),
    lastUpdated: event.lastUpdated instanceof Date
      ? event.lastUpdated.toISOString()
      : new Date(event.lastUpdated).toISOString(),
    stats: event.stats,
    isArchived: event.isArchived || false,
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