// components/recommendations/SimilarEvents.tsx
'use client';

import { useEffect, useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { EventCarousel } from '@/components/events/EventCarousel';
import { CarouselSkeleton } from '@/components/skeletons/CarouselSkeleton';
import { Card, CardContent } from '@/components/ui/Card';

interface SimilarEventsProps {
    eventId: string;
    userFavourites: Set<string>;
}

export function SimilarEvents({ eventId, userFavourites }: SimilarEventsProps) {
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    if (isLoading) {
        return (
            <CarouselSkeleton
                icon={<Sparkles className="h-6 w-6 text-secondary" />}
                borderClass="border-secondary/20"
                gradientClass="from-secondary/5"
            />
        );
    }

    if (error) {
        return (
            <Card className="border-2">
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
        <EventCarousel
            events={events}
            userFavourites={userFavourites}
            title="You Might Also Like"
            description={`${events.length} similar ${events.length === 1 ? 'event' : 'events'} in the same category`}
            icon={<Sparkles className="h-6 w-6 text-secondary" />}
            source="similar_events"
            borderClass="border-secondary/20"
            gradientClass="from-secondary/5"
            autoScroll={false}
            showProgress={false}
        />
    );
}