import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, DollarSign, Users, Clock } from "lucide-react";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FavouriteButton } from "./favourite-button";
import { SerializedEvent } from "@/lib/models/Event";
import { format, isSameDay, isSameMonth } from "date-fns";
import { getCategoryLabel } from "@/lib/categories";

interface EventCardProps {
  event: SerializedEvent;
  source?: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
  initialFavourited?: boolean;
}

export function EventCard({ event, source = 'direct', initialFavourited = false }: EventCardProps) {
  const formatPrice = () => {
    if (event.isFree) return "Free";
    if (event.priceMin && event.priceMax) {
      return `$${event.priceMin} - $${event.priceMax}`;
    }
    if (event.priceMin) return `From $${event.priceMin}`;
    return "Check website";
  };

  const formatDate = () => {
    try {
      const start = new Date(event.startDate);

      if (!event.endDate) {
        return format(start, "EEE, MMM d, yyyy");
      }

      const end = new Date(event.endDate);

      if (isSameDay(start, end)) {
        return format(start, "EEE, MMM d, yyyy");
      }

      if (isSameMonth(start, end)) {
        return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
      }

      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;

    } catch {
      return "Date TBA";
    }
  };

  // Show up to 2 subcategories
  const displaySubcategories = event.subcategories?.slice(0, 2) || [];

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <Link href={`/events/${event._id}`}>
        {/* Event Image */}
        <div className="relative h-48 w-full bg-muted">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Calendar className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Favourite Button - top left, always visible on mobile, hover on desktop */}
          <div className="absolute top-2 left-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
            <FavouriteButton
              eventId={event._id}
              initialFavourited={initialFavourited}
              source={source}
            />
          </div>

          {/* Top right badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {event.endDate && (
              <Badge variant="secondary" className="bg-background/90 backdrop-blur">
                Multi-day
              </Badge>
            )}
            {event.sources && event.sources.length > 1 && (
              <Badge variant="secondary" className="bg-background/90 backdrop-blur">
                {event.sources.length} sources
              </Badge>
            )}
          </div>

          {/* Age restriction badge */}
          {event.ageRestriction && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="destructive" className="bg-red-600/90 backdrop-blur">
                {event.ageRestriction}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* Category Badges */}
          <div className="flex gap-2 mb-2 flex-wrap">
            <Badge variant="secondary">
              {getCategoryLabel(event.category)}
            </Badge>
            {displaySubcategories.map((sub) => (
              <Badge key={sub} variant="outline">
                {sub}
              </Badge>
            ))}
            {event.subcategories && event.subcategories.length > 2 && (
              <Badge variant="outline">
                +{event.subcategories.length - 2}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="font-bold text-lg line-clamp-2 mb-2">
            {event.title}
          </h3>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">{formatDate()}</span>
          </div>

          {/* Venue */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1">{event.venue.name}</span>
          </div>

          {/* Duration */}
          {event.duration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{event.duration}</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span>{formatPrice()}</span>
          </div>

          {/* Accessibility indicator */}
          {event.accessibility && event.accessibility.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Users className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">Accessible venue</span>
            </div>
          )}
        </CardContent>
      </Link>

      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full">
          <Link href={`/events/${event._id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}