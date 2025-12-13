import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Users, Video, Info } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { FavouriteButton } from '@/components/events/cards/FavouriteButton';
import { ViewTracker } from '@/components/events/ViewTracker';
import { SimilarEvents } from '@/components/recommendations/SimilarEvents';
import { BackButton } from '@/components/layout/BackButton';
import { EventBadge } from '@/components/events/cards/EventBadge';
import { EventComparison } from '@/components/analytics/EventComparisonChart';
import { format, isSameMonth } from 'date-fns';
import { getCategoryLabel } from '@/lib/constants/categories';
import mongoose from 'mongoose';
import { Event, UserFavourite } from '@/lib/models';
import { EventInfoSidebar } from '@/components/events/sections/EventInfoSidebar';

interface EventPageProps {
    params: Promise<{ id: string }>;
}

// Helper functions
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

const formatEventDate = (startDate: string, endDate?: string): string => {
    try {
        const start = new Date(startDate);
        if (!endDate) return format(start, 'EEEE, MMMM d, yyyy');

        const end = new Date(endDate);
        if (isSameMonth(start, end)) {
            return `${format(start, 'EEEE, MMMM d')} - ${format(end, 'd, yyyy')}`;
        }
        return `${format(start, 'MMMM d')} - ${format(end, 'MMMM d, yyyy')}`;
    } catch {
        return 'Date TBA';
    }
};

const formatEventTime = (startDate: string, hasEndDate: boolean): string => {
    try {
        const start = new Date(startDate);
        const startTime = format(start, 'h:mm a');
        return hasEndDate ? `Starts ${startTime} daily` : startTime;
    } catch {
        return '';
    }
};

const formatEventPrice = (isFree: boolean, priceMin?: number, priceMax?: number): string => {
    if (isFree) return 'Free Entry';

    const normalizePrice = (price?: number): string | null => {
        if (price == null || isNaN(price)) return null;
        return price.toFixed(2);
    };

    const min = normalizePrice(priceMin);
    const max = normalizePrice(priceMax);

    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    return 'Check booking link for pricing';
};

// Metadata generation
export async function generateMetadata({ params }: EventPageProps) {
    const { id } = await params;
    await connectDB();
    const event = await Event.findById(id).lean();

    if (!event) {
        return { title: 'Event Not Found | Hoddle' };
    }

    return {
        title: `${event.title} | Hoddle`,
        description: event.description.substring(0, 160),
        openGraph: {
            title: event.title,
            description: event.description.substring(0, 160),
            images: event.imageUrl ? [event.imageUrl] : [],
        },
    };
}

