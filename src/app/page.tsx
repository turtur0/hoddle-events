import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Calendar, MapPin, Music, Theater, Trophy, Palette, Users, Sparkles, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventCard } from "@/components/events/event-card";
import { EventCardSkeleton } from "@/components/events/event-card-skeleton";
import { SearchBar } from "@/components/search/search-bar";
import { connectDB } from "@/app/lib/db";
import Event from "@/app/lib/models/Event";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { getUserFavourites } from "@/app/actions/interactions";

const CATEGORIES = [
  { label: "Music", slug: "music", icon: Music, color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" },
  { label: "Theatre", slug: "theatre", icon: Theater, color: "bg-red-500/10 text-red-500 hover:bg-red-500/20" },
  { label: "Sports", slug: "sports", icon: Trophy, color: "bg-green-500/10 text-green-500 hover:bg-green-500/20" },
  { label: "Arts & Culture", slug: "arts", icon: Palette, color: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20" },
  { label: "Family", slug: "family", icon: Users, color: "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20" },
  { label: "Other", slug: "other", icon: Sparkles, color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" },
];

// Fetch stats for the hero section
async function getStats() {
  await connectDB();
  const totalEvents = await Event.countDocuments({ startDate: { $gte: new Date() } });
  const sources = await Event.distinct('primarySource');
  return { totalEvents, sourceCount: sources.length };
}

// Helper to convert MongoDB Map to plain object
function mapToObject(map: any): Record<string, string> {
  if (!map) return {};
  if (typeof map.get === 'function') {
    const obj: Record<string, string> = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }
  return map;
}

// Fetch featured events (upcoming soon, with good images)
async function FeaturedEvents({ userFavourites }: { userFavourites: Set<string> }) {
  await connectDB();

  const events = await Event.find({
    startDate: { $gte: new Date() },
    imageUrl: { $exists: true, $ne: null },
  })
    .sort({ startDate: 1 })
    .limit(6)
    .lean();

  const serialized = events.map((e) => ({
    _id: e._id.toString(),
    title: e.title,
    description: e.description,
    category: e.category,
    subcategories: e.subcategories || [],
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString(),
    venue: e.venue,
    priceMin: e.priceMin,
    priceMax: e.priceMax,
    isFree: e.isFree,
    bookingUrl: e.bookingUrl,
    bookingUrls: mapToObject(e.bookingUrls),
    imageUrl: e.imageUrl,
    sources: e.sources || [],
    primarySource: e.primarySource,
    sourceIds: mapToObject(e.sourceIds),
    accessibility: e.accessibility || [],
    scrapedAt: e.scrapedAt.toISOString(),
    lastUpdated: e.lastUpdated.toISOString(),
    stats: e.stats || { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {serialized.map((event) => (
        <EventCard
          key={event._id}
          event={event}
          source="homepage"
          initialFavourited={userFavourites.has(event._id)}
        />
      ))}
    </div>
  );
}

function FeaturedEventsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Fetch "This Week" events
async function ThisWeekEvents() {
  await connectDB();

  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + 7);

  const events = await Event.find({
    startDate: { $gte: now, $lte: endOfWeek },
  })
    .sort({ startDate: 1 })
    .limit(4)
    .lean();

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No events scheduled for this week. Check back soon!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {events.map((e) => (
        <Link
          key={e._id.toString()}
          href={`/events/${e._id.toString()}`}
          className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">
              {new Date(e.startDate).toLocaleDateString('en-AU', { weekday: 'short' })}
            </span>
            <span className="text-xl font-bold">
              {new Date(e.startDate).getDate()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold truncate">{e.title}</h4>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {e.venue.name}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(e.startDate).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { totalEvents, sourceCount } = await getStats();

  // Get user's favourites if logged in
  const session = await getServerSession(authOptions);
  let userFavourites = new Set<string>();

  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  return (
    <main>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-primary/5 via-background to-background">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              <Zap className="h-3 w-3 mr-1" />
              Updated daily from {sourceCount} sources
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Discover What's On in{" "}
              <span className="text-primary">Melbourne</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Your one-stop guide to concerts, theatre, sports, festivals and more.
              Find your next experience from {totalEvents.toLocaleString()}+ events.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto mb-6">
              <Suspense fallback={<div className="h-12 bg-muted animate-pulse rounded" />}>
                <SearchBar />
              </Suspense>
            </div>


            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/events">
                  Browse All Events
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/category/music">
                  <Music className="mr-2 h-4 w-4" />
                  Live Music
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Browse by Category</h2>
            <p className="text-muted-foreground">Find events that match your interests</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`flex flex-col items-center justify-center p-6 rounded-xl border transition-all hover:scale-105 ${cat.color}`}
              >
                <Icon className="h-8 w-8 mb-2" />
                <span className="font-medium text-center">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* This Week Section */}
      <section className="container py-12">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                This Week
              </CardTitle>
              <p className="text-sm text-muted-foreground">Don't miss out on these upcoming events</p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/events?date=this-week">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded" />}>
              <ThisWeekEvents />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Featured Events Section */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Upcoming Events</h2>
            <p className="text-muted-foreground">The next events happening in Melbourne</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/events">
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Suspense fallback={<FeaturedEventsSkeleton />}>
          <FeaturedEvents userFavourites={userFavourites} />
        </Suspense>
      </section>

      {/* Stats Section */}
      <section className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-4xl font-bold text-primary">{totalEvents.toLocaleString()}+</p>
              <p className="text-muted-foreground">Events Listed</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-4xl font-bold text-primary">{sourceCount}</p>
              <p className="text-muted-foreground">Data Sources</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-4xl font-bold text-primary">Daily</p>
              <p className="text-muted-foreground">Auto Updates</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}