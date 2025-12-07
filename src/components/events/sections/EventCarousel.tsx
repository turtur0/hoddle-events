'use client';

import { useEffect, useState, useRef } from 'react';
import { EventCard } from '@/components/events/cards/EventCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SerializedEvent } from '@/lib/models/Event';

interface EventCarouselProps {
  events: SerializedEvent[];
  userFavourites: Set<string>;
  title: string;
  description?: string;
  icon: React.ReactNode;
  source?: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
  borderClass?: string;
  gradientClass?: string;
  autoScroll?: boolean;
  autoScrollInterval?: number;
  showProgress?: boolean;
  children?: React.ReactNode;
}

export function EventCarousel({
  events,
  userFavourites,
  title,
  description,
  icon,
  source = 'direct',
  borderClass = 'border-primary/20',
  gradientClass = 'from-primary/5',
  autoScroll = true,
  autoScrollInterval = 5000,
  showProgress = true,
  children,
}: EventCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleCards, setVisibleCards] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isDragging = useRef(false);

  const totalEvents = events.length;
  const infiniteEvents = totalEvents > 0 ? [...events, ...events, ...events] : [];

  // Calculate visible cards based on screen size
  useEffect(() => {
    const updateVisibleCards = () => {
      const width = window.innerWidth;
      if (width < 640) setVisibleCards(1);
      else if (width < 1024) setVisibleCards(2);
      else setVisibleCards(3);
    };

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  // Auto-scroll timer
  useEffect(() => {
    if (!autoScroll || totalEvents === 0 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => prev + 1);
    }, autoScrollInterval);

    return () => clearInterval(timer);
  }, [autoScroll, autoScrollInterval, totalEvents, isPaused]);

  // Smooth infinite scroll with proper centring
  useEffect(() => {
    if (!scrollRef.current || totalEvents === 0) return;

    const container = scrollRef.current;
    const containerWidth = container.offsetWidth;
    const gap = 24;
    const cardWidth = (containerWidth - (gap * (visibleCards - 1))) / visibleCards;
    const scrollPos = currentIndex * (cardWidth + gap);

    container.scrollTo({ left: scrollPos, behavior: 'smooth' });

    // Seamless wrap - reset to middle section
    if (currentIndex >= totalEvents * 2) {
      setTimeout(() => {
        container.scrollTo({ left: totalEvents * (cardWidth + gap), behavior: 'auto' });
        setCurrentIndex(totalEvents);
      }, 500);
    } else if (currentIndex < totalEvents) {
      setTimeout(() => {
        container.scrollTo({ left: (totalEvents + currentIndex) * (cardWidth + gap), behavior: 'auto' });
        setCurrentIndex(totalEvents + currentIndex);
      }, 500);
    }
  }, [currentIndex, totalEvents, visibleCards]);

  // Touch/drag handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDragging.current = true;
    touchStartX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    touchEndX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const swipeDistance = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(swipeDistance) > threshold) {
      setCurrentIndex(prev => swipeDistance > 0 ? prev + 1 : prev - 1);
    }

    setTimeout(() => setIsPaused(false), 1000);
  };

  // Navigation
  const goToPrevious = () => setCurrentIndex(prev => prev - 1);
  const goToNext = () => setCurrentIndex(prev => prev + 1);
  const goToIndex = (index: number) => setCurrentIndex(totalEvents + index);

  const normalizedIndex = ((currentIndex % totalEvents) + totalEvents) % totalEvents;

  if (totalEvents === 0) return null;

  return (
    <Card className={`relative overflow-hidden border-2 ${borderClass} bg-linear-to-br ${gradientClass} via-transparent to-transparent shadow-sm hover:shadow-md hover:border-opacity-50 transition-all`}>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl mb-2">
              {icon}
              {title}
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevious}
              className={`h-8 w-8 sm:h-9 sm:w-9 border-2 ${borderClass} hover:border-opacity-70 transition-all hover:scale-110 active:scale-95`}
              aria-label="Previous event"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              className={`h-8 w-8 sm:h-9 sm:w-9 border-2 ${borderClass} hover:border-opacity-70 transition-all hover:scale-110 active:scale-95`}
              aria-label="Next event"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {children}
      </CardHeader>

      <CardContent>
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-hidden cursor-grab active:cursor-grabbing select-none"
          onMouseEnter={() => setIsPaused(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={(e) => {
            setIsPaused(false);
            handleTouchEnd();
          }}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {infiniteEvents.map((event, idx) => (
            <div
              key={`${event._id}-${idx}`}
              className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
              style={{ pointerEvents: isDragging.current ? 'none' : 'auto' }}
            >
              <EventCard
                event={event}
                source={source}
                initialFavourited={userFavourites.has(event._id)}
              />
            </div>
          ))}
        </div>

        {showProgress && totalEvents > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {events.map((_, index) => (
              <button
                key={index}
                onClick={() => goToIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-300 hover:scale-125 ${
                  index === normalizedIndex
                    ? 'w-8 bg-primary shadow-sm shadow-primary/50'
                    : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to event ${index + 1}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}