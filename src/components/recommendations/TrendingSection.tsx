// components/recommendations/trending-section.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { EventCard } from '@/components/events/EventCard';
import { Loader2, TrendingUp, Sparkles, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

interface TrendingSectionProps {
    userFavourites: Set<string>;
}

type TrendingType = 'trending' | 'rising' | 'undiscovered';

const TRENDING_CONFIG = {
    trending: {
        title: 'Trending Now',
        description: "Popular events everyone's talking about",
        icon: TrendingUp,
        color: 'orange',
    },
    rising: {
        title: 'Rising Stars',
        description: 'Fast-growing events gaining momentum',
        icon: Rocket,
        color: 'purple',
    },
    undiscovered: {
        title: 'Hidden Gems',
        description: 'Quality events waiting to be discovered',
        icon: Sparkles,
        color: 'blue',
    },
};

export function TrendingSection({ userFavourites }: TrendingSectionProps) {
    const [type, setType] = useState<TrendingType>('trending');
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const config = TRENDING_CONFIG[type];
    const Icon = config.icon;

    useEffect(() => {
        async function fetchEvents() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/recommendations/trending?type=${type}&limit=12`);
                const data = await res.json();

                if (!res.ok || !data.events) {
                    setEvents([]);
                    return;
                }

                setEvents(data.events || []);
                setCurrentIndex(0); // Reset to first event when switching types
            } catch (error) {
                console.error('Error fetching events:', error);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchEvents();
    }, [type]);

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

    // Get border and gradient colors based on type
    const getBorderColor = () => {
        switch (config.color) {
            case 'orange': return 'border-orange-500/20';
            case 'purple': return 'border-purple-500/20';
            case 'blue': return 'border-blue-500/20';
            default: return 'border-orange-500/20';
        }
    };

    const getGradientColor = () => {
        switch (config.color) {
            case 'orange': return 'from-orange-500/5';
            case 'purple': return 'from-purple-500/5';
            case 'blue': return 'from-blue-500/5';
            default: return 'from-orange-500/5';
        }
    };

    const getIconColor = () => {
        switch (config.color) {
            case 'orange': return 'text-orange-500';
            case 'purple': return 'text-purple-500';
            case 'blue': return 'text-blue-500';
            default: return 'text-orange-500';
        }
    };

    if (isLoading) {
        return (
            <Card className={`${getBorderColor()} bg-linear-to-br ${getGradientColor()} to-transparent`}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Icon className={`h-6 w-6 ${getIconColor()}`} />
                        {config.title}
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
            <Card className={`${getBorderColor()} bg-linear-to-br ${getGradientColor()} to-transparent`}>
                <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                                <Icon className={`h-6 w-6 ${getIconColor()}`} />
                                {config.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {config.description}
                            </p>
                        </div>
                    </div>
                    <Tabs value={type} onValueChange={(v) => setType(v as TrendingType)}>
                        <TabsList>
                            <TabsTrigger value="trending">Trending</TabsTrigger>
                            <TabsTrigger value="rising">Rising</TabsTrigger>
                            <TabsTrigger value="undiscovered">Hidden Gems</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                        No {type} events at the moment. Try another category!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`relative overflow-hidden ${getBorderColor()} bg-linear-to-br ${getGradientColor()} to-transparent`}>
            <CardHeader>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            <Icon className={`h-6 w-6 ${getIconColor()}`} />
                            {config.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {config.description}
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

                <Tabs value={type} onValueChange={(v) => setType(v as TrendingType)}>
                    <TabsList>
                        <TabsTrigger value="trending">Trending</TabsTrigger>
                        <TabsTrigger value="rising">Rising</TabsTrigger>
                        <TabsTrigger value="undiscovered">Hidden Gems</TabsTrigger>
                    </TabsList>
                </Tabs>
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
                                    ? `w-8 ${config.color === 'orange' ? 'bg-orange-500' : config.color === 'purple' ? 'bg-purple-500' : 'bg-blue-500'}`
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