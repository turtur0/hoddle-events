import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventCard } from '@/components/events/EventCard';
import { EventCardSkeleton } from '@/components/events/EventCardSkeleton';
import { EmptyState } from '@/components/other/EmptyState';
import { Pagination } from '@/components/other/Pagination';
import { BackButton } from '@/components/navigation/BackButton';
import { Badge } from '@/components/ui/Badge';
import { Suspense } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Music, Theater, Trophy, Palette, Users, Sparkles, LucideIcon } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    subcategory?: string;
    date?: string;
    free?: string;
  }>;
}

interface CategoryInfo {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  badgeClass: string;
}

const CATEGORY_CONFIG: Record<string, CategoryInfo> = {
  music: {
    title: 'Live Music & Concerts',
    description: 'From intimate gigs to stadium shows, find your next musical experience',
    icon: Music,
    color: 'text-orange-600 dark:text-orange-400',
    badgeClass: 'category-music',
  },
  theatre: {
    title: 'Theatre & Performing Arts',
    description: 'Plays, musicals, ballet, opera and more on Melbourne\'s stages',
    icon: Theater,
    color: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'category-theatre',
  },
  sports: {
    title: 'Sports & Games',
    description: 'AFL, cricket, tennis and all the sporting action in Melbourne',
    icon: Trophy,
    color: 'text-teal-600 dark:text-teal-400',
    badgeClass: 'category-sports',
  },
  arts: {
    title: 'Arts & Culture',
    description: 'Exhibitions, festivals, film screenings and cultural events',
    icon: Palette,
    color: 'text-purple-600 dark:text-purple-400',
    badgeClass: 'category-arts',
  },
  family: {
    title: 'Family Events',
    description: 'Fun for the whole family - kids shows, educational events and more',
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'category-family',
  },
  other: {
    title: 'Other Events',
    description: 'Workshops, networking, wellness and community events',
    icon: Sparkles,
    color: 'text-sky-600 dark:text-sky-400',
    badgeClass: 'category-other',
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

  const { events, pagination } = await response.json();
  const { totalEvents, totalPages } = pagination;

  if (events.length === 0) {
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
        {events.map((event: any) => (
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
  const info = CATEGORY_CONFIG[slug];

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
  const categoryInfo = CATEGORY_CONFIG[slug];

  if (!categoryInfo) {
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

  const categoryConfig = CATEGORIES.find(c => c.value === slug);
  const Icon = categoryInfo.icon;
  const suspenseKey = `${slug}-${currentPage}-${subcategory}-${dateFilter}-${freeOnly}`;

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="page-header">
        <div className="container-page">
          <BackButton fallbackUrl="/" className="mb-8" />

          <div className="flex items-start gap-4 mb-4">
            <div className="icon-container">
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
          <div className="container-page py-6">
            <div className="flex flex-wrap gap-2">
              <Link href={`/category/${slug}`}>
                <Badge
                  variant="outline"
                  className={`cursor-pointer text-sm px-4 py-2 ${!subcategory ? categoryInfo.badgeClass : 'badge-outline-hover'
                    }`}
                >
                  All
                </Badge>
              </Link>
              {categoryConfig.subcategories.map((sub) => (
                <Link
                  key={sub}
                  href={`/category/${slug}?subcategory=${encodeURIComponent(sub)}`}
                >
                  <Badge
                    variant="outline"
                    className={`cursor-pointer text-sm px-4 py-2 ${subcategory === sub ? categoryInfo.badgeClass : 'badge-outline-hover'
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
      <section className="container-page section-spacing animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
          <CategoryEventsGrid
            categoryValue={slug}
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