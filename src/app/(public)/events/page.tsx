import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventCard } from '@/components/events/EventCard';
import { EventCardSkeleton } from '@/components/events/EventCardSkeleton';
import { EmptyState } from '@/components/other/EmptyState';
import { Pagination } from '@/components/other/Pagination';
import { SearchBar } from '@/components/search/SearchBar';
import { EventFilters } from '@/components/events/EventFilters';
import { Suspense } from "react";
import { SerializedEvent } from "@/lib/models/Event";
import { getUserFavourites } from "@/lib/actions/interactions";

async function EventsGrid({
  page,
  searchQuery,
  category,
  subcategory,
  dateFilter,
  freeOnly,
  accessibleOnly,
  userFavourites,
}: {
  page: number;
  searchQuery: string;
  category: string;
  subcategory: string;
  dateFilter: string;
  freeOnly: boolean;
  accessibleOnly: boolean;
  userFavourites: Set<string>;
}) {
  // Build API URL with all filters
  const params = new URLSearchParams({
    page: page.toString(),
  });

  if (searchQuery.trim()) params.set('q', searchQuery.trim());
  if (category) params.set('category', category);
  if (subcategory) params.set('subcategory', subcategory);
  if (dateFilter) params.set('date', dateFilter);
  if (freeOnly) params.set('free', 'true');
  if (accessibleOnly) params.set('accessible', 'true');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/events?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  const data = await response.json();
  const eventsData: SerializedEvent[] = data.events;
  const { totalEvents, totalPages } = data.pagination;

  // Determine source based on filters
  const source = searchQuery ? 'search' : category ? 'category_browse' : 'direct';

  // Show empty state for no results
  if (eventsData.length === 0) {
    const hasFilters = searchQuery || category || subcategory || dateFilter || freeOnly || accessibleOnly;

    if (hasFilters) {
      return (
        <EmptyState
          title="No events found"
          description="No events match your filters. Try adjusting your search criteria."
        />
      );
    }
    return (
      <EmptyState
        title="No events yet"
        description="We're working on populating the database with amazing Melbourne events. Check back soon!"
      />
    );
  }

  return (
    <>
      {/* Results count */}
      <div className="mb-4 text-sm text-muted-foreground">
        <span>
          Found <strong>{totalEvents}</strong> event{totalEvents !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {eventsData.map((event) => (
          <EventCard
            key={event._id}
            event={event}
            source={source}
            initialFavourited={userFavourites.has(event._id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
        />
      )}
    </>
  );
}

function EventsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    subcategory?: string;
    date?: string;
    free?: string;
    accessible?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const searchQuery = params.q || '';
  const category = params.category || '';
  const subcategory = params.subcategory || '';
  const dateFilter = params.date || '';
  const freeOnly = params.free === 'true';
  const accessibleOnly = params.accessible === 'true';

  // Get user's favourites if logged in
  const session = await getServerSession(authOptions);
  let userFavourites = new Set<string>();

  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  const suspenseKey = `${currentPage}-${searchQuery}-${category}-${subcategory}-${dateFilter}-${freeOnly}-${accessibleOnly}`;

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="bg-linear-to-b from-primary/5 to-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            {searchQuery ? `Search: "${searchQuery}"` : 'All Events'}
          </h1>
          <p className="text-lg text-muted-foreground">
            Discover concerts, shows, festivals, and events across Melbourne
          </p>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <SearchBar />
        </div>
        <div className="mb-8">
          <EventFilters />
        </div>
      </section>

      {/* Events Grid */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
          <EventsGrid
            page={currentPage}
            searchQuery={searchQuery}
            category={category}
            subcategory={subcategory}
            dateFilter={dateFilter}
            freeOnly={freeOnly}
            accessibleOnly={accessibleOnly}
            userFavourites={userFavourites}
          />

        </Suspense>
      </section>
    </div>
  );
}