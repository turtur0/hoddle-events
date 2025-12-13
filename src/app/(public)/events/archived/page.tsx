import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { Metadata } from "next";
import { Archive } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EventsPageLayout } from '@/components/layout/EventsPageLayout';
import { EventsGrid, EventsGridSkeleton } from '@/components/events/sections/EventsGrid';
import { SearchBar } from '@/components/events/filters/SearchBar';
import { EventFilters } from '@/components/events/filters/EventFilters';
import { SerialisedEvent } from "@/lib/models/Event";
import { getUserFavourites } from "@/lib/actions/interactions";

export const metadata: Metadata = {
    title: "Archived Events | Hoddle",
    description: "Browse Melbourne's event history. Explore past concerts, shows, festivals and cultural events for research and reference.",
    openGraph: {
        title: "Archived Events | Hoddle",
        description: "Browse Melbourne's event history and explore past concerts, shows and festivals.",
    },
};

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
    const params = new URLSearchParams({ page: props.page.toString() });

    // Apply filters
    if (props.searchQuery.trim()) params.set('q', props.searchQuery.trim());
    if (props.category) params.set('category', props.category);
    if (props.subcategory) params.set('subcategory', props.subcategory);
    if (props.freeOnly) params.set('free', 'true');
    if (props.sortOption) params.set('sort', props.sortOption);

    const data = await fetchArchivedEvents(params);
    const events: SerialisedEvent[] = data.events;
    const { totalEvents, totalPages } = data.pagination;

    const source = props.searchQuery ? 'search' : props.category ? 'category_browse' : 'direct';
    const hasFilters = props.searchQuery || props.category || props.subcategory || props.freeOnly;

    return (
        <EventsGrid
            events={events}
            totalEvents={totalEvents}
            totalPages={totalPages}
            currentPage={props.page}
            userFavourites={props.userFavourites}
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
    const session = await getServerSession(authOptions);

    // Parse search parameters
    const currentPage = Number(params.page) || 1;
    const searchQuery = params.q || '';
    const category = params.category || '';
    const subcategory = params.subcategory || '';
    const freeOnly = params.free === 'true';
    const sortOption = params.sort || 'date-recent';

    // Get user favourites
    let userFavourites = new Set<string>();
    if (session?.user?.id) {
        const favouriteIds = await getUserFavourites(session.user.id);
        userFavourites = new Set(favouriteIds);
    }

    // Create unique key for Suspense
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
                        isAuthenticated={!!session?.user}
                        hideRecommendedSort={true}
                        hideDateFilters={true}
                        hideAccessibilityFilter={true}
                        isArchived={true}
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