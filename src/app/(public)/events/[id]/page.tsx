import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, MapPin, DollarSign, Users, Clock, Video, Info } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { FavouriteButton } from '@/components/events/cards/FavouriteButton';
import { ViewTracker } from '@/components/events/ViewTracker';
import { BookingLink } from '@/components/events/BookingLink';
import { SimilarEvents } from '@/components/recommendations/SimilarEvents';
import { BackButton } from '@/components/layout/BackButton';
import { format, isSameMonth } from "date-fns";
import { getCategoryLabel } from "@/lib/constants/categories";
import mongoose from "mongoose";
import { Event, UserFavourite } from '@/lib/models';
import { EventComparison } from "@/components/analytics/EventComparisonChart";

interface EventPageProps {
    params: Promise<{ id: string }>;
}

// Category colour mapping using utility classes from global.css
const CATEGORY_COLORS: Record<string, string> = {
    music: "category-music",
    theatre: "category-theatre",
    sports: "category-sports",
    arts: "category-arts",
    family: "category-family",
    other: "category-other",
};

export async function generateMetadata({ params }: EventPageProps) {
    const { id } = await params;
    await connectDB();
    const event = await Event.findById(id).lean();

    if (!event) {
        return {
            title: "Event Not Found",
        };
    }

    return {
        title: `${event.title} | Melbourne Events`,
        description: event.description.substring(0, 160),
    };
}

