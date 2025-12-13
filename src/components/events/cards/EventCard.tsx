import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, DollarSign, Users, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FavouriteButton } from './FavouriteButton';
import { EventBadge } from './EventBadge';
import { SerialisedEvent } from '@/lib/models/Event';
import { format, isSameDay, isSameMonth } from 'date-fns';
import { getCategoryLabel } from '@/lib/constants/categories';

interface EventCardProps {
  event: SerialisedEvent;
  source?: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
  initialFavourited?: boolean;
}

export function EventCard({ event, source = 'direct', initialFavourited = false }: EventCardProps) {
  const formatPrice = (): string => {
    if (event.isFree) return 'Free';

    const normalizePrice = (price?: number): string | null => {
      if (price == null || isNaN(price)) return null;
      return price.toFixed(2);
    };

    const min = normalizePrice(event.priceMin);
    const max = normalizePrice(event.priceMax);

    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    return 'Check website';
  };

  const formatDate = (): string => {
    try {
      const start = new Date(event.startDate);
      if (!event.endDate) return format(start, 'EEE, MMM d, yyyy');

      const end = new Date(event.endDate);
      if (isSameDay(start, end)) return format(start, 'EEE, MMM d, yyyy');
      if (isSameMonth(start, end)) return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } catch {
      return 'Date TBA';
    }
  };

  const displaySubcategories = event.subcategories?.slice(0, 2) || [];
  const hasMoreSubcategories = (event.subcategories?.length || 0) > 2;
  const additionalCount = hasMoreSubcategories ? event.subcategories!.length - 2 : 0;

  return (
    <Card className="group overflow-hidden border-2 border-border/50 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] transition-all duration-300 hover:-translate-y-1">
      <Link href={`/events/${event._id}`}>
        {/* Image Section */}
        <div className="relative h-48 w-full bg-muted overflow-hidden">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex items-centre justify-centre h-full">
              <Calendar className="h-16 w-16 text-muted-foreground" aria-hidden="true" />
            </div>
          )}

          {/* Favourite Button - Top Left */}
          <div className="absolute top-2 left-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
            <FavouriteButton eventId={event._id} initialFavourited={initialFavourited} source={source} />
          </div>

          {/* Badges - Top Right */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {event.endDate && <EventBadge type="multiday" label="Multi-day" />}
            {event.sources && event.sources.length > 1 && (
              <EventBadge type="sources" label={`${event.sources.length} sources`} />
            )}
          </div>

          {/* Age Restriction - Bottom Left */}
          {event.ageRestriction && (
            <div className="absolute bottom-2 left-2">
              <EventBadge type="age" label={event.ageRestriction} />
            </div>
          )}
        </div>

        {/* Content Section */}
        <CardContent className="p-4">
          {/* Category Badges */}
          <div className="flex gap-2 mb-2 flex-wrap">
            <EventBadge
              type="category"
              label={getCategoryLabel(event.category)}
              category={event.category}
              href={`/category/${event.category}`}
            />
            {displaySubcategories.map((subcategory) => (
              <EventBadge key={subcategory} type="subcategory" label={subcategory} />
            ))}
            {hasMoreSubcategories && <EventBadge type="outline" label={`+${additionalCount}`} />}
          </div>

          {/* Title */}
          <h3 className="font-bold text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colours">
            {event.title}
          </h3>

          {/* Event Details */}
          <div className="space-y-2">
            {/* Date */}
            <div className="flex items-centre gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colours">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{formatDate()}</span>
            </div>

            {/* Venue */}
            <div className="flex items-centre gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colours">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{event.venue.name}</span>
            </div>

            {/* Duration */}
            {event.duration && (
              <div className="flex items-centre gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colours">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="line-clamp-1">{event.duration}</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-centre gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
              <span>{formatPrice()}</span>
            </div>

            {/* Accessibility */}
            {event.accessibility && event.accessibility.length > 0 && (
              <div className="flex items-centre gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="line-clamp-1">Accessible venue</span>
              </div>
            )}
          </div>
        </CardContent>
      </Link>

      {/* Footer */}
      <CardFooter className="p-4 pt-0">
        <Button
          asChild
          variant="outline"
          className="w-full border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/10 transition-all group"
        >
          <Link href={`/events/${event._id}`} className="flex items-centre justify-centre">
            <span className="text-foreground group-hover:text-primary transition-colours">View Details</span>
            <span className="ml-2 group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}