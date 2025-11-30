// components/recommendations/ForYouSection.tsx
'use client';

import { useEffect, useState } from 'react';
import { Heart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EventCarousel } from '@/components/events/EventCarousel';
import { EventSection } from '@/components/events/EventSection';
import { CarouselSkeleton } from '@/components/skeletons/CarouselSkeleton';
import Link from 'next/link';

interface ForYouSectionProps {
    userFavourites: Set<string>;
}

export function ForYouSection({ userFavourites }: ForYouSectionProps) {
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPersonalized, setIsPersonalized] = useState(false);

    useEffect(() => {
        async function fetchRecommendations() {
            try {
                const timestamp = Date.now();
                const res = await fetch(`/api/recommendations?limit=12&t=${timestamp}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                    },
                    cache: 'no-store',
                });

                const data = await res.json();

                if (!res.ok || !data.recommendations) {
                    setEvents([]);
                    return;
                }

                setEvents(data.recommendations || []);
                setIsPersonalized(data.isPersonalized || false);
            } catch (error) {
                console.error('[ForYou] Error fetching recommendations:', error);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchRecommendations();
    }, []);

    if (isLoading) {
        return (
            <CarouselSkeleton
                icon={<Heart className="h-6 w-6 text-primary" />}
                borderClass="border-primary/20"
                gradientClass="from-primary/5"
            />
        );
    }

    if (!events || events.length === 0) {
        return (
            <EventSection
                title="For You"
                description="Personalized recommendations based on your favorites"
                icon={<Heart className="h-6 w-6 text-primary" />}
                borderClass="border-primary/20"
                gradientClass="from-primary/5"
                isEmpty
            >
                <div className="text-center py-8 space-y-4">
                    <p className="text-muted-foreground">
                        We're still learning your preferences!
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Start favoriting events to get personalized recommendations tailored just for you.
                    </p>
                    <Button asChild className="mt-4 hover-lift group">
                        <Link href="/events">
                            Browse Events
                            <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </Button>
                </div>
            </EventSection>
        );
    }

    return (
        <EventCarousel
            events={events}
            userFavourites={userFavourites}
            title="For You"
            description={
                isPersonalized
                    ? "Personalized recommendations based on your favorites"
                    : "Discover great events happening in Melbourne"
            }
            icon={<Heart className="h-6 w-6 text-primary" />}
            source="recommendation"
            borderClass="border-primary/20"
            gradientClass="from-primary/5"
            autoScroll
            showProgress
        />
    );
}