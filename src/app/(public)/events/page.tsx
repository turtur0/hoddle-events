// app/(public)/events/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventsPageLayout } from '@/components/layout/EventsPageLayout';
import { EventsGrid, EventsGridSkeleton } from '@/components/events/sections/EventsGrid';
import { SearchBar } from '@/components/events/filters/SearchBar';
import { EventFilters } from '@/components/events/filters/EventFilters';
import { Suspense } from "react";
import { SerializedEvent } from "@/lib/models/Event";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Search } from "lucide-react";

interface EventsPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    subcategory?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    free?: string;
    accessible?: string;
    sort?: string;
  }>;
}

async function fetchEvents(params: URLSearchParams) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/events?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  return response.json();
}

interface EventsGridWrapperProps {
  page: number;
  searchQuery: string;
  category: string;
  subcategory: string;
  dateFilter: string;
  dateFrom: string;
  dateTo: string;
  freeOnly: boolean;
  accessibleOnly: boolean;
  sortOption: string;
  userFavourites: Set<string>;
}

async function EventsGridWrapper(props: EventsGridWrapperProps) {
  const {
    page,
    searchQuery,
    category,
    subcategory,
    dateFilter,
    dateFrom,
    dateTo,
    freeOnly,
    accessibleOnly,
    sortOption,
    userFavourites,
  } = props;

  const params = new URLSearchParams({ page: page.toString() });

  if (searchQuery.trim()) params.set('q', searchQuery.trim());
  if (category) params.set('category', category);
  if (subcategory) params.set('subcategory', subcategory);
  if (dateFilter) params.set('date', dateFilter);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (freeOnly) params.set('free', 'true');
  if (accessibleOnly) params.set('accessible', 'true');
  if (sortOption) params.set('sort', sortOption);

  const data = await fetchEvents(params);
  const eventsData: SerializedEvent[] = data.events;
  const { totalEvents, totalPages } = data.pagination;

  const source = searchQuery ? 'search' : category ? 'category_browse' : 'direct';
  const hasFilters = searchQuery || category || subcategory || dateFilter || dateFrom || dateTo || freeOnly || accessibleOnly;

  return (
    <EventsGrid
      events={eventsData}
      totalEvents={totalEvents}
      totalPages={totalPages}
      currentPage={page}
      userFavourites={userFavourites}
      source={source}
      emptyTitle={hasFilters ? "No events found" : "No events yet"}
      emptyDescription={
        hasFilters
          ? "No events match your filters. Try adjusting your search criteria."
          : "We're working on populating the database with amazing Melbourne events. Check back soon!"
      }
    />
  );
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = await searchParams;

  const currentPage = Number(params.page) || 1;
  const searchQuery = params.q || '';
  const category = params.category || '';
  const subcategory = params.subcategory || '';
  const dateFilter = params.date || '';
  const dateFrom = params.dateFrom || '';
  const dateTo = params.dateTo || '';
  const freeOnly = params.free === 'true';
  const accessibleOnly = params.accessible === 'true';
  const sortOption = params.sort || '';

  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user);

  let userFavourites = new Set<string>();
  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  const suspenseKey = `${currentPage}-${searchQuery}-${category}-${subcategory}-${dateFilter}-${dateFrom}-${dateTo}-${freeOnly}-${accessibleOnly}-${sortOption}`;

  return (
    <EventsPageLayout
      icon={Search}
      iconColor="text-primary"
      iconBgColor="bg-primary/10 ring-1 ring-primary/20"
      title={searchQuery ? `Search: "${searchQuery}"` : 'All Events'}
      description="Discover concerts, shows, festivals, and events across Melbourne"
      filters={
        <div className="space-y-4">
          <SearchBar />
          <EventFilters isAuthenticated={isAuthenticated} />
        </div>
      }
    >
      <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
        <EventsGridWrapper
          page={currentPage}
          searchQuery={searchQuery}
          category={category}
          subcategory={subcategory}
          dateFilter={dateFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          freeOnly={freeOnly}
          accessibleOnly={accessibleOnly}
          sortOption={sortOption}
          userFavourites={userFavourites}
        />
      </Suspense>
    </EventsPageLayout>
  );
}