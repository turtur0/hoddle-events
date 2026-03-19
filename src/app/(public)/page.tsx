import Link from "next/link";
import { Suspense } from "react";
import { Metadata } from "next";
import {
  ArrowRight,
  Music,
  Theater,
  Trophy,
  Palette,
  Users,
  Sparkles,
  Zap
} from "lucide-react";
import { getServerSession } from "next-auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SearchBar } from "@/components/events/filters/SearchBar";
import { ForYouSection } from "@/components/recommendations/ForYouSection";
import { TrendingSection } from "@/components/recommendations/TrendingSection";
import { UpcomingEvents } from "@/components/events/sections/UpcomingEvents";
import { connectDB } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Event } from "@/lib/models";
import { HoddleGrid } from "@/components/effects/HoddleGrid";

export const metadata: Metadata = {
  title: "Hoddle | Every Melbourne Event in One Place",
  description:
    "Discover events across Melbourne. Search concerts, theatre, sports, festivals and more. Set custom alerts, compare pricing and explore trends. Updated daily.",
  openGraph: {
    title: "Hoddle | Every Melbourne Event in One Place",
    description:
      "Discover events across Melbourne. Search concerts, theatre, sports, festivals and more.",
    type: "website"
  }
};

const CATEGORIES = [
  { label: "Music", slug: "music", icon: Music, className: "category-music" },
  {
    label: "Theatre",
    slug: "theatre",
    icon: Theater,
    className: "category-theatre"
  },
  {
    label: "Sports",
    slug: "sports",
    icon: Trophy,
    className: "category-sports"
  },
  {
    label: "Arts & Culture",
    slug: "arts",
    icon: Palette,
    className: "category-arts"
  },
  {
    label: "Family",
    slug: "family",
    icon: Users,
    className: "category-family"
  },
  { label: "Other", slug: "other", icon: Sparkles, className: "category-other" }
];

async function getEventStats() {
  await connectDB();
  const totalEvents = await Event.countDocuments({
    startDate: { $gte: new Date() },
    isArchived: { $ne: true }
  });
  const sources = await Event.distinct("primarySource");
  return { totalEvents, sourceCount: sources.length };
}

function CarouselSkeleton() {
  return (
    <Card>
      <div className="p-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
            >
              <div className="h-80 bg-muted rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default async function HomePage() {
  const { totalEvents, sourceCount } = await getEventStats();
  const session = await getServerSession(authOptions);

  let userFavourites = new Set<string>();
  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  const isLoggedIn = !!session?.user;

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container-page section-spacing">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <Badge
              variant="secondary"
              className="mb-6 border-2 border-primary/20 bg-primary/5 text-foreground hover:bg-primary/10 active:bg-primary/15 transition-colors duration-(--transition-base) touch-manipulation"
            >
              <Zap className="h-3 w-3 mr-1 text-primary" />
              Updated daily from {sourceCount} sources
            </Badge>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Every Melbourne Event,{" "}
              <span className="text-primary">One Platform</span>
            </h1>

            {/* Description */}
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Search {totalEvents.toLocaleString()}+ events from across
              Melbourne.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <Suspense
                fallback={
                  <div className="h-14 bg-muted animate-pulse rounded-lg" />
                }
              >
                <SearchBar />
              </Suspense>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="group touch-manipulation active:scale-95 transition-transform"
              >
                <Link href="/events">
                  Browse All Events
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1 group-active:translate-x-2" />
                </Link>
              </Button>

              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-2 border-secondary/30 bg-secondary/5 text-secondary hover:bg-secondary/10 active:bg-secondary/15 hover:border-secondary/50 active:border-secondary/60 transition-all duration-(--transition-base) touch-manipulation active:scale-95"
              >
                <Link href="/insights">
                  <Sparkles className="mr-2 h-5 w-5" />
                  View Insights
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section — Hoddle Grid */}
      <section className="section-spacing">
        <div className="container-page mb-6 lg:mb-8">
          <h2 className="text-3xl font-bold mb-1">Browse by Category</h2>
          <p className="text-muted-foreground">
            Hover to explore · Click to browse
          </p>
        </div>
        <div className="container-page flex">
          <HoddleGrid />
        </div>
      </section>

      {/* Personalised Recommendations */}
      {isLoggedIn && (
        <section>
          <div className="container-page section-spacing">
            <Suspense fallback={<CarouselSkeleton />}>
              <ForYouSection userFavourites={userFavourites} />
            </Suspense>
          </div>
        </section>
      )}

      {/* Trending Events */}
      <section>
        <div className="container-page section-spacing">
          <Suspense fallback={<CarouselSkeleton />}>
            <TrendingSection userFavourites={userFavourites} />
          </Suspense>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="container-page section-spacing">
        <Suspense fallback={<CarouselSkeleton />}>
          <UpcomingEvents userFavourites={userFavourites} />
        </Suspense>
      </section>
    </div>
  );
}
