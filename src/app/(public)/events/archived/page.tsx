// app/(public)/events/archived/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { EventsPageLayout } from '@/components/layout/EventsPageLayout';
import { EventsGrid, EventsGridSkeleton } from '@/components/events/sections/EventsGrid';
import { SearchBar } from '@/components/events/filters/SearchBar';
import { EventFilters } from '@/components/events/filters/EventFilters';
import { Suspense } from "react";
import { SerializedEvent } from "@/lib/models/Event";
import { getUserFavourites } from "@/lib/actions/interactions";
import { Archive } from "lucide-react";

interface ArchivedEventsPageProps {
    searchParams: Promise<{
        page?: string;
        q?: string;
        category?: string;
        subcategory?: string;
        free?: string;
        sort?: string;
    }>;
}

async function fetchArchivedEvents(params: URLSearchParams) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/events/archived?${params.toString()}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch archived events');
    }

    return response.json();
}

interface ArchivedEventsGridWrapperProps {
    page: number;
    searchQuery: string;
    category: string;
    subcategory: string;
    freeOnly: boolean;
    sortOption: string;
    userFavourites: Set<string>;
}

async function ArchivedEventsGridWrapper(props: ArchivedEventsGridWrapperProps) {
    const {
        page,
        searchQuery,
        category,
        subcategory,
        freeOnly,
        sortOption,
        userFavourites,
    } = props;

    const params = new URLSearchParams({ page: page.toString() });

    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (freeOnly) params.set('free', 'true');
    if (sortOption) params.set('sort', sortOption);

    const data = await fetchArchivedEvents(params);
    const eventsData: SerializedEvent[] = data.events;
    const { totalEvents, totalPages } = data.pagination;

    const source = searchQuery ? 'search' : category ? 'category_browse' : 'direct';
    const hasFilters = searchQuery || category || subcategory || freeOnly;

    return (
        <EventsGrid
            events={eventsData}
            totalEvents={totalEvents}
            totalPages={totalPages}
            currentPage={page}
            userFavourites={userFavourites}
            source={source}
            emptyTitle={hasFilters ? "No archived events found" : "No archived events yet"}
            emptyDescription={
                hasFilters
                    ? "No archived events match your filters. Try adjusting your search criteria."
                    : "Past events will appear here once they've been archived."
            }
        />
    );
}

export default async function ArchivedEventsPage({ searchParams }: ArchivedEventsPageProps) {
    const params = await searchParams;

    const currentPage = Number(params.page) || 1;
    const searchQuery = params.q || '';
    const category = params.category || '';
    const subcategory = params.subcategory || '';
    const freeOnly = params.free === 'true';
    const sortOption = params.sort || 'date-recent';

    const session = await getServerSession(authOptions);
    const isAuthenticated = Boolean(session?.user);

    let userFavourites = new Set<string>();
    if (session?.user?.id) {
        const favouriteIds = await getUserFavourites(session.user.id);
        userFavourites = new Set(favouriteIds);
    }

    const suspenseKey = `archived-${currentPage}-${searchQuery}-${category}-${subcategory}-${freeOnly}-${sortOption}`;

    return (
        <EventsPageLayout
            icon={Archive}
            iconColor="text-muted-foreground"
            iconBgColor="bg-muted/50 ring-1 ring-border"
            title={searchQuery ? `Archived: "${searchQuery}"` : 'Archived Events'}
            description="Browse past events and shows from Melbourne's event history"
            filters={
                <div className="space-y-4">
                    <SearchBar placeholder="Search archived events..." />
                    <EventFilters
                        isAuthenticated={isAuthenticated}
                    />
                </div>
            }
        >
            <Suspense fallback={<EventsGridSkeleton />} key={suspenseKey}>
                <ArchivedEventsGridWrapper
                    page={currentPage}
                    searchQuery={searchQuery}
                    category={category}
                    subcategory={subcategory}
                    freeOnly={freeOnly}
                    sortOption={sortOption}
                    userFavourites={userFavourites}
                />
            </Suspense>
        </EventsPageLayout>
    );
}