import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Music, Theater, Trophy, Palette, Users, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/search/search-bar";
import { ForYouSection } from "@/components/recommendations/for-you-section";
import { TrendingSection } from "@/components/recommendations/trending-section";
import { UpcomingEvents } from "@/components/events/upcoming-events";
import { connectDB } from "@/lib/db";
import Event from "@/lib/models/Event";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserFavourites } from "@/actions/interactions";

const CATEGORIES = [
  { label: "Music", slug: "music", icon: Music, color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" },
  { label: "Theatre", slug: "theatre", icon: Theater, color: "bg-red-500/10 text-red-500 hover:bg-red-500/20" },
  { label: "Sports", slug: "sports", icon: Trophy, color: "bg-green-500/10 text-green-500 hover:bg-green-500/20" },
  { label: "Arts & Culture", slug: "arts", icon: Palette, color: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20" },
  { label: "Family", slug: "family", icon: Users, color: "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20" },
  { label: "Other", slug: "other", icon: Sparkles, color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" },
];

async function getStats() {
  await connectDB();
  const totalEvents = await Event.countDocuments({ startDate: { $gte: new Date() } });
  const sources = await Event.distinct('primarySource');
  return { totalEvents, sourceCount: sources.length };
}

function CarouselSkeleton() {
  return (
    <Card>
      <div className="p-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
              <div className="h-80 bg-muted rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default async function HomePage() {
  const { totalEvents, sourceCount } = await getStats();

  const session = await getServerSession(authOptions);
  let userFavourites = new Set<string>();

  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  const isLoggedIn = !!session?.user;

  return (
    <div className="w-full">
      {/* Hero Section - Full width background */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6">
              <Zap className="h-3 w-3 mr-1" />
              Updated daily from {sourceCount} sources
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Discover What's On in{" "}
              <span className="text-primary">Melbourne</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Your one-stop guide to concerts, theatre, sports, festivals and more.
              Find your next experience from {totalEvents.toLocaleString()}+ events.
            </p>

            <div className="max-w-2xl mx-auto mb-8">
              <Suspense fallback={<div className="h-14 bg-muted animate-pulse rounded-lg" />}>
                <SearchBar />
              </Suspense>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button asChild size="lg" className="text-base">
                <Link href="/events">
                  Browse All Events
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="text-base">
                <Link href="/category/music">
                  <Music className="mr-2 h-5 w-5" />
                  Live Music
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-2">Browse by Category</h2>
          <p className="text-muted-foreground text-lg">Find events that match your interests</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-md ${cat.color}`}
              >
                <Icon className="h-8 w-8 mb-3" />
                <span className="font-medium text-center text-sm">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* For You Section (Logged in users only) */}
      {isLoggedIn && (
        <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Suspense fallback={<CarouselSkeleton />}>
            <ForYouSection userFavourites={userFavourites} />
          </Suspense>
        </section>
      )}

      {/* Trending Section (Always shown) */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Suspense fallback={<CarouselSkeleton />}>
          <TrendingSection userFavourites={userFavourites} />
        </Suspense>
      </section>

      {/* Upcoming Events Section */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Suspense fallback={<CarouselSkeleton />}>
          <UpcomingEvents userFavourites={userFavourites} />
        </Suspense>
      </section>

      {/* Stats Section */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="text-center bg-gradient-to-br from-primary/10 to-transparent border-primary/20 border-2">
            <CardContent className="pt-8 pb-8">
              <p className="text-5xl font-bold text-primary mb-2">{totalEvents.toLocaleString()}+</p>
              <p className="text-muted-foreground">Events Listed</p>
            </CardContent>
          </Card>
          <Card className="text-center bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 border-2">
            <CardContent className="pt-8 pb-8">
              <p className="text-5xl font-bold text-blue-500 mb-2">{sourceCount}</p>
              <p className="text-muted-foreground">Data Sources</p>
            </CardContent>
          </Card>
          <Card className="text-center bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20 border-2">
            <CardContent className="pt-8 pb-8">
              <p className="text-5xl font-bold text-green-500 mb-2">Daily</p>
              <p className="text-muted-foreground">Auto Updates</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}