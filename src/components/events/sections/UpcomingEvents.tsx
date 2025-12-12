'use client';

import { useEffect, useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EventCarousel } from '@/components/events/sections/EventCarousel';
import { CarouselSkeleton } from '@/components/other/CarouselSkeleton';
import Link from 'next/link';

interface UpcomingEventsProps {
    userFavourites: Set<string>;
}

export function UpcomingEvents({ userFavourites }: UpcomingEventsProps) {
    const [thisWeekEvents, setThisWeekEvents] = useState<any[]>([]);
    const [thisMonthEvents, setThisMonthEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchEvents() {
            try {
                const now = new Date();
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const dateToParam = endOfMonth.toISOString().split('T')[0];

                const res = await fetch(`/api/events?sort=date-soon&dateTo=${dateToParam}`);
                if (!res.ok) throw new Error('Failed to fetch events');

                const { events = [] } = await res.json();

                // Split events into this week and later
                const weekEnd = new Date(now);
                weekEnd.setDate(now.getDate() + 7);

                const week = events.filter((e: any) => new Date(e.startDate) <= weekEnd).slice(0, 12);
                const later = events.filter((e: any) => new Date(e.startDate) > weekEnd).slice(0, 12);

                setThisWeekEvents(week);
                setThisMonthEvents(later);
            } catch (error) {
                console.error('[UpcomingEvents] Error:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchEvents();
    }, []);

    if (isLoading) {
        return (
            <CarouselSkeleton
                icon={<Calendar className="h-6 w-6 text-primary" />}
                borderClass="border-primary/20"
                gradientClass="from-primary/5"
            />
        );
    }

    if (thisWeekEvents.length === 0 && thisMonthEvents.length === 0) {
        return (
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Calendar className="h-6 w-6 text-primary" />
                        Upcoming Events
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Don't miss what's happening in Melbourne</p>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 space-y-4">
                        <p className="text-muted-foreground">No upcoming events at the moment.</p>
                        <Button asChild className="mt-4 hover-lift group">
                            <Link href="/events">
                                Browse All Events
                                <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {thisWeekEvents.length > 0 && (
                <EventCarousel
                    events={thisWeekEvents}
                    userFavourites={userFavourites}
                    title="This Week"
                    icon={<Calendar className="h-6 w-6 text-primary" />}
                    source="homepage"
                    borderClass="border-primary/20"
                    gradientClass="from-primary/5"
                    autoScroll={true}
                    autoScrollInterval={5000}
                    showProgress={true}
                />
            )}

            {thisMonthEvents.length > 0 && (
                <EventCarousel
                    events={thisMonthEvents}
                    userFavourites={userFavourites}
                    title="Coming This Month"
                    icon={<Calendar className="h-6 w-6 text-primary" />}
                    source="homepage"
                    borderClass="border-secondary/20"
                    gradientClass="from-secondary/5"
                    autoScroll={true}
                    autoScrollInterval={5000}
                    showProgress={true}
                />
            )}
        </div>
    );
}