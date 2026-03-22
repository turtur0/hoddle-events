"use client";

import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, DollarSign, Users, Clock } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FavouriteButton } from "./FavouriteButton";
import { EventBadge } from "./EventBadge";
import { format, isSameDay, isSameMonth } from "date-fns";
import { getCategoryLabel } from "@/lib/constants/categories";
import type { EventResponse } from "@/lib/transformers/event-transformer";
import type { EventSource } from "@/lib/types/events";

interface EventCardProps {
  event: EventResponse;
  source?: EventSource;
  initialFavourited?: boolean;
}

export function EventCard({
  event,
  source = "direct",
  initialFavourited = false
}: EventCardProps) {
  const formatPrice = (): string => {
    if (event.pricing?.isFree) return "Free";
    const n = (v?: number) => (v != null && !isNaN(v) ? v.toFixed(2) : null);
    const min = n(event.pricing?.min),
      max = n(event.pricing?.max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `From ${min}`;
    return "Check website";
  };

  const formatDate = (): string => {
    try {
      const start = new Date(event.schedule?.start || new Date());
      if (!event.schedule?.end) return format(start, "EEE, MMM d, yyyy");
      const end = new Date(event.schedule.end);
      if (isSameDay(start, end)) return format(start, "EEE, MMM d, yyyy");
      if (isSameMonth(start, end))
        return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    } catch {
      return "Date TBA";
    }
  };

  const displaySubcategories = event.subcategories?.slice(0, 2) ?? [];
  const extraCount = (event.subcategories?.length ?? 0) - 2;
  const isMultiDay = !!event.schedule?.end;

  return (
    <>
      {/* Graph-edge hover style — orange border + ambient glow, no corner nodes */}
      <style>{`
        .event-card-edge {
          background:   rgba(20,20,19,0.55);
          border:       1px solid rgba(255,255,255,0.09);
          box-shadow:   none;
          backdrop-filter: blur(8px);
          transition:   border-color 0.25s ease, box-shadow 0.25s ease,
                        transform 0.2s ease;
        }
        .event-card-edge:hover {
          border-color: rgba(251,146,60,0.55);
          box-shadow:   0 0 18px rgba(251,146,60,0.13);
          transform:    translateY(-2px);
        }
        .event-card-edge:active {
          transform: translateY(0) scale(0.98);
        }
      `}</style>

      <Card className="group overflow-hidden event-card-edge">
        <Link href={`/events/${event.id}`}>
          {/* Image */}
          <div className="relative h-48 w-full bg-muted overflow-hidden">
            {event.media?.imageUrl ? (
              <Image
                src={event.media.imageUrl}
                alt={event.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Calendar className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            <div className="absolute top-2 left-2 z-10">
              <FavouriteButton
                eventId={event.id}
                initialFavourited={initialFavourited}
                source={source}
              />
            </div>
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              {isMultiDay && <EventBadge type="multiday" label="Multi-day" />}
              {(event.sources?.length ?? 0) > 1 && (
                <EventBadge
                  type="sources"
                  label={`${event.sources!.length} sources`}
                />
              )}
            </div>
            {event.ageRestriction && (
              <div className="absolute bottom-2 left-2">
                <EventBadge type="age" label={event.ageRestriction} />
              </div>
            )}
          </div>

          {/* Content */}
          <CardContent className="p-4">
            <div className="flex gap-2 mb-2 flex-wrap">
              <EventBadge
                type="category"
                label={getCategoryLabel(event.category)}
                category={event.category}
                href={`/category/${event.category}`}
              />
              {displaySubcategories.map((s) => (
                <EventBadge key={s} type="subcategory" label={s} />
              ))}
              {extraCount > 0 && (
                <EventBadge type="outline" label={`+${extraCount}`} />
              )}
            </div>

            <h3 className="font-bold text-lg line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {event.title}
            </h3>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="line-clamp-1">{formatDate()}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="line-clamp-1">
                  {event.venue?.name ?? "TBA"}
                </span>
              </div>
              {event.duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-1">{event.duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <DollarSign className="h-4 w-4 shrink-0 text-secondary" />
                <span>{formatPrice()}</span>
              </div>
              {(event.accessibility?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Accessible venue</span>
                </div>
              )}
            </div>
          </CardContent>
        </Link>

        <CardFooter className="p-4 pt-0">
          <Button
            asChild
            variant="outline"
            className="w-full border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/10 transition-all group"
          >
            <Link
              href={`/events/${event.id}`}
              className="flex items-center justify-center"
            >
              <span className="group-hover:text-primary transition-colors">
                View Details
              </span>
              <span className="ml-2 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
