// components/recommendations/for-you-section.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { EventCard } from '@/components/events/event-card';
import { Loader2, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ForYouSectionProps {
    userFavourites: Set<string>;
}

export function ForYouSection({ userFavourites }: ForYouSectionProps) {
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPersonalized, setIsPersonalized] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [lastFetch, setLastFetch] = useState<string>('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchRecommendations() {
            try {
                // Add cache-busting timestamp and headers
                const timestamp = Date.now();
                const res = await fetch(`/api/recommendations?limit=12&t=${timestamp}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                    },
                    cache: 'no-store', // Prevent fetch cache
                });

                const data = await res.json();

                console.log('[ForYou] API Response:', {
                    isPersonalized: data.isPersonalized,
                    count: data.count,
                    timestamp: data.timestamp,
                    firstEvent: data.recommendations?.[0]?.title
                });

                if (!res.ok || !data.recommendations) {
                    setEvents([]);
                    return;
                }

                setEvents(data.recommendations || []);
                setIsPersonalized(data.isPersonalized || false);
                setLastFetch(data.timestamp || new Date().toISOString());
            } catch (error) {
                console.error('[ForYou] Error fetching recommendations:', error);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchRecommendations();
    }, []); // Only fetch once on mount

    // Auto-scroll effect
    useEffect(() => {
        if (!events || events.length === 0 || isHovered) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % events.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [events, isHovered]);

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
        setCurrentIndex((prev) => (prev - 1 + events.length) % events.length);
    };

    const handleNext = () => {
        if (!events) return;
        setCurrentIndex((prev) => (prev + 1) % events.length);
    };

    if (isLoading) {
        return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Heart className="h-6 w-6 text-primary" />
                        For You
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show empty state with call-to-action
    if (!events || events.length === 0) {
        return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                        <Heart className="h-6 w-6 text-primary" />
                        For You
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Personalized recommendations based on your favorites
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 space-y-4">
                        <p className="text-muted-foreground">
                            We're still learning your preferences!
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Start favoriting events to get personalized recommendations tailored just for you.
                        </p>
                        <Button asChild className="mt-4">
                            <Link href="/events">
                                Browse Events
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            <Heart className="h-6 w-6 text-primary" />
                            For You
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {isPersonalized
                                ? "Personalized recommendations based on your favorites"
                                : "Discover great events happening in Melbourne"
                            }
                        </p>
                        {/* Debug info - remove in production */}
                        {process.env.NODE_ENV === 'development' && (
                            <p className="text-xs text-muted-foreground/50 mt-1">
                                Last fetched: {new Date(lastFetch).toLocaleTimeString()} |
                                Personalized: {isPersonalized ? 'Yes' : 'No'}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePrevious}
                            className="h-9 w-9"
                            aria-label="Previous recommendation"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleNext}
                            className="h-9 w-9"
                            aria-label="Next recommendation"
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
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {events.map((event) => (
                        <div
                            key={event._id}
                            className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start"
                        >
                            <EventCard
                                event={event}
                                source="recommendation"
                                initialFavourited={userFavourites.has(event._id)}
                            />
                        </div>
                    ))}
                </div>

                {/* Progress indicators */}
                <div className="flex justify-center gap-2 mt-6">
                    {events.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex
                                    ? 'w-8 bg-primary'
                                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                }`}
                            aria-label={`Go to event ${index + 1}`}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}