import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Clock } from "lucide-react";
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EventCard } from '@/components/events/EventCard';
import { connectDB } from "@/lib/db";
import Event from "@/lib/models/Event";

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

export async function UpcomingEvents({ userFavourites }: UpcomingEventsProps) {
    await connectDB();

    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);

    // Get events happening this week for the compact list
    const thisWeekEvents = await Event.find({
        startDate: { $gte: now, $lte: endOfWeek },
        imageUrl: { $exists: true, $ne: null },
    })
        .sort({ startDate: 1 })
        .limit(6)
        .lean();

    // Get upcoming events beyond this week for the grid
    const upcomingEvents = await Event.find({
        startDate: { $gt: endOfWeek },
        imageUrl: { $exists: true, $ne: null },
    })
        .sort({ startDate: 1 })
        .limit(6)
        .lean();

    const serializeEvent = (e: any) => ({
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
    });

    const serializedThisWeek = thisWeekEvents.map(serializeEvent);
    const serializedUpcoming = upcomingEvents.map(serializeEvent);

    if (serializedThisWeek.length === 0 && serializedUpcoming.length === 0) {
        return (
            <Card className="border-blue-500/20 bg-linear-to-br from-blue-500/5 to-transparent">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Calendar className="h-6 w-6 text-blue-500" />
                        Upcoming Events
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">
                        No upcoming events at the moment. Check back soon!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-blue-500/20 bg-linear-to-br from-blue-500/5 to-transparent">
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl mb-2">
                            <Calendar className="h-6 w-6 text-blue-500" />
                            Upcoming Events
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Don't miss what's happening in Melbourne
                        </p>
                    </div>
                    <Button variant="ghost" asChild>
                        <Link href="/events">
                            View all
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* This Week - Compact List */}
                {serializedThisWeek.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">This Week</h3>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/events?date=this-week">
                                    View all
                                    <ArrowRight className="ml-2 h-3 w-3" />
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
                                        className="group flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-blue-500/50 transition-all duration-200 hover:shadow-md"
                                    >
                                        <div className="shrink-0 w-16 h-16 rounded-lg bg-blue-500/10 flex flex-col items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                            <span className="text-xs font-medium text-muted-foreground uppercase">
                                                {dayName}
                                            </span>
                                            <span className="text-2xl font-bold text-blue-500">
                                                {day}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase">
                                                {month}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-semibold line-clamp-2 mb-1 group-hover:text-blue-500 transition-colors">
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
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/events">
                                    View all
                                    <ArrowRight className="ml-2 h-3 w-3" />
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
            </CardContent>
        </Card>
    );
}