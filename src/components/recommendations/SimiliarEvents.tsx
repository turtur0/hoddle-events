'use client';

import { useEffect, useState, useRef } from 'react';
import { EventCard } from '@/components/events/EventCard';
import { Loader2, Sparkles, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

interface SimilarEventsProps {
    eventId: string;
    userFavourites: Set<string>;
}

export function SimilarEvents({ eventId, userFavourites }: SimilarEventsProps) {
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchSimilar() {
            try {
                const res = await fetch(`/api/recommendations/similar/${eventId}`);

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || 'Failed to fetch similar events');
                }

                const data = await res.json();

                if (!data.similarEvents || data.similarEvents.length === 0) {
                    setEvents([]);
                    return;
                }

                setEvents(data.similarEvents);
            } catch (error) {
                console.error('Error fetching similar events:', error);
                setError('Unable to load similar events');
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        if (eventId) {
            fetchSimilar();
        }
    }, [eventId]);

    // Smooth scroll to current index
    useEffect(() => {
        if (!scrollContainerRef.current || !events) return;

        const container = scrollContainerRef.current;
        const cardWidth = container.scrollWidth / events.length;
        const scrollPosition = currentIndex * cardWidth;

        container.scrollTo({
            left: scrollPosition,
            behavior: 'smooth'
        });
    }, [currentIndex, events]);

    const handlePrevious = () => {
        if (!events) return;
        setCurrentIndex((prev) => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        if (!events) return;
        setCurrentIndex((prev) => Math.min(events.length - 1, prev + 1));
    };

    const canScrollLeft = currentIndex > 0;
    const canScrollRight = events && currentIndex < events.length - 1;

    if (isLoading) {
        return (
            <Card className="border-purple-500/20 bg-linear-to-br from-purple-500/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Sparkles className="h-6 w-6 text-purple-500" />
                        You Might Also Like
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
                        <p className="text-sm text-muted-foreground">Finding similar events...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!events || events.length === 0) {
        return null;
    }

    return (
        <Card className="relative overflow-hidden border-purple-500/20 bg-linear-to-br from-purple-500/5 to-transparent">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            <Sparkles className="h-6 w-6 text-purple-500" />
                            You Might Also Like
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {events.length} similar {events.length === 1 ? 'event' : 'events'} in the same category
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePrevious}
                            disabled={!canScrollLeft}
                            className="h-9 w-9"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleNext}
                            disabled={!canScrollRight}
                            className="h-9 w-9"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div
                    ref={scrollContainerRef}
                    className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {events.map((event) => (
                        <div
                            key={event._id}
                            className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start"
                        >
                            <EventCard
                                event={event}
                                source="similar_events"
                                initialFavourited={userFavourites.has(event._id)}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}