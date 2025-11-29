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
import { Search } from "lucide-react";
import { BackButton } from "@/components/navigation/BackButton";

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

  const source = searchQuery ? 'search' : category ? 'category_browse' : 'direct';

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
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found <strong className="text-foreground">{totalEvents.toLocaleString()}</strong> event{totalEvents !== 1 ? 's' : ''}
        </p>
      </div>

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
      <section className="page-header">
        <div className="container-page">
          <BackButton fallbackUrl="/" className="mb-8" />

          <div className="flex items-start gap-4 mb-4">
            <div className="icon-container">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
                {searchQuery ? `Search: "${searchQuery}"` : 'All Events'}
              </h1>
              <p className="text-lg text-muted-foreground">
                Discover concerts, shows, festivals, and events across Melbourne
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container-page py-6">
          <div className="mb-4">
            <SearchBar />
          </div>
          <div>
            <EventFilters />
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="container-page section-spacing animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
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