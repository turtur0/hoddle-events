import { EventCard } from "@/components/event-card";
import { EventCardSkeleton } from "@/components/event-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { Suspense } from "react";
import { SerializedEvent } from "./lib/models/Event";

async function EventsGrid({ 
  page, 
  searchQuery 
}: { 
  page: number; 
  searchQuery: string;
}) {
  // Build API URL
  const params = new URLSearchParams({
    page: page.toString(),
  });
  
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim());
  }

  // Fetch from API route (uses relevance scoring)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/events?${params.toString()}`, {
    cache: 'no-store', // Always get fresh data
  });

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  const data = await response.json();
  const eventsData: SerializedEvent[] = data.events;
  const { totalEvents, totalPages } = data.pagination;

  // Show empty state for no results
  if (eventsData.length === 0) {
    if (searchQuery.trim()) {
      return (
        <EmptyState
          title="No events found"
          description={`No events match "${searchQuery}". Try adjusting your search.`}
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
        {searchQuery.trim() ? (
          <span>
            Found <strong>{totalEvents}</strong> event{totalEvents !== 1 ? 's' : ''} matching "{searchQuery}"
          </span>
        ) : (
          <span>
            Showing <strong>{totalEvents}</strong> upcoming event{totalEvents !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {eventsData.map((event) => (
          <EventCard key={event._id} event={event} />
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const searchQuery = params.q || '';

  // Create a unique key for Suspense that includes both page and search
  const suspenseKey = `${currentPage}-${searchQuery}`;

  return (
    <main className="container py-8">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Discover Melbourne Events
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Find the best concerts, shows, festivals, and events across
          Melbourne. All in one place, updated daily.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <SearchBar />
      </div>

      {/* Events Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">
          {searchQuery ? 'Search Results' : 'Upcoming Events'}
        </h2>
        <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
          <EventsGrid page={currentPage} searchQuery={searchQuery} />
        </Suspense>
      </div>
    </main>
  );
}