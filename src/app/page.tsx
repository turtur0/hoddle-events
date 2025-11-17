import { connectDB } from "./lib/db";
import Event, { SerializedEvent } from "./lib/models/Event"; // Add SerializedEvent import
import { EventCard } from "@/components/event-card";
import { EventCardSkeleton } from "@/components/event-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Suspense } from "react";

async function EventsGrid() {
  await connectDB();

  // Fetch upcoming events, sorted by date
  const events = await Event.find({
    startDate: { $gte: new Date() },
  })
    .sort({ startDate: 1 })
    .limit(12)
    .lean();

  // Convert MongoDB documents to serialized format
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

  if (eventsData.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        description="We're working on populating the database with amazing Melbourne events. Check back soon!"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {eventsData.map((event) => (
        <EventCard key={event._id} event={event} />
      ))}
    </div>
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

export default function Home() {
  return (
    <>
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
          <Suspense fallback={<EventsGridSkeleton />}>
            <EventsGrid />
          </Suspense>
        </div>
      </main>
    </>
  );
}