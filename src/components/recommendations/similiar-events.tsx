'use client';

import { useEffect, useState } from 'react';
import { EventCard } from '../events/event-card';
import { Loader2 } from 'lucide-react';

interface SimilarEventsProps {
    eventId: string;
}

export function SimilarEvents({ eventId }: SimilarEventsProps) {
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchSimilar() {
            try {
                const res = await fetch(`/api/recommendations/similar/${eventId}`);
                const data = await res.json();
                setEvents(data.similarEvents);
            } catch (error) {
                console.error('Error fetching similar events:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchSimilar();
    }, [eventId]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (events.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-xl font-bold">Similar Events</h3>
                <p className="text-sm text-muted-foreground">
                    {events.length} events you might like
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map(event => (
                    <EventCard key={event._id} event={event} />
                ))}
            </div>
        </div>
    );
}