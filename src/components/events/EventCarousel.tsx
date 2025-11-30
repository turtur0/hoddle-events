// components/events/EventCarousel.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { EventCard } from '@/components/events/EventCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SerializedEvent } from '@/lib/models/Event';

interface EventCarouselProps {
    events: SerializedEvent[];
    userFavourites: Set<string>;
    title: string;
    description?: string;
    icon: React.ReactNode;
    source?: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
    borderClass?: string;
    gradientClass?: string;
    autoScroll?: boolean;
    autoScrollInterval?: number;
    showProgress?: boolean;
    children?: React.ReactNode; // For additional header content like tabs
}

export function EventCarousel({
    events,
    userFavourites,
    title,
    description,
    icon,
    source = 'direct',
    borderClass = 'border-primary/20',
    gradientClass = 'from-primary/5',
    autoScroll = true,
    autoScrollInterval = 5000,
    showProgress = true,
    children,
}: EventCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Create infinite loop by tripling the events array
    const infiniteEvents = events.length > 0 ? [...events, ...events, ...events] : [];
    const actualLength = events.length;

    // Auto-scroll functionality
    useEffect(() => {
        if (!autoScroll || actualLength === 0 || isHovered) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => prev + 1);
        }, autoScrollInterval);

        return () => clearInterval(interval);
    }, [autoScroll, autoScrollInterval, actualLength, isHovered]);

    // Handle infinite scrolling with seamless wrapping
    useEffect(() => {
        if (!scrollContainerRef.current || actualLength === 0) return;

        const container = scrollContainerRef.current;
        const containerWidth = container.offsetWidth;
        const gap = 24; // 6 * 4px (gap-6)
        const cardWidth = (containerWidth - gap * 2) / 3; // Account for 3 visible cards

        // Calculate scroll position
        let scrollIndex = currentIndex;
        let shouldAnimate = true;

        // Reset to middle section when reaching boundaries (seamless loop)
        if (currentIndex >= actualLength * 2) {
            // Reached end, jump to start of middle section
            scrollIndex = currentIndex - actualLength;
            setCurrentIndex(scrollIndex);
            shouldAnimate = false;
        } else if (currentIndex < actualLength) {
            // Haven't reached middle section yet, let it scroll naturally
            scrollIndex = currentIndex;
        }

        const scrollPosition = scrollIndex * (cardWidth + gap);

        if (shouldAnimate) {
            // Smooth animated scroll
            container.style.scrollBehavior = 'smooth';
            container.scrollLeft = scrollPosition;
        } else {
            // Instant jump for seamless loop
            container.style.scrollBehavior = 'auto';
            container.scrollLeft = scrollPosition;
            // Re-enable smooth scrolling after jump
            setTimeout(() => {
                container.style.scrollBehavior = 'smooth';
            }, 50);
        }
    }, [currentIndex, actualLength]);

    // Navigation handlers
    const handlePrevious = useCallback(() => {
        setCurrentIndex((prev) => {
            if (prev <= actualLength) {
                // Jump to end of middle section
                return prev + actualLength - 1;
            }
            return prev - 1;
        });
    }, [actualLength]);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => prev + 1);
    }, []);

    // Direct navigation to specific index
    const handleDotClick = useCallback((index: number) => {
        setCurrentIndex(actualLength + index);
    }, [actualLength]);

    // Get normalized index for progress indicators
    const normalizedIndex = currentIndex % actualLength;

    if (actualLength === 0) return null;

    return (
        <Card className={`relative overflow-hidden border-2 ${borderClass} bg-linear-to-br ${gradientClass} via-transparent to-transparent shadow-sm hover:shadow-md hover:border-opacity-50 transition-all`}>
            <CardHeader>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            {icon}
                            {title}
                        </CardTitle>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2 ml-4">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePrevious}
                            className={`h-9 w-9 border-2 ${borderClass} hover:border-opacity-70 hover:bg-opacity-10 transition-all duration-300 hover-lift hover:scale-110 active:scale-95`}
                            aria-label="Previous event"
                        >
                            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleNext}
                            className={`h-9 w-9 border-2 ${borderClass} hover:border-opacity-70 hover:bg-opacity-10 transition-all duration-300 hover-lift hover:scale-110 active:scale-95`}
                            aria-label="Next event"
                        >
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </div>
                </div>

                {/* Additional header content (e.g., tabs) */}
                {children}
            </CardHeader>

            <CardContent>
                {/* Event carousel */}
                <div
                    ref={scrollContainerRef}
                    className="flex gap-6 overflow-x-hidden transition-all duration-500 ease-out"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}
                >
                    {infiniteEvents.map((event, idx) => (
                        <div
                            key={`${event._id}-${idx}`}
                            className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] transition-transform duration-500 ease-out"
                        >
                            <EventCard
                                event={event}
                                source={source}
                                initialFavourited={userFavourites.has(event._id)}
                            />
                        </div>
                    ))}
                </div>

                {/* Progress indicators */}
                {showProgress && actualLength > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        {events.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => handleDotClick(index)}
                                className={`h-1.5 rounded-full transition-all duration-500 ease-out hover:scale-125 ${index === normalizedIndex
                                        ? 'w-8 bg-primary shadow-sm shadow-primary/50'
                                        : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                    }`}
                                aria-label={`Go to event ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}