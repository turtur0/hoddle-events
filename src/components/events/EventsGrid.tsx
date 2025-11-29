// components/events/EventsGrid.tsx
import { EventCard } from './EventCard';
import { EventCardSkeleton } from './EventCardSkeleton';
import { EmptyState } from '@/components/other/EmptyState';
import { Pagination } from '@/components/other/Pagination';

interface EventsGridProps {
    events: any[];
    totalEvents: number;
    totalPages: number;
    currentPage: number;
    userFavourites: Set<string>;
    source?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    showCount?: boolean;
}

export function EventsGrid({
    events,
    totalEvents,
    totalPages,
    currentPage,
    userFavourites,
    source = 'direct',
    emptyTitle = 'No events found',
    emptyDescription = 'No events match your criteria. Try adjusting your filters.',
    showCount = true,
}: EventsGridProps) {
    if (events.length === 0) {
        return (
            <EmptyState
                title={emptyTitle}
                description={emptyDescription}
            />
        );
    }

    return (
        <>
            {/* Count */}
            {showCount && (
                <div className="mb-6">
                    <p className="text-sm text-muted-foreground">
                        {currentPage > 1 ? (
                            <>
                                Showing <strong className="text-foreground">{((currentPage - 1) * events.length) + 1}</strong> - <strong className="text-foreground">{Math.min(currentPage * events.length, totalEvents)}</strong> of{' '}
                            </>
                        ) : (
                            <>Found </>
                        )}
                        <strong className="text-foreground">{totalEvents.toLocaleString()}</strong> event{totalEvents !== 1 ? 's' : ''}
                    </p>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {events.map((event) => (
                    <EventCard
                        key={event._id}
                        event={event}
                        initialFavourited={userFavourites.has(event._id)}
                    />
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination currentPage={currentPage} totalPages={totalPages} />
            )}
        </>
    );
}

export { EventsGrid as default };

export function EventsGridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
                <EventCardSkeleton key={i} />
            ))}
        </div>
    );
}