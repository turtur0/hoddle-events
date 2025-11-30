// components/recommendations/TrendingSection.tsx
'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Sparkles, Rocket, LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EventCarousel } from '@/components/events/EventCarousel';
import { CarouselSkeleton } from '@/components/skeletons/CarouselSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface TrendingSectionProps {
    userFavourites: Set<string>;
}

type TrendingType = 'trending' | 'rising' | 'undiscovered';

interface TrendingConfig {
    title: string;
    description: string;
    icon: LucideIcon;
}

const TRENDING_CONFIG: Record<TrendingType, TrendingConfig> = {
    trending: {
        title: 'Trending Now',
        description: "Popular events everyone's talking about",
        icon: TrendingUp,
    },
    rising: {
        title: 'Rising Stars',
        description: 'Fast-growing events gaining momentum',
        icon: Rocket,
    },
    undiscovered: {
        title: 'Hidden Gems',
        description: 'Quality events waiting to be discovered',
        icon: Sparkles,
    },
};

export function TrendingSection({ userFavourites }: TrendingSectionProps) {
    const [type, setType] = useState<TrendingType>('trending');
    const [events, setEvents] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const config = TRENDING_CONFIG[type];
    const Icon = config.icon;

    // Fetch events when type changes
    useEffect(() => {
        async function fetchEvents() {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/recommendations/trending?type=${type}&limit=12`);
                const data = await res.json();

                setEvents(res.ok && data.events ? data.events : []);
            } catch (error) {
                console.error('Error fetching trending events:', error);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        }

        fetchEvents();
    }, [type]);

    // Render tabs component
    const renderTabs = () => (
        <Tabs value={type} onValueChange={(v) => setType(v as TrendingType)}>
            <TabsList className="bg-muted/50">
                <TabsTrigger
                    value="trending"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300 hover:bg-primary/5 hover:scale-105"
                >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Trending
                </TabsTrigger>
                <TabsTrigger
                    value="rising"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300 hover:bg-primary/5 hover:scale-105"
                >
                    <Rocket className="h-4 w-4 mr-2" />
                    Rising
                </TabsTrigger>
                <TabsTrigger
                    value="undiscovered"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300 hover:bg-primary/5 hover:scale-105"
                >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Hidden Gems
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );

    // Loading state
    if (isLoading) {
        return (
            <CarouselSkeleton
                icon={<Icon className="h-6 w-6 text-primary" />}
                borderClass="border-primary/20"
                gradientClass="from-primary/5"
            />
        );
    }

    // Empty state
    if (!events || events.length === 0) {
        return (
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent shadow-sm transition-all">
                <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex-1 min-w-0">
                            <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                                <Icon className="h-6 w-6 text-primary" />
                                {config.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {config.description}
                            </p>
                        </div>
                    </div>
                    {renderTabs()}
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                        No {type} events at the moment. Try another category!
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Carousel with events
    return (
        <EventCarousel
            events={events}
            userFavourites={userFavourites}
            title={config.title}
            description={config.description}
            icon={<Icon className="h-6 w-6 text-primary" />}
            borderClass="border-primary/20"
            gradientClass="from-primary/5"
            autoScroll
            showProgress
        >
            {renderTabs()}
        </EventCarousel>
    );
}