export default async function EventPage({ params }: EventPageProps) {
    const { id } = await params;
    await connectDB();

    const eventDoc = await Event.findById(id).lean();
    if (!eventDoc) notFound();

    const session = await getServerSession(authOptions);
    let isFavourited = false;
    let userFavourites = new Set<string>();

    if (session?.user?.id) {
        const userId = new mongoose.Types.ObjectId(session.user.id);

        const [favourite, allFavourites] = await Promise.all([
            UserFavourite.findOne({ userId, eventId: new mongoose.Types.ObjectId(id) }),
            UserFavourite.find({ userId }).select('eventId')
        ]);

        isFavourited = !!favourite;
        userFavourites = new Set(allFavourites.map(f => f.eventId.toString()));
    }

    // Serialize event
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

    const hasMultipleSources = event.sources && event.sources.length > 1;
    const bookingUrls = event.bookingUrls || {};

    // Prepare alternative bookings
    const alternativeBookings = hasMultipleSources && Object.keys(bookingUrls).length > 1
        ? Object.entries(bookingUrls)
            .filter(([source]) => source !== event.primarySource)
            .map(([source, url]) => ({ source, url: url as string }))
        : [];

    return (
        <div className="w-full">
            <ViewTracker eventId={event._id} source="direct" />

            <section className="container-page section-spacing">
                <BackButton fallbackUrl="/" className="mb-6 sm:mb-8" />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Event Image */}
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

                        {/* Title & Badges */}
                        <div className="mb-6">
                            <div className="flex items-centre justify-between gap-4 mb-3 flex-wrap">
                                <div className="flex items-centre gap-2 flex-wrap">
                                    <EventBadge
                                        type="category"
                                        label={getCategoryLabel(event.category)}
                                        category={event.category}
                                        href={`/category/${event.category}`}
                                    />
                                    {event.subcategories?.map((sub) => (
                                        <EventBadge
                                            key={sub}
                                            type="subcategory"
                                            label={sub}
                                            category={event.category}
                                            subcategory={sub}
                                        />
                                    ))}
                                    {event.endDate && (
                                        <EventBadge type="multiday" label="Multi-day Event" />
                                    )}
                                    {event.ageRestriction && (
                                        <EventBadge type="age" label={event.ageRestriction} />
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
                                <div className="flex items-centre gap-2 text-sm text-muted-foreground">
                                    <Info className="h-4 w-4" aria-hidden="true" />
                                    <p>Verified across {event.sources.length} sources</p>
                                </div>
                            )}
                        </div>

                        {/* Mobile Sidebar */}
                        <div className="lg:hidden mb-6">
                            <EventInfoSidebar
                                eventId={event._id}
                                isFavourited={isFavourited}
                                dateText={formatEventDate(event.startDate, event.endDate)}
                                timeText={formatEventTime(event.startDate, !!event.endDate)}
                                duration={event.duration}
                                venueName={event.venue.name}
                                venueSuburb={event.venue.suburb}
                                priceText={formatEventPrice(event.isFree, event.priceMin, event.priceMax)}
                                priceDetails={event.priceDetails}
                                bookingUrl={event.bookingUrl}
                                alternativeBookings={alternativeBookings}
                            />
                        </div>

                        <Separator className="my-6" />

                        {/* About Section */}
                        <section className="mb-6">
                            <h2 className="text-2xl font-bold mb-4">About This Event</h2>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {event.description}
                            </p>
                        </section>

                        {/* Video Preview */}
                        {event.videoUrl && (
                            <>
                                <Separator className="my-6" />
                                <section className="mb-6">
                                    <h2 className="text-2xl font-bold mb-4 flex items-centre gap-2">
                                        <Video className="h-6 w-6 text-primary" aria-hidden="true" />
                                        Preview
                                    </h2>
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-border/50 shadow-lg">
                                        <iframe
                                            src={event.videoUrl}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            title="Event preview video"
                                        />
                                    </div>
                                </section>
                            </>
                        )}

                        {/* Accessibility */}
                        {event.accessibility && event.accessibility.length > 0 && (
                            <>
                                <Separator className="my-6" />
                                <section className="mb-6">
                                    <h2 className="text-2xl font-bold mb-4 flex items-centre gap-2">
                                        <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                        Accessibility
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {event.accessibility.map((feature) => (
                                            <EventBadge
                                                key={feature}
                                                type="accessibility"
                                                label={feature}
                                            />
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}

                        <Separator className="my-6" />

                        {/* Venue & Sources */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Venue */}
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

                            {/* Sources */}
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
                                                    <EventBadge
                                                        key={source}
                                                        type="sources"
                                                        label={source.charAt(0).toUpperCase() + source.slice(1)}
                                                    />
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:block lg:col-span-1">
                        <EventInfoSidebar
                            eventId={event._id}
                            isFavourited={isFavourited}
                            dateText={formatEventDate(event.startDate, event.endDate)}
                            timeText={formatEventTime(event.startDate, !!event.endDate)}
                            duration={event.duration}
                            venueName={event.venue.name}
                            venueSuburb={event.venue.suburb}
                            priceText={formatEventPrice(event.isFree, event.priceMin, event.priceMax)}
                            priceDetails={event.priceDetails}
                            bookingUrl={event.bookingUrl}
                            alternativeBookings={alternativeBookings}
                            className="sticky top-20"
                        />
                    </aside>
                </div>
            </section>

            {/* Analytics & Recommendations */}
            <section className="bg-muted/30">
                <div className="container-page py-12 sm:py-16">
                    {!event.isFree && (
                        <div className="mb-12">
                            <EventComparison
                                eventId={event._id}
                                category={event.category}
                                isFree={event.isFree}
                            />
                        </div>
                    )}

                    <SimilarEvents eventId={event._id} userFavourites={userFavourites} />
                </div>
            </section>
        </div>
    );
}