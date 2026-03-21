import { Suspense } from 'react';
import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { Card } from '@/components/ui/Card';
import { ForYouSection } from '@/components/recommendations/ForYouSection';
import { TrendingSection } from '@/components/recommendations/TrendingSection';
import { UpcomingEvents } from '@/components/events/sections/UpcomingEvents';
import { HeroSection } from '@/components/home/HeroSection';
import { PageBackground } from '@/components/effects/PageBackground';
import { CategoryInsightsSplit } from '@/components/home/CategoryInsightsSplit';
import { connectDB } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { getUserFavourites } from '@/lib/actions/interactions';
import { Event } from '@/lib/models';

export const metadata: Metadata = {
  title: 'Hoddle | Every Melbourne Event in One Place',
  description:
    'Discover events across Melbourne. Search concerts, theatre, sports, festivals and more. Set custom alerts, compare pricing and explore trends. Updated daily.',
  openGraph: {
    title: 'Hoddle | Every Melbourne Event in One Place',
    description: 'Discover events across Melbourne. Search concerts, theatre, sports, festivals and more.',
    type: 'website',
  },
};

async function getEventStats() {
  await connectDB();
  const now = new Date();
  const [totalEvents, archivedEvents, sources] = await Promise.all([
    Event.countDocuments({ startDate: { $gte: now }, isArchived: { $ne: true } }),
    Event.countDocuments({ isArchived: true }),
    Event.distinct('primarySource'),
  ]);
  return { totalEvents, archivedEvents, sourceCount: sources.length };
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
  const { totalEvents, archivedEvents, sourceCount } = await getEventStats();
  const session = await getServerSession(authOptions);

  let userFavourites = new Set<string>();
  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  const isLoggedIn = !!session?.user;

  return (
    /*
      Full-page dark-grey → page-background gradient.
      PageBackground canvas sits fixed behind everything (z-index 0).
      All page content sits above it (z-index 1+).
    */
    <div
      className="w-full relative"
      style={{
        background: 'linear-gradient(to bottom, #111110 0%, #1a1918 8%, var(--background) 28%, var(--background) 100%)',
        isolation: 'isolate',
      }}
    >
      {/* Sparse orange node stars — fixed canvas, full page parallax */}
      <PageBackground />

      {/* ── Hero ── */}
      <HeroSection
        totalEvents={totalEvents}
        archivedEvents={archivedEvents}
        sourceCount={sourceCount}
      />

      {/* ── Categories + Insights split ── */}
      <div className="container-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-1">Explore</h2>
          <p className="text-muted-foreground">Browse events by category or dive into insights</p>
        </div>
        <CategoryInsightsSplit />
      </div>

      {/* ── Personalised Recommendations ── */}
      {isLoggedIn && (
        <section style={{ position: 'relative', zIndex: 1 }}>
          <div className="container-page section-spacing">
            <Suspense fallback={<CarouselSkeleton />}>
              <ForYouSection userFavourites={userFavourites} />
            </Suspense>
          </div>
        </section>
      )}

      {/* ── Trending Events ── */}
      <section style={{ position: 'relative', zIndex: 1 }}>
        <div className="container-page section-spacing">
          <Suspense fallback={<CarouselSkeleton />}>
            <TrendingSection userFavourites={userFavourites} />
          </Suspense>
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      <section className="container-page section-spacing" style={{ position: 'relative', zIndex: 1 }}>
        <Suspense fallback={<CarouselSkeleton />}>
          <UpcomingEvents userFavourites={userFavourites} />
        </Suspense>
      </section>
    </div>
  );
}