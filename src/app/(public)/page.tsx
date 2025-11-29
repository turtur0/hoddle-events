import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Music, Theater, Trophy, Palette, Users, Sparkles, Zap } from "lucide-react";
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/search/SearchBar';
import { ForYouSection } from '@/components/recommendations/ForYouSection';
import { TrendingSection } from '@/components/recommendations/TrendingSection';
import { UpcomingEvents } from '@/components/events/UpcomingEvents';
import { connectDB } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Event } from '@/lib/models';

const CATEGORIES = [
  { label: "Music", slug: "music", icon: Music, className: "category-music" },
  { label: "Theatre", slug: "theatre", icon: Theater, className: "category-theatre" },
  { label: "Sports", slug: "sports", icon: Trophy, className: "category-sports" },
  { label: "Arts & Culture", slug: "arts", icon: Palette, className: "category-arts" },
  { label: "Family", slug: "family", icon: Users, className: "category-family" },
  { label: "Other", slug: "other", icon: Sparkles, className: "category-other" },
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
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-orange-50/30 to-background dark:from-background dark:via-orange-950/5 dark:to-background">
        <div className="container-page section-spacing">
          <div className="max-w-3xl mx-auto text-center">
            <Badge
              variant="secondary"
              className="mb-6 border-2 border-primary/20 bg-primary/5 text-foreground hover:bg-primary/10 transition-colors duration-[var(--transition-base)]"
            >
              <Zap className="h-3 w-3 mr-1 text-primary" />
              Updated daily from {sourceCount} sources
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Discover What's On in{" "}
              <span className="text-primary">Melbourne</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Your one-stop guide to concerts, theatre, sports, festivals and more.
              Find your next experience from {totalEvents.toLocaleString()}+ events.
            </p>

            <div className="max-w-2xl mx-auto mb-8">
              <Suspense fallback={<div className="h-14 bg-muted animate-pulse rounded-lg" />}>
                <SearchBar />
              </Suspense>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="text-base border-2 border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-[var(--transition-base)] group shadow-sm"
              >
                <Link href="/events">
                  Browse All Events
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-[var(--transition-base)] group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="text-base border-2 border-secondary/30 bg-secondary/5 text-secondary hover:bg-secondary/10 hover:border-secondary/50 transition-all duration-[var(--transition-base)]"
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

      {/* Categories Section */}
      <section className="container-page section-spacing">
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
                className={`flex flex-col items-center justify-center p-6 rounded-xl ${cat.className}`}
              >
                <Icon className="h-8 w-8 mb-3" />
                <span className="font-medium text-center text-sm">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* For You Section */}
      {isLoggedIn && (
        <section className="section-bg-orange">
          <div className="container-page section-spacing">
            <Suspense fallback={<CarouselSkeleton />}>
              <ForYouSection userFavourites={userFavourites} />
            </Suspense>
          </div>
        </section>
      )}

      {/* Trending Section */}
      <section className="section-bg-teal">
        <div className="container-page section-spacing">
          <Suspense fallback={<CarouselSkeleton />}>
            <TrendingSection userFavourites={userFavourites} />
          </Suspense>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="container-page section-spacing">
        <Suspense fallback={<CarouselSkeleton />}>
          <UpcomingEvents userFavourites={userFavourites} />
        </Suspense>
      </section>
    </div>
  );
}