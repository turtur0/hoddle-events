'use client';

import { useEffect, useState } from 'react';
import { EventCard } from '@/components/events/event-card';
import { Loader2, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface ForYouSectionProps {
    userFavourites: Set<string>;
}

export function ForYouSection({ userFavourites }: ForYouSectionProps) {
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchRecommendations() {
            try {
                const res = await fetch('/api/recommendations?limit=6');
                const data = await res.json();
                setEvents(data.recommendations);
            } catch (error) {
                console.error('Error fetching recommendations:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchRecommendations();
    }, []);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5" />
                        For You
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (events.length === 0) {
        return null;
    }

    return (
        <Card className="bg-linear-to-br from-primary/5 to-transparent border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" />
                    For You
                </CardTitle>
                <p className="text-sm text-muted-foreground">Personalised recommendations based on your preferences</p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map(event => (
                        <EventCard
                            key={event._id}
                            event={event}
                            source="recommendation"
                            initialFavourited={userFavourites.has(event._id)}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}