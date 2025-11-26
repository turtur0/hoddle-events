import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, MapPin, DollarSign, Users, Clock, Video, Info } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Event from "@/lib/models/Event";
import UserFavourite from "@/lib/models/UserFavourites";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FavouriteButton } from "@/components/events/favourite-button";
import { ViewTracker } from "@/components/events/view-tracker";
import { BookingLink } from "@/components/events/booking-link";
import { SimilarEvents } from "@/components/recommendations/similiar-events";
import { BackButton } from "@/components/navigation/back-button"; // ✅ Import new component
import { format, isSameMonth } from "date-fns";
import { getCategoryLabel } from "@/lib/constants/categories";
import mongoose from "mongoose";

interface EventPageProps {
    params: Promise<{ id: string }>;
}

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

    return (
        <div className="w-full">
            <ViewTracker eventId={event._id} source="direct" />

            <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <BackButton fallbackUrl="/" className="mb-8" />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {event.imageUrl && (
                            <div className="relative h-96 w-full rounded-lg overflow-hidden mb-6">
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

                        <div className="mb-6">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="secondary">
                                        {getCategoryLabel(event.category)}
                                    </Badge>
                                    {event.subcategories?.map((sub) => (
                                        <Badge key={sub} variant="outline">
                                            {sub}
                                        </Badge>
                                    ))}
                                    {event.endDate && (
                                        <Badge variant="outline">
                                            Multi-day Event
                                        </Badge>
                                    )}
                                    {event.ageRestriction && (
                                        <Badge variant="destructive">
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
                            <h1 className="text-4xl font-bold mb-2">{event.title}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <p>
                                    Primary source: {event.primarySource.charAt(0).toUpperCase() + event.primarySource.slice(1)}
                                </p>
                                {hasMultipleSources && (
                                    <>
                                        <span>•</span>
                                        <p>{event.sources.length} sources</p>
                                    </>
                                )}
                            </div>
                        </div>

                        <Separator className="my-6" />

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-4">About This Event</h2>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {event.description}
                            </p>
                        </div>

                        {event.videoUrl && (
                            <>
                                <Separator className="my-6" />
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <Video className="h-6 w-6" />
                                        Preview
                                    </h2>
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
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

                        {event.accessibility && event.accessibility.length > 0 && (
                            <>
                                <Separator className="my-6" />
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <Users className="h-6 w-6" />
                                        Accessibility
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {event.accessibility.map((feature) => (
                                            <Badge key={feature} variant="secondary">
                                                {feature}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <Separator className="my-6" />

                        <div>
                            <h2 className="text-2xl font-bold mb-4">Venue</h2>
                            <Card>
                                <CardContent className="p-6">
                                    <h3 className="font-bold text-lg mb-2">{event.venue.name}</h3>
                                    <p className="text-muted-foreground mb-1">{event.venue.address}</p>
                                    <p className="text-muted-foreground">{event.venue.suburb}</p>
                                </CardContent>
                            </Card>
                        </div>

                        {hasMultipleSources && (
                            <>
                                <Separator className="my-6" />
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Info className="h-5 w-5" />
                                            Event Information Sources
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            This event has been verified across multiple sources for accuracy.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {event.sources.map((source: string) => (
                                                <Badge key={source} variant="outline">
                                                    {source.charAt(0).toUpperCase() + source.slice(1)}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <Card className="sticky top-20">
                            <CardContent className="p-6">
                                <div className="mb-6">
                                    <div className="flex items-start gap-3 mb-2">
                                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div>
                                            <p className="font-semibold mb-1">Date & Time</p>
                                            <p className="text-sm text-muted-foreground">{formatDate()}</p>
                                            {formatTime() && (
                                                <p className="text-sm text-muted-foreground">{formatTime()}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                {event.duration && (
                                    <>
                                        <div className="mb-6">
                                            <div className="flex items-start gap-3">
                                                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                                                <div>
                                                    <p className="font-semibold mb-1">Duration</p>
                                                    <p className="text-sm text-muted-foreground">{event.duration}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <Separator className="my-4" />
                                    </>
                                )}

                                <div className="mb-6">
                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div>
                                            <p className="font-semibold mb-1">Location</p>
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

                                <div className="mb-6">
                                    <div className="flex items-start gap-3">
                                        <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div className="w-full">
                                            <p className="font-semibold mb-1">Price</p>
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

                                <div className="mb-4">
                                    <FavouriteButton
                                        eventId={event._id}
                                        initialFavourited={isFavourited}
                                        source="direct"
                                        variant="button"
                                        className="w-full"
                                    />
                                </div>

                                <BookingLink
                                    eventId={event._id}
                                    href={event.bookingUrl}
                                    className="w-full"
                                >
                                    Get Tickets
                                </BookingLink>

                                {hasMultipleSources && Object.keys(bookingUrls).length > 1 && (
                                    <div className="mt-4 space-y-2">
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

                                <p className="text-xs text-muted-foreground text-center mt-4">
                                    You'll be redirected to the official ticketing site
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            <section className="bg-muted/30">
                <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <SimilarEvents
                        eventId={event._id}
                        userFavourites={userFavourites}
                    />
                </div>
            </section>
        </div>
    );
}