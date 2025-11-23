// components/recommendations/trending-section.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { EventCard } from '@/components/events/event-card';
import { Loader2, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TrendingSectionProps {
    userFavourites: Set<string>;
}

export function TrendingSection({ userFavourites }: TrendingSectionProps) {
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchTrending() {
            try {
                const res = await fetch('/api/recommendations/trending?limit=12');
                const data = await res.json();

                if (!res.ok || !data.events) {
                    setEvents([]);
                    return;
                }

                setEvents(data.events || []);
            } catch (error) {
                console.error('Error fetching trending:', error);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchTrending();
    }, []);

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
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <TrendingUp className="h-6 w-6 text-orange-500" />
                        Trending Now
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

    // Show empty state if no events
    if (!events || events.length === 0) {
        return (
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                        <TrendingUp className="h-6 w-6 text-orange-500" />
                        Trending Now
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Popular events everyone's talking about
                    </p>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                        No trending events at the moment. Check back soon to see what's hot!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="relative overflow-hidden border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            <TrendingUp className="h-6 w-6 text-orange-500" />
                            Trending Now
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Popular events everyone's talking about
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePrevious}
                            className="h-9 w-9"
                            aria-label="Previous event"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleNext}
                            className="h-9 w-9"
                            aria-label="Next event"
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
                                    ? 'w-8 bg-orange-500'
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