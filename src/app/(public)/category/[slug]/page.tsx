import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventCard } from '@/components/events/EventCard';
import { EventCardSkeleton } from '@/components/events/EventCardSkeleton';
import { EmptyState } from '@/components/other/EmptyState';
import { Pagination } from '@/components/other/Pagination';
import { BackButton } from '@/components/navigation/BackButton';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Suspense } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Music, Theater, Trophy, Palette, Users, Sparkles } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    subcategory?: string;
    date?: string;
    free?: string;
  }>;
}

const SLUG_TO_CATEGORY: Record<string, string> = {
  'music': 'music',
  'theatre': 'theatre',
  'sports': 'sports',
  'arts': 'arts',
  'family': 'family',
  'other': 'other',
};

const CATEGORY_INFO: Record<string, { title: string; description: string; icon: any; color: string; badgeClass: string }> = {
  'music': {
    title: 'Live Music & Concerts',
    description: 'From intimate gigs to stadium shows, find your next musical experience',
    icon: Music,
    color: 'text-orange-600 dark:text-orange-400',
    badgeClass: 'border-2 border-orange-500/30 bg-orange-500/5 text-orange-600 hover:bg-orange-500/10 hover:border-orange-500/50 dark:text-orange-400 dark:bg-orange-400/10 dark:hover:bg-orange-400/15 dark:border-orange-400/20',
  },
  'theatre': {
    title: 'Theatre & Performing Arts',
    description: 'Plays, musicals, ballet, opera and more on Melbourne\'s stages',
    icon: Theater,
    color: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'border-2 border-rose-500/30 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/50 dark:text-rose-400 dark:bg-rose-400/10 dark:hover:bg-rose-400/15 dark:border-rose-400/20',
  },
  'sports': {
    title: 'Sports & Games',
    description: 'AFL, cricket, tennis and all the sporting action in Melbourne',
    icon: Trophy,
    color: 'text-teal-600 dark:text-teal-400',
    badgeClass: 'border-2 border-teal-500/30 bg-teal-500/5 text-teal-600 hover:bg-teal-500/10 hover:border-teal-500/50 dark:text-teal-400 dark:bg-teal-400/10 dark:hover:bg-teal-400/15 dark:border-teal-400/20',
  },
  'arts': {
    title: 'Arts & Culture',
    description: 'Exhibitions, festivals, film screenings and cultural events',
    icon: Palette,
    color: 'text-purple-600 dark:text-purple-400',
    badgeClass: 'border-2 border-purple-500/30 bg-purple-500/5 text-purple-600 hover:bg-purple-500/10 hover:border-purple-500/50 dark:text-purple-400 dark:bg-purple-400/10 dark:hover:bg-purple-400/15 dark:border-purple-400/20',
  },
  'family': {
    title: 'Family Events',
    description: 'Fun for the whole family - kids shows, educational events and more',
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'border-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/50 dark:text-emerald-400 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/15 dark:border-emerald-400/20',
  },
  'other': {
    title: 'Other Events',
    description: 'Workshops, networking, wellness and community events',
    icon: Sparkles,
    color: 'text-sky-600 dark:text-sky-400',
    badgeClass: 'border-2 border-sky-500/30 bg-sky-500/5 text-sky-600 hover:bg-sky-500/10 hover:border-sky-500/50 dark:text-sky-400 dark:bg-sky-400/10 dark:hover:bg-sky-400/15 dark:border-sky-400/20',
  },
};

async function CategoryEventsGrid({
  categoryValue,
  page,
  subcategory,
  dateFilter,
  freeOnly,
  userFavourites,
}: {
  categoryValue: string;
  page: number;
  subcategory: string;
  dateFilter: string;
  freeOnly: boolean;
  userFavourites: Set<string>;
}) {
  const params = new URLSearchParams({
    page: page.toString(),
    category: categoryValue,
  });

  if (subcategory) params.set('subcategory', subcategory);
  if (dateFilter) params.set('date', dateFilter);
  if (freeOnly) params.set('free', 'true');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/events?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  const data = await response.json();
  const eventsData = data.events;
  const { totalEvents, totalPages } = data.pagination;

  if (eventsData.length === 0) {
    return (
      <EmptyState
        title="No events found"
        description="No events in this category right now. Check back soon!"
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
        {eventsData.map((event: any) => (
          <EventCard
            key={event._id}
            event={event}
            source="category_browse"
            initialFavourited={userFavourites.has(event._id)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} />
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

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  const info = CATEGORY_INFO[slug];

  if (!info) {
    return { title: 'Category Not Found' };
  }

  return {
    title: `${info.title} | Melbourne Events`,
    description: info.description,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const searchParamsResolved = await searchParams;

  const categoryValue = SLUG_TO_CATEGORY[slug];
  const categoryInfo = CATEGORY_INFO[slug];

  if (!categoryValue || !categoryInfo) {
    notFound();
  }

  const currentPage = Number(searchParamsResolved.page) || 1;
  const subcategory = searchParamsResolved.subcategory || '';
  const dateFilter = searchParamsResolved.date || '';
  const freeOnly = searchParamsResolved.free === 'true';

  const session = await getServerSession(authOptions);
  let userFavourites = new Set<string>();

  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  const categoryConfig = CATEGORIES.find(c => c.value === categoryValue);
  const Icon = categoryInfo.icon;

  const suspenseKey = `${slug}-${currentPage}-${subcategory}-${dateFilter}-${freeOnly}`;

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="bg-linear-to-b from-primary/5 via-background to-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <BackButton fallbackUrl="/" className="mb-8" />

          <div className="flex items-start gap-4 mb-4">
            <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
              <Icon className={`h-8 w-8 ${categoryInfo.color}`} />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">
                {categoryInfo.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {categoryInfo.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subcategories Filter */}
      {categoryConfig?.subcategories && categoryConfig.subcategories.length > 0 && (
        <section className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-wrap gap-2">
              <Link href={`/category/${slug}`}>
                <Badge
                  variant="outline"
                  className={`cursor-pointer text-sm px-4 py-2 transition-all hover:scale-105 ${!subcategory ? categoryInfo.badgeClass : 'border-2 border-border/50 bg-background hover:bg-muted'
                    }`}
                >
                  All
                </Badge>
              </Link>
              {categoryConfig.subcategories.map((sub) => (
                <Link key={sub} href={`/category/${slug}?subcategory=${encodeURIComponent(sub)}`}>
                  <Badge
                    variant="outline"
                    className={`cursor-pointer text-sm px-4 py-2 transition-all hover:scale-105 ${subcategory === sub ? categoryInfo.badgeClass : 'border-2 border-border/50 bg-background hover:bg-muted'
                      }`}
                  >
                    {sub}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Events Grid */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
          <CategoryEventsGrid
            categoryValue={categoryValue}
            page={currentPage}
            subcategory={subcategory}
            dateFilter={dateFilter}
            freeOnly={freeOnly}
            userFavourites={userFavourites}
          />
        </Suspense>
      </section>
    </div>
  );
}