'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, TrendingUp, Sparkles, Calendar, LayoutGrid, List } from 'lucide-react';
import { GraphNodeTabs } from '@/components/ui/GraphNodeTabs';
import { EventCarousel } from '@/components/events/sections/EventCarousel';
import { EventCard } from '@/components/events/cards/EventCard';
import { Button } from '@/components/ui/Button';
import type { EventResponse } from '@/lib/transformers/event-transformer';

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const ALL_TABS = [
  { id: 'foryou',   label: 'For You',     Icon: Heart      },
  { id: 'trending', label: 'Trending',    Icon: TrendingUp },
  { id: 'gems',     label: 'Hidden Gems', Icon: Sparkles   },
  { id: 'week',     label: 'This Week',   Icon: Calendar   },
  { id: 'month',    label: 'This Month',  Icon: Calendar   },
] as const;
type TabId = typeof ALL_TABS[number]['id'];

// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchEvents(tabId: TabId): Promise<EventResponse[]> {
  try {
    let url: string;
    if (tabId === 'foryou') {
      url = '/api/recommendations?limit=12';
    } else if (tabId === 'trending') {
      url = '/api/recommendations/trending?type=trending&limit=12';
    } else if (tabId === 'gems') {
      url = '/api/recommendations/trending?type=undiscovered&limit=12';
    } else {
      const now = new Date();
      const end = tabId === 'week'
        ? new Date(now.getTime() + 7 * 86400000)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0);
      url = `/api/events?sort=date-soon&dateTo=${end.toISOString().split('T')[0]}`;
    }
    const r = await fetch(url, tabId === 'foryou' ? { cache: 'no-store' } : {});
    if (!r.ok) return [];
    const d = await r.json();
    const raw = d.recommendations ?? d.events ?? [];
    return raw.slice(0, tabId === 'month' ? 24 : 12);
  } catch { return []; }
}

// ─── Component ────────────────────────────────────────────────────────────────
interface EventsShowcaseProps {
  userFavourites: Set<string>;
  isLoggedIn:     boolean;
}

export function EventsShowcase({ userFavourites, isLoggedIn }: EventsShowcaseProps) {
  const tabs      = isLoggedIn ? [...ALL_TABS] : ALL_TABS.filter(t => t.id !== 'foryou');
  const firstTab  = (tabs[0].id) as TabId;

  const [activeId,  setActiveId]  = useState<TabId>(firstTab);
  const [viewMode,  setViewMode]  = useState<'carousel' | 'grid'>('carousel');
  const [cache,     setCache]     = useState<Partial<Record<TabId, EventResponse[]>>>({});
  const [loading,   setLoading]   = useState(false);

  const OR = 251, OG = 146, OB = 60;

  useEffect(() => {
    if (cache[activeId]) return;
    setLoading(true);
    fetchEvents(activeId)
      .then(events => setCache(prev => ({ ...prev, [activeId]: events })))
      .finally(() => setLoading(false));
  }, [activeId, cache]);

  const handleTabChange = (id: string) => {
    setActiveId(id as TabId);
    setViewMode('carousel');
  };

  const events = cache[activeId] ?? [];
  const activeTab = tabs.find(t => t.id === activeId)!;

  return (
    <section className="section-spacing" style={{ position: 'relative', zIndex: 1 }}>
      <div className="container-page">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-1">Discover</h2>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.95rem' }}>
              Events curated for Melbourne
            </p>
          </div>

          {/* View toggle */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {([['carousel', List, 'Carousel'], ['grid', LayoutGrid, 'Grid']] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background:  viewMode === mode ? `rgba(${OR},${OG},${OB},0.15)` : 'transparent',
                  color:       viewMode === mode ? `rgb(${OR},${OG},${OB})` : 'rgba(255,255,255,0.45)',
                  border:      viewMode === mode ? `1px solid rgba(${OR},${OG},${OB},0.35)` : '1px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/*
          Two-div approach: outer handles horizontal scroll without clipping.
          Inner has NO overflow so box-shadow glows render freely in all directions.
          (CSS spec: setting overflow-x to anything forces overflow-y away from visible,
          so scroll and visible glow must live on separate elements.)
        */}
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
          <div style={{ minWidth: 'max-content' }}>
            <GraphNodeTabs
              tabs={tabs}
              activeId={activeId}
              onChange={handleTabChange}
              direction="horizontal"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-80 rounded-xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'var(--muted-foreground)' }}>
            <p className="text-sm mb-4">No events found right now.</p>
            <Button asChild variant="outline">
              <Link href="/events">Browse All Events</Link>
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid — all events, overflow visible for card lift + corner nodes
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            style={{ padding: '8px' }}   // inset so corner nodes aren't clipped
          >
            {events.map(event => (
              <EventCard
                key={event.id}
                event={event}
                source="homepage"
                initialFavourited={userFavourites.has(event.id)}
              />
            ))}
          </div>
        ) : (
          // Carousel — reuse EventCarousel for proper scroll + mobile drag
          // Wrap in overflow:visible container so corner nodes & card lift aren't clipped
          <div style={{ padding: '8px', margin: '-8px' }}>
            <EventCarousel
              events={events}
              userFavourites={userFavourites}
              source="homepage"
              borderClass="border-transparent"
              autoScroll={false}
              showProgress
            />
          </div>
        )}
      </div>
    </section>
  );
}