export default async function EventPage({ params }: EventPageProps) {
    const { id } = await params;
    await connectDB();

    const eventDoc = await Event.findById(id).lean();

    if (!eventDoc) {
        notFound();
    }

    const session = await getServerSession(authOptions);
    let isFavourited = false;
    let userFavourites = new Set<string>();

    if (session?.user?.id) {
        const userId = new mongoose.Types.ObjectId(session.user.id);

        const favourite = await UserFavourite.findOne({
            userId,
            eventId: new mongoose.Types.ObjectId(id),
        });
        isFavourited = !!favourite;

        const allFavourites = await UserFavourite.find({ userId }).select('eventId');
        userFavourites = new Set(allFavourites.map(f => f.eventId.toString()));
    }

    const mapToObject = (map: any) => {
        if (!map) return {};
        if (typeof map.get === 'function') {
            const obj: Record<string, any> = {};
            for (const [key, value] of map) {
                obj[key] = value;
            }
            return obj;
        }
        return map;
    };

    const event = {
        ...eventDoc,
        _id: eventDoc._id.toString(),
        startDate: eventDoc.startDate.toISOString(),
        endDate: eventDoc.endDate?.toISOString(),
        scrapedAt: eventDoc.scrapedAt.toISOString(),
        lastUpdated: eventDoc.lastUpdated.toISOString(),
        sourceIds: mapToObject(eventDoc.sourceIds),
        bookingUrls: mapToObject(eventDoc.bookingUrls),
    };

    const formatDate = () => {
        try {
            const start = new Date(event.startDate);

            if (!event.endDate) {
                return format(start, "EEEE, MMMM d, yyyy");
            }

            const end = new Date(event.endDate);

            if (isSameMonth(start, end)) {
                return `${format(start, "EEEE, MMMM d")} - ${format(end, "d, yyyy")}`;
            }

            return `${format(start, "MMMM d")} - ${format(end, "MMMM d, yyyy")}`;

        } catch {
            return "Date TBA";
        }
    };

    const formatTime = () => {
        try {
            const start = new Date(event.startDate);
            const startTime = format(start, "h:mm a");

            if (event.endDate) {
                return `Starts ${startTime} daily`;
            }

            return startTime;
        } catch {
            return "";
        }
    };

    const formatPrice = () => {
        if (event.isFree) return "Free Entry";
        if (event.priceMin && event.priceMax) {
            return `$${event.priceMin} - $${event.priceMax}`;
        }
        if (event.priceMin) return `From $${event.priceMin}`;
        return "Check booking link for pricing";
    };

    const bookingUrls = event.bookingUrls || {};
    const hasMultipleSources = event.sources && event.sources.length > 1;
    const categoryColorClass = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other;

    return (
        <div className="w-full">
            <ViewTracker eventId={event._id} source="direct" />

            <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
                <BackButton fallbackUrl="/" className="mb-6 sm:mb-8" />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Main content */}
                    <div className="lg:col-span-2">
                        {event.imageUrl && (
                            <div className="relative h-64 sm:h-80 lg:h-96 w-full rounded-lg overflow-hidden mb-6 border-2 border-border/50 shadow-lg">
                                <Image
                                    src={event.imageUrl}
                                    alt={event.title}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                                <div className="absolute top-4 right-4">
                                    <FavouriteButton
                                        eventId={event._id}
                                        initialFavourited={isFavourited}
                                        source="direct"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Title and badges section */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={`${categoryColorClass} font-medium hover:shadow-[0_0_10px_currentColor] hover:scale-105`}>
                                        {getCategoryLabel(event.category)}
                                    </Badge>
                                    {event.subcategories?.map((sub) => (
                                        <Badge
                                            key={sub}
                                            variant="outline"
                                            className="badge-outline-hover"
                                        >
                                            {sub}
                                        </Badge>
                                    ))}
                                    {event.endDate && (
                                        <Badge
                                            variant="outline"
                                            className="badge-outline-hover"
                                        >
                                            Multi-day Event
                                        </Badge>
                                    )}
                                    {event.ageRestriction && (
                                        <Badge
                                            variant="destructive"
                                            className="transition-all hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] hover:scale-105"
                                        >
                                            {event.ageRestriction}
                                        </Badge>
                                    )}
                                </div>
                                {!event.imageUrl && (
                                    <FavouriteButton
                                        eventId={event._id}
                                        initialFavourited={isFavourited}
                                        source="direct"
                                        variant="button"
                                    />
                                )}
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-bold mb-3">{event.title}</h1>
                            {hasMultipleSources && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Info className="h-4 w-4" />
                                    <p>Verified across {event.sources.length} sources</p>
                                </div>
                            )}
                        </div>

                        {/* Sidebar appears here on mobile - below title/badges but above description */}
                        <div className="lg:hidden mb-6">
                            <Card className="border-2 border-border/50 shadow-lg">
                                <CardContent className="p-4 sm:p-6">
                                    {/* Date & time */}
                                    <div className="mb-4">
                                        <div className="flex items-start gap-3">
                                            <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-semibold mb-1 text-sm">Date & Time</p>
                                                <p className="text-sm text-muted-foreground">{formatDate()}</p>
                                                {formatTime() && (
                                                    <p className="text-sm text-muted-foreground">{formatTime()}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="my-4" />

                                    {/* Duration (if available) */}
                                    {event.duration && (
                                        <>
                                            <div className="mb-4">
                                                <div className="flex items-start gap-3">
                                                    <Clock className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="font-semibold mb-1 text-sm">Duration</p>
                                                        <p className="text-sm text-muted-foreground">{event.duration}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <Separator className="my-4" />
                                        </>
                                    )}

                                    {/* Location */}
                                    <div className="mb-4">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-semibold mb-1 text-sm">Location</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {event.venue.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {event.venue.suburb}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="my-4" />

                                    {/* Price */}
                                    <div className="mb-6">
                                        <div className="flex items-start gap-3">
                                            <DollarSign className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                                            <div className="w-full">
                                                <p className="font-semibold mb-1 text-sm">Price</p>
                                                <p className="text-sm text-muted-foreground mb-2">{formatPrice()}</p>
                                                {event.priceDetails && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {event.priceDetails}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="my-4" />

                                    {/* Action buttons */}
                                    <div className="space-y-3">
                                        <FavouriteButton
                                            eventId={event._id}
                                            initialFavourited={isFavourited}
                                            source="direct"
                                            variant="button"
                                            className="w-full"
                                        />

                                        <BookingLink
                                            eventId={event._id}
                                            href={event.bookingUrl}
                                            className="w-full"
                                        >
                                            Get Tickets
                                        </BookingLink>

                                        {/* Alternative booking sources */}
                                        {hasMultipleSources && Object.keys(bookingUrls).length > 1 && (
                                            <div className="pt-2 space-y-2">
                                                <p className="text-xs text-muted-foreground text-center">
                                                    Also available on:
                                                </p>
                                                {Object.entries(bookingUrls).map(([source, url]) => {
                                                    if (source === event.primarySource) return null;
                                                    return (
                                                        <BookingLink
                                                            key={source}
                                                            eventId={event._id}
                                                            href={url as string}
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full"
                                                        >
                                                            {source.charAt(0).toUpperCase() + source.slice(1)}
                                                        </BookingLink>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <p className="text-xs text-muted-foreground text-center pt-2">
                                            You'll be redirected to the official ticketing site
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Separator className="my-6" />

                        {/* About section */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-4">About This Event</h2>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {event.description}
                            </p>
                        </div>

                        {/* Video preview */}
                        {event.videoUrl && (
                            <>
                                <Separator className="my-6" />
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <Video className="h-6 w-6 text-primary" />
                                        Preview
                                    </h2>
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-border/50 shadow-lg">
                                        <iframe
                                            src={event.videoUrl}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Accessibility section */}
                        {event.accessibility && event.accessibility.length > 0 && (
                            <>
                                <Separator className="my-6" />
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                        Accessibility
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {event.accessibility.map((feature) => (
                                            <Badge
                                                key={feature}
                                                variant="secondary"
                                                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 transition-all hover:shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:scale-105"
                                            >
                                                {feature}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <Separator className="my-6" />

                        {/* Venue and sources side by side on desktop */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Venue information */}
                            <div>
                                <h2 className="text-xl font-bold mb-3">Venue</h2>
                                <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 via-transparent to-transparent hover:border-primary/30 transition-all">
                                    <CardContent className="p-4">
                                        <h3 className="font-bold text-base mb-2">{event.venue.name}</h3>
                                        <p className="text-sm text-muted-foreground mb-1">{event.venue.address}</p>
                                        <p className="text-sm text-muted-foreground">{event.venue.suburb}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Event sources - only show if multiple sources */}
                            {hasMultipleSources && (
                                <div>
                                    <h2 className="text-xl font-bold mb-3">Sources</h2>
                                    <Card className="border-2 border-secondary/20 bg-linear-to-br from-secondary/5 via-transparent to-transparent hover:border-secondary/30 transition-all">
                                        <CardContent className="p-4">
                                            <p className="text-xs text-muted-foreground mb-3">
                                                Verified across multiple platforms
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {event.sources.map((source: string) => (
                                                    <Badge
                                                        key={source}
                                                        variant="outline"
                                                        className="badge-outline-hover"
                                                    >
                                                        {source.charAt(0).toUpperCase() + source.slice(1)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - hidden on mobile, shown on desktop */}
                    <div className="hidden lg:block lg:col-span-1">
                        <Card className="sticky top-20 border-2 border-border/50 shadow-lg">
                            <CardContent className="p-4 sm:p-6">
                                {/* Date & time */}
                                <div className="mb-4">
                                    <div className="flex items-start gap-3">
                                        <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold mb-1 text-sm">Date & Time</p>
                                            <p className="text-sm text-muted-foreground">{formatDate()}</p>
                                            {formatTime() && (
                                                <p className="text-sm text-muted-foreground">{formatTime()}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                {/* Duration (if available) */}
                                {event.duration && (
                                    <>
                                        <div className="mb-4">
                                            <div className="flex items-start gap-3">
                                                <Clock className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-semibold mb-1 text-sm">Duration</p>
                                                    <p className="text-sm text-muted-foreground">{event.duration}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <Separator className="my-4" />
                                    </>
                                )}

                                {/* Location */}
                                <div className="mb-4">
                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold mb-1 text-sm">Location</p>
                                            <p className="text-sm text-muted-foreground">
                                                {event.venue.name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {event.venue.suburb}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-start gap-3">
                                        <DollarSign className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                                        <div className="w-full">
                                            <p className="font-semibold mb-1 text-sm">Price</p>
                                            <p className="text-sm text-muted-foreground mb-2">{formatPrice()}</p>
                                            {event.priceDetails && (
                                                <p className="text-xs text-muted-foreground">
                                                    {event.priceDetails}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                {/* Action buttons */}
                                <div className="space-y-3">
                                    <FavouriteButton
                                        eventId={event._id}
                                        initialFavourited={isFavourited}
                                        source="direct"
                                        variant="button"
                                        className="w-full"
                                    />

                                    <BookingLink
                                        eventId={event._id}
                                        href={event.bookingUrl}
                                        className="w-full"
                                    >
                                        Get Tickets
                                    </BookingLink>

                                    {/* Alternative booking sources */}
                                    {hasMultipleSources && Object.keys(bookingUrls).length > 1 && (
                                        <div className="pt-2 space-y-2">
                                            <p className="text-xs text-muted-foreground text-center">
                                                Also available on:
                                            </p>
                                            {Object.entries(bookingUrls).map(([source, url]) => {
                                                if (source === event.primarySource) return null;
                                                return (
                                                    <BookingLink
                                                        key={source}
                                                        eventId={event._id}
                                                        href={url as string}
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                    >
                                                        {source.charAt(0).toUpperCase() + source.slice(1)}
                                                    </BookingLink>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground text-center pt-2">
                                        You'll be redirected to the official ticketing site
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Analytics and recommendations section */}
            <section className="bg-muted/30">
                <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    {/* Event comparison chart */}
                    {!event.isFree && (
                        <div className="mb-12">
                            <EventComparison
                                eventId={event._id}
                                category={event.category}
                                isFree={event.isFree}
                            />
                        </div>
                    )}

                    {/* Similar events carousel */}
                    <SimilarEvents
                        eventId={event._id}
                        userFavourites={userFavourites}
                    />
                </div>
            </section>
        </div>
    );
}