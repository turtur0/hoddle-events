// components/events/UpcomingEvents.tsx
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Clock } from "lucide-react";
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/events/EventCard';
import { EventSection } from '@/components/events/EventSection';
import { connectDB } from "@/lib/db";
import { Event } from '@/lib/models';

interface UpcomingEventsProps {
    userFavourites: Set<string>;
}

function mapToObject(map: any): Record<string, string> {
    if (!map) return {};
    if (typeof map.get === 'function') {
        const obj: Record<string, string> = {};
        for (const [key, value] of map) {
            obj[key] = value;
        }
        return obj;
    }
    return map;
}

function serializeEvent(e: any) {
    return {
        _id: e._id.toString(),
        title: e.title,
        description: e.description,
        category: e.category,
        subcategories: e.subcategories || [],
        startDate: e.startDate.toISOString(),
        endDate: e.endDate?.toISOString(),
        venue: e.venue,
        priceMin: e.priceMin,
        priceMax: e.priceMax,
        isFree: e.isFree,
        bookingUrl: e.bookingUrl,
        bookingUrls: mapToObject(e.bookingUrls),
        imageUrl: e.imageUrl,
        sources: e.sources || [],
        primarySource: e.primarySource,
        sourceIds: mapToObject(e.sourceIds),
        accessibility: e.accessibility || [],
        scrapedAt: e.scrapedAt.toISOString(),
        lastUpdated: e.lastUpdated.toISOString(),
        stats: e.stats || { viewCount: 0, favouriteCount: 0, clickthroughCount: 0 },
    };
}

export async function UpcomingEvents({ userFavourites }: UpcomingEventsProps) {
    await connectDB();

    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);

    const [thisWeekEvents, upcomingEvents] = await Promise.all([
        Event.find({
            startDate: { $gte: now, $lte: endOfWeek },
            imageUrl: { $exists: true, $ne: null },
        })
            .sort({ startDate: 1 })
            .limit(6)
            .lean(),
        Event.find({
            startDate: { $gt: endOfWeek },
            imageUrl: { $exists: true, $ne: null },
        })
            .sort({ startDate: 1 })
            .limit(6)
            .lean(),
    ]);

    const serializedThisWeek = thisWeekEvents.map(serializeEvent);
    const serializedUpcoming = upcomingEvents.map(serializeEvent);

    if (serializedThisWeek.length === 0 && serializedUpcoming.length === 0) {
        return (
            <EventSection
                title="Upcoming Events"
                description="Don't miss what's happening in Melbourne"
                icon={<Calendar className="h-6 w-6 text-primary" />}
                viewAllHref="/events"
                borderClass="border-primary/20"
                gradientClass="from-primary/5"
                isEmpty
                emptyMessage="No upcoming events at the moment. Check back soon!"
            />
        );
    }

    return (
        <EventSection
            title="Upcoming Events"
            description="Don't miss what's happening in Melbourne"
            icon={<Calendar className="h-6 w-6 text-primary" />}
            viewAllHref="/events"
            borderClass="border-primary/20"
            gradientClass="from-primary/5"
        >
            <div className="space-y-8">
                {/* This Week - Compact list */}
                {serializedThisWeek.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">This Week</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="text-muted-foreground hover:text-secondary hover:bg-secondary/10 transition-all group"
                            >
                                <Link href="/events?date=this-week" className="flex items-center">
                                    View all
                                    <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {serializedThisWeek.map((event) => {
                                const startDate = new Date(event.startDate);
                                const dayName = startDate.toLocaleDateString('en-AU', { weekday: 'short' });
                                const day = startDate.getDate();
                                const month = startDate.toLocaleDateString('en-AU', { month: 'short' });
                                const time = startDate.toLocaleTimeString('en-AU', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                });

                                return (
                                    <Link
                                        key={event._id}
                                        href={`/events/${event._id}`}
                                        className="group flex gap-4 p-4 rounded-lg border-2 border-border/50 bg-card hover:bg-secondary/10 hover:border-secondary/50 hover:shadow-md transition-all duration-200 hover-lift"
                                    >
                                        <div className="shrink-0 w-16 h-16 rounded-lg border-2 border-secondary/20 bg-secondary/5 flex flex-col items-center justify-center group-hover:bg-secondary/15 group-hover:border-secondary/40 group-hover:scale-105 transition-all">
                                            <span className="text-xs font-medium text-muted-foreground uppercase">
                                                {dayName}
                                            </span>
                                            <span className="text-2xl font-bold text-secondary">
                                                {day}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase">
                                                {month}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-semibold line-clamp-2 mb-1 group-hover:text-secondary transition-colors">
                                                {event.title}
                                            </h4>
                                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5 mb-1">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{event.venue.name}</span>
                                            </p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                                {time}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Coming Soon - Grid */}
                {serializedUpcoming.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Coming Soon</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all group"
                            >
                                <Link href="/events" className="flex items-center">
                                    View all
                                    <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {serializedUpcoming.map((event) => (
                                <EventCard
                                    key={event._id}
                                    event={event}
                                    source="homepage"
                                    initialFavourited={userFavourites.has(event._id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </EventSection>
    );
}