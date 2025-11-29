import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventsPageLayout } from '@/components/layout/EventsPageLayout';
import { EventsGrid, EventsGridSkeleton } from "@/components/events/EventsGrid";
import { SearchBar } from '@/components/search/SearchBar';
import { EventFilters } from '@/components/events/EventFilters';
import { Badge } from '@/components/ui/Badge';
import { Suspense } from "react";
import { CATEGORIES } from "@/lib/constants/categories";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Music, Theater, Trophy, Palette, Users, Sparkles, LucideIcon } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
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

async function CategoryEventsGridWrapper({
  categoryValue,
  page,
  searchQuery,
  subcategory,
  dateFilter,
  freeOnly,
  userFavourites,
}: {
  categoryValue: string;
  page: number;
  searchQuery: string;
  subcategory: string;
  dateFilter: string;
  freeOnly: boolean;
  userFavourites: Set<string>;
}) {
  const params = new URLSearchParams({
    page: page.toString(),
    category: categoryValue,
  });

  if (searchQuery.trim()) params.set('q', searchQuery.trim());
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

  return (
    <EventsGrid
      events={events}
      totalEvents={totalEvents}
      totalPages={totalPages}
      currentPage={page}
      userFavourites={userFavourites}
      emptyTitle="No events found"
      emptyDescription="No events in this category right now. Check back soon!"
    />
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
  const searchQuery = searchParamsResolved.q || '';
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
  const suspenseKey = `${slug}-${currentPage}-${searchQuery}-${subcategory}-${dateFilter}-${freeOnly}`;

  return (
    <EventsPageLayout
      icon={categoryInfo.icon}
      iconColor={categoryInfo.color}
      title={categoryInfo.title}
      description={categoryInfo.description}
      filters={
        <div className="space-y-4">
          <SearchBar placeholder={`Search ${categoryInfo.title.toLowerCase()}...`} />

          {/* Subcategories */}
          {categoryConfig?.subcategories && categoryConfig.subcategories.length > 0 && (
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
          )}

          <EventFilters />
        </div>
      }
    >
      <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
        <CategoryEventsGridWrapper
          categoryValue={slug}
          page={currentPage}
          searchQuery={searchQuery}
          subcategory={subcategory}
          dateFilter={dateFilter}
          freeOnly={freeOnly}
          userFavourites={userFavourites}
        />
      </Suspense>
    </EventsPageLayout>
  );
}