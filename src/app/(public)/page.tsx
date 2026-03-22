import { Suspense } from "react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { HeroSection } from "@/components/home/HeroSection";
import { PageBackground } from "@/components/effects/PageBackground";
import { CategoryInsightsSplit } from "@/components/home/CategoryInsightsSplit";
import { EventsShowcase } from "@/components/home/EventsShowcase";
import { connectDB } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Event } from "@/lib/models";

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

async function getEventStats() {
  await connectDB();
  const now = new Date();
  const [totalEvents, archivedEvents, sources] = await Promise.all([
    Event.countDocuments({
      startDate: { $gte: now },
      isArchived: { $ne: true }
    }),
    Event.countDocuments({ isArchived: true }),
    Event.distinct("primarySource")
  ]);
  return { totalEvents, archivedEvents, sourceCount: sources.length };
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
        background:
          "linear-gradient(to bottom, #111110 0%, #1a1918 8%, var(--background) 28%, var(--background) 100%)",
        isolation: "isolate"
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
      <div
        className="container-page"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-1">Explore</h2>
          <p className="text-muted-foreground">
            Browse events by category or dive into insights
          </p>
        </div>
        <CategoryInsightsSplit />
      </div>

      {/* ── Discover: For You / Trending / Hidden Gems / This Week / This Month ── */}
      <EventsShowcase userFavourites={userFavourites} isLoggedIn={isLoggedIn} />
    </div>
  );
}
