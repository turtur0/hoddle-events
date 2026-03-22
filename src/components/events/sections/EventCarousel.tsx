"use client";

import { useEffect, useState, useRef } from "react";
import { EventCard } from "@/components/events/cards/EventCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { EventResponse } from "@/lib/transformers/event-transformer";
import type { EventSource } from "@/lib/types/events";

interface EventCarouselProps {
  events: EventResponse[];
  userFavourites: Set<string>;
  title?: string; // optional — omit for no heading
  description?: string;
  icon?: React.ReactNode;
  source?: EventSource;
  borderClass?: string;
  gradientClass?: string;
  autoScroll?: boolean;
  autoScrollInterval?: number;
  showProgress?: boolean;
  children?: React.ReactNode;
  cardComponent?: React.ComponentType<{
    event: EventResponse;
    source?: EventSource;
    initialFavourited?: boolean;
  }>;
}

export function EventCarousel({
  events,
  userFavourites,
  title,
  description,
  icon,
  source = "direct",
  borderClass = "border-primary/20",
  gradientClass = "from-primary/5",
  autoScroll = true,
  autoScrollInterval = 5000,
  showProgress = true,
  children,
  cardComponent: CardComponent = EventCard
}: EventCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleCards, setVisibleCards] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);

  const total = events.length;
  const infiniteEvents = total > 0 ? [...events, ...events, ...events] : [];

  // ── Responsive card count ────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setVisibleCards(w < 640 ? 1 : w < 1024 ? 2 : 3);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoScroll || total === 0 || isPaused) return;
    const timer = setInterval(
      () => setCurrentIndex((p) => p + 1),
      autoScrollInterval
    );
    return () => clearInterval(timer);
  }, [autoScroll, autoScrollInterval, total, isPaused]);

  // ── Scroll sync + seamless infinite wrap ─────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || total === 0) return;

    const gap = 24;
    const cardW = (el.offsetWidth - gap * (visibleCards - 1)) / visibleCards;
    const scrollTo = currentIndex * (cardW + gap);
    el.scrollTo({ left: scrollTo, behavior: "smooth" });

    if (currentIndex >= total * 2) {
      setTimeout(() => {
        el.scrollTo({ left: total * (cardW + gap), behavior: "auto" });
        setCurrentIndex(total);
      }, 500);
    } else if (currentIndex < total) {
      setTimeout(() => {
        el.scrollTo({
          left: (total + currentIndex) * (cardW + gap),
          behavior: "auto"
        });
        setCurrentIndex(total + currentIndex);
      }, 500);
    }
  }, [currentIndex, total, visibleCards]);

  // ── Touch / drag handlers ────────────────────────────────────────────────
  const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    const y = "touches" in e ? e.touches[0].clientY : 0;
    touchStartX.current = x;
    touchEndX.current = x;
    touchStartY.current = y;
    isDragging.current = false;
    hasMoved.current = false;
    setIsPaused(true);
  };

  const onDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    const y = "touches" in e ? e.touches[0].clientY : 0;
    touchEndX.current = x;
    const dX = Math.abs(x - touchStartX.current);
    const dY = Math.abs(y - touchStartY.current);
    if (dX > 10 || dY > 10) {
      hasMoved.current = true;
      if (dX > dY) {
        isDragging.current = true;
      }
    }
  };

  const onDragEnd = () => {
    if (isDragging.current && hasMoved.current) {
      const dist = touchStartX.current - touchEndX.current;
      if (Math.abs(dist) > 50) setCurrentIndex((p) => p + (dist > 0 ? 1 : -1));
    }
    isDragging.current = false;
    hasMoved.current = false;
    setTimeout(() => setIsPaused(false), 1000);
  };

  const goTo = (i: number) => setCurrentIndex(total + i);
  const prev = () => setCurrentIndex((p) => p - 1);
  const next = () => setCurrentIndex((p) => p + 1);
  const normalized = ((currentIndex % total) + total) % total;

  if (total === 0) return null;

  return (
    <Card
      className={`relative border-2 ${borderClass} shadow-sm hover:shadow-md transition-all`}
      style={{
        // Darker translucent grey — sits above the page bg without being pitch black
        background: "rgba(20, 20, 19, 0.55)",
        backdropFilter: "blur(8px)",
        overflow: "visible" // never clip node corners or card lift
      }}
    >
      {/* Heading — only rendered when title is provided */}
      {(title || children) && (
        <CardHeader>
          {title && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl mb-1">
                  {icon}
                  {title}
                </CardTitle>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
          )}
          {children}
        </CardHeader>
      )}

      <CardContent className={!title && !children ? "pt-6" : ""}>
        {/*
          Track: overflow-x-hidden to prevent horizontal scroll bleed,
          but padding gives vertical room for corner nodes (NODE_R=5px) and
          card hover lift (~4px) so they never get clipped.
        */}
        <div
          ref={scrollRef}
          className="flex gap-6 select-none touch-pan-y"
          style={{
            overflowX: "hidden",
            overflowY: "visible",
            paddingTop: 8,
            paddingBottom: 8,
            scrollbarWidth: "none"
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          {infiniteEvents.map((event, idx) => (
            <div
              key={`${event.id}-${idx}`}
              className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
              style={{
                touchAction: "pan-y",
                pointerEvents: isDragging.current ? "none" : "auto"
              }}
            >
              <CardComponent
                event={event}
                source={source}
                initialFavourited={userFavourites.has(event.id)}
              />
            </div>
          ))}
        </div>

        {/* Controls — centred, arrows flanking the dot indicators */}
        {showProgress && total > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={prev}
              className={`h-8 w-8 border-2 ${borderClass} hover:scale-110 active:scale-95 transition-all`}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Dot indicators */}
            <div className="flex items-center gap-2">
              {events.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="rounded-full transition-all duration-300 hover:scale-125"
                  style={{
                    width: i === normalized ? 24 : 6,
                    height: 6,
                    background:
                      i === normalized
                        ? "var(--primary)"
                        : "rgba(255,255,255,0.25)"
                  }}
                  aria-label={`Go to ${i + 1}`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={next}
              className={`h-8 w-8 border-2 ${borderClass} hover:scale-110 active:scale-95 transition-all`}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
