import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, DollarSign } from "lucide-react";
import { Card, CardContent, CardFooter } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { SerializedEvent } from "@/app/lib/models/Event";
import { format, isSameDay, isSameMonth } from "date-fns";
import { getCategoryLabel } from "@/app/lib/categories";

interface EventCardProps {
  event: SerializedEvent;
}

export function EventCard({ event }: EventCardProps) {
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

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
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
          
          {/* Multi-day badge */}
          {event.endDate && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-background/90 backdrop-blur">
                Multi-day
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
            {event.subcategory && (
              <Badge variant="outline">
                {event.subcategory}
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

          {/* Price */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span>{formatPrice()}</span>
          </div>
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