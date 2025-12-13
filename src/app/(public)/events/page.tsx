import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { Metadata } from "next";
import { Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EventsPageLayout } from '@/components/layout/EventsPageLayout';
import { EventsGrid, EventsGridSkeleton } from '@/components/events/sections/EventsGrid';
import { SearchBar } from '@/components/events/filters/SearchBar';
import { EventFilters } from '@/components/events/filters/EventFilters';
import { SerialisedEvent } from "@/lib/models/Event";
import { getUserFavourites } from "@/lib/actions/interactions";

export const metadata: Metadata = {
  title: "All Events | Hoddle",
  description: "Browse all concerts, shows, festivals and events across Melbourne. Filter by category, date, price and more.",
  openGraph: {
    title: "All Events | Hoddle",
    description: "Browse all concerts, shows, festivals and events across Melbourne.",
  },
};

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
  const params = new URLSearchParams({ page: props.page.toString() });

  // Apply filters
  if (props.searchQuery.trim()) params.set('q', props.searchQuery.trim());
  if (props.category) params.set('category', props.category);
  if (props.subcategory) params.set('subcategory', props.subcategory);
  if (props.dateFilter) params.set('date', props.dateFilter);
  if (props.dateFrom) params.set('dateFrom', props.dateFrom);
  if (props.dateTo) params.set('dateTo', props.dateTo);
  if (props.freeOnly) params.set('free', 'true');
  if (props.accessibleOnly) params.set('accessible', 'true');
  if (props.sortOption) params.set('sort', props.sortOption);

  const data = await fetchEvents(params);
  const events: SerialisedEvent[] = data.events;
  const { totalEvents, totalPages } = data.pagination;

  const source = props.searchQuery ? 'search' : props.category ? 'category_browse' : 'direct';
  const hasFilters = props.searchQuery || props.category || props.subcategory ||
    props.dateFilter || props.dateFrom || props.dateTo || props.freeOnly || props.accessibleOnly;

  return (
    <EventsGrid
      events={events}
      totalEvents={totalEvents}
      totalPages={totalPages}
      currentPage={props.page}
      userFavourites={props.userFavourites}
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
  const session = await getServerSession(authOptions);

  // Parse search parameters
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

  // Get user favourites
  let userFavourites = new Set<string>();
  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  // Create unique key for Suspense
  const suspenseKey = `${currentPage}-${searchQuery}-${category}-${subcategory}-${dateFilter}-${dateFrom}-${dateTo}-${freeOnly}-${accessibleOnly}-${sortOption}`;

  return (
    <EventsPageLayout
      icon={Search}
      iconColor="text-primary"
      iconBgColor="bg-primary/10 ring-1 ring-primary/20"
      title={searchQuery ? `Search: "${searchQuery}"` : 'All Events'}
      description="Discover concerts, shows, festivals and events across Melbourne"
      filters={
        <div className="space-y-4">
          <SearchBar />
          <EventFilters isAuthenticated={!!session?.user} />
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