import { connectDB } from "./lib/db";
import Event, { SerializedEvent } from "./lib/models/Event";
import { EventCard } from "@/components/event-card";
import { EventCardSkeleton } from "@/components/event-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { Suspense } from "react";

const EVENTS_PER_PAGE = 12;

async function EventsGrid({ page }: { page: number }) {
  await connectDB();

  const skip = (page - 1) * EVENTS_PER_PAGE;

  // Get total count for pagination
  const totalEvents = await Event.countDocuments({
    startDate: { $gte: new Date() },
  });

  // Fetch paginated events
  const events = await Event.find({
    startDate: { $gte: new Date() },
  })
    .sort({ startDate: 1 })
    .skip(skip)
    .limit(EVENTS_PER_PAGE)
    .lean();

  const eventsData: SerializedEvent[] = events.map((event) => ({
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

  if (eventsData.length === 0 && page === 1) {
    return (
      <EmptyState
        title="No events yet"
        description="We're working on populating the database with amazing Melbourne events. Check back soon!"
      />
    );
  }

  const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {eventsData.map((event) => (
          <EventCard key={event._id} event={event} />
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;

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

      {/* Events Grid with Suspense */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
        <Suspense fallback={<EventsGridSkeleton />} key={currentPage}>
          <EventsGrid page={currentPage} />
        </Suspense>
      </div>
    </main>
  );
}