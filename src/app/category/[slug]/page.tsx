import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventCard } from "@/components/events/event-card";
import { EventCardSkeleton } from "@/components/events/event-card-skeleton";
import { EmptyState } from "@/components/other/empty-state";
import { Pagination } from "@/components/other/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import { CATEGORIES } from "@/lib/categories";
import { getUserFavourites } from "@/actions/interactions";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    subcategory?: string;
    date?: string;
    free?: string;
  }>;
}

// Map URL slugs to actual category values in your database
const SLUG_TO_CATEGORY: Record<string, string> = {
  'music': 'music',
  'theatre': 'theatre',
  'sports': 'sports',
  'arts': 'arts',
  'family': 'family',
  'other': 'other',
};

const CATEGORY_INFO: Record<string, { title: string; description: string }> = {
  'music': {
    title: 'Live Music & Concerts',
    description: 'From intimate gigs to stadium shows, find your next musical experience',
  },
  'theatre': {
    title: 'Theatre & Performing Arts',
    description: 'Plays, musicals, ballet, opera and more on Melbourne\'s stages',
  },
  'sports': {
    title: 'Sports & Games',
    description: 'AFL, cricket, tennis and all the sporting action in Melbourne',
  },
  'arts': {
    title: 'Arts & Culture',
    description: 'Exhibitions, festivals, film screenings and cultural events',
  },
  'family': {
    title: 'Family Events',
    description: 'Fun for the whole family - kids shows, educational events and more',
  },
  'other': {
    title: 'Other Events',
    description: 'Workshops, networking, wellness and community events',
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
      <div className="mb-4 text-sm text-muted-foreground">
        Found <strong>{totalEvents}</strong> event{totalEvents !== 1 ? 's' : ''}
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

  // Get user's favourites if logged in
  const session = await getServerSession(authOptions);
  let userFavourites = new Set<string>();

  if (session?.user?.id) {
    const favouriteIds = await getUserFavourites(session.user.id);
    userFavourites = new Set(favouriteIds);
  }

  // Find category config for subcategories from your CATEGORIES array
  const categoryConfig = CATEGORIES.find(c => c.value === categoryValue);

  const suspenseKey = `${slug}-${currentPage}-${subcategory}-${dateFilter}-${freeOnly}`;

  return (
    <div className="w-full">
      {/* Header Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>

          <h1 className="text-4xl sm:text-5xl font-bold mb-3">{categoryInfo.title}</h1>
          <p className="text-lg text-muted-foreground">{categoryInfo.description}</p>
        </div>
      </section>

      {/* Subcategories */}
      {categoryConfig?.subcategories && categoryConfig.subcategories.length > 0 && (
        <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap gap-3">
            <Link href={`/category/${slug}`}>
              <Badge
                variant={!subcategory ? "default" : "outline"}
                className="cursor-pointer text-sm px-4 py-2"
              >
                All
              </Badge>
            </Link>
            {categoryConfig.subcategories.map((sub) => (
              <Link key={sub} href={`/category/${slug}?subcategory=${encodeURIComponent(sub)}`}>
                <Badge
                  variant={subcategory === sub ? "default" : "outline"}
                  className="cursor-pointer text-sm px-4 py-2"
                >
                  {sub}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Events Grid */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
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
