import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import UserFavourite from '@/lib/models/UserFavourites';
import { EventCard } from '@/components/events/EventCard';
import { EmptyState } from '@/components/other/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import mongoose from 'mongoose';
import { Heart, ArrowLeft, Sparkles } from 'lucide-react';

export default async function FavouritesPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        redirect('/auth/signin?callbackUrl=/favourites');
    }

    await connectDB();

    const favourites = await UserFavourite.find({
        userId: new mongoose.Types.ObjectId(session.user.id)
    })
        .sort({ createdAt: -1 })
        .populate('eventId')
        .lean();

    const events = favourites
        .filter(f => f.eventId)
        .map(f => {
            const e = f.eventId as any;
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
                imageUrl: e.imageUrl,
                primarySource: e.primarySource,
                sources: e.sources || [],
            };
        });

    return (
        <div className="w-full">
            {/* Header Section */}
            <section className="bg-linear-to-b from-red-500/5 to-background">
                <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                    <Button variant="ghost" asChild className="mb-6">
                        <Link href="/">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Link>
                    </Button>

                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-4xl sm:text-5xl font-bold mb-3 flex items-center gap-3">
                                <Heart className="h-10 w-10 text-red-500 fill-red-500" />
                                My Favourites
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                Events you've saved for later
                            </p>
                        </div>
                        {events.length > 0 && (
                            <Badge variant="secondary" className="text-base px-4 py-2">
                                {events.length} saved event{events.length !== 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <section className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                {events.length === 0 ? (
                    <div className="max-w-2xl mx-auto">
                        <EmptyState
                            title="No favourites yet"
                            description="Start exploring events and tap the heart icon to save them here for easy access later."
                        />
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                            <Button asChild size="lg">
                                <Link href="/events">
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    Discover Events
                                </Link>
                            </Button>
                            <Button variant="outline" size="lg" asChild>
                                <Link href="/category/music">
                                    Browse Music
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => (
                            <EventCard
                                key={event._id}
                                event={event as any}
                                initialFavourited={true}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}