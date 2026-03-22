'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { Calendar, DollarSign, TrendingUp, LayoutGrid } from 'lucide-react';
import { GraphNodeTabs, type GraphTab } from '@/components/ui/GraphNodeTabs';
import { HoddleGrid } from '@/components/effects/HoddleGrid';
import { TimelineChart } from '@/components/analytics/TimelineChart';
import { PriceDistributionChart } from '@/components/analytics/PriceDistributionChart';
import { PopularityScatterChart } from '@/components/analytics/PopularityScatterChart';

// ─── Insight tabs ─────────────────────────────────────────────────────────────
const TABS: GraphTab[] = [
  { id: 'timeline',   label: 'Events Timeline',    Icon: Calendar   },
  { id: 'price',      label: 'Price Distribution', Icon: DollarSign },
  { id: 'popularity', label: 'Popularity Analysis',Icon: TrendingUp },
];
type TabId = 'timeline' | 'price' | 'popularity';

// ─── Drag / layout constants ──────────────────────────────────────────────────
const SNAP_BROWSE   = 0.60;
const SNAP_INSIGHTS = 0.40;
const DIVIDER_W     = 14;
const HEADER_H      = 52;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function graphHeightForWidth(w: number): number {
  if (w >= 800) return 600;
  if (w >= 520) return 740;
  return 920;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CategoryInsightsSplit() {
  const [browsePct,  setBrowsePct]  = useState(0.58);
  const [activeTab,  setActiveTab]  = useState<TabId>('timeline');
  const [mounted,    setMounted]    = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(900);

  const containerRef = useRef<HTMLDivElement>(null);
  const animPct      = useRef(0.58);
  const rafId        = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Track container width for dynamic height calculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Lerp animPct → CSS vars for opacity/width
  useEffect(() => {
    const draw = () => {
      animPct.current += (browsePct - animPct.current) * 0.10;
      const pct = animPct.current;
      const el  = containerRef.current;
      if (el) {
        el.style.setProperty('--browse-pct', String(pct));
        el.style.setProperty('--browse-opacity',  String(pct >= 0.50 ? 1 : 0.55));
        el.style.setProperty('--insight-opacity', String(pct >= 0.50 ? 0.55 : 1));
      }
      rafId.current = requestAnimationFrame(draw);
    };
    rafId.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId.current);
  }, [browsePct]);

  // ── Container height: largest of both panels' natural heights ────────────
  const browseFullH   = graphHeightForWidth(containerWidth * browsePct) + HEADER_H + 48;
  const insightsFullH = 640 + HEADER_H;
  const containerH    = Math.max(Math.round(lerp(insightsFullH, browseFullH, browsePct)), 600);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setBrowsePct(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }, [isDragging]);

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setBrowsePct(prev => {
      if (prev < 0.08) return 0;
      if (prev > 0.92) return 1;
      return prev > 0.52 ? SNAP_BROWSE : SNAP_INSIGHTS;
    });
  }, [isDragging]);

  const expandBrowse   = () => setBrowsePct(0);
  const expandInsights = () => setBrowsePct(1);
  const restoreBrowse  = () => setBrowsePct(SNAP_BROWSE);
  const restoreInsights= () => setBrowsePct(SNAP_INSIGHTS);

  const browseFocused = browsePct >= 0.50;

  const ActiveChart = () => {
    if (activeTab === 'timeline')   return <TimelineChart />;
    if (activeTab === 'price')      return <PriceDistributionChart />;
    if (activeTab === 'popularity') return <PopularityScatterChart />;
    return null;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex overflow-hidden rounded-2xl"
      style={{
        border:     '1.5px solid var(--border)',
        height:     containerH,
        minHeight:  600,
        cursor:     isDragging ? 'col-resize' : 'default',
        userSelect: isDragging ? 'none' : 'auto',
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* ── Continuous header border ────────────────────────────────── */}
      <div aria-hidden style={{
        position: 'absolute', top: HEADER_H, left: 0, right: 0,
        height: 1, background: 'var(--border)', zIndex: 25, pointerEvents: 'none',
      }} />

      {/* ── Restore overlays (shown only when a panel is fully hidden) ── */}
      {browsePct === 0 && (
        <div className="absolute top-0 left-0 z-30 flex items-center px-4"
          style={{ height: HEADER_H, background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={restoreBrowse}
            className="text-xs font-semibold flex items-center gap-1.5 hover:opacity-75"
            style={{ color: 'var(--primary)' }}>
            <LayoutGrid className="h-3.5 w-3.5" /> ← Show Browse
          </button>
        </div>
      )}
      {browsePct === 1 && (
        <div className="absolute top-0 right-0 z-30 flex items-center px-4"
          style={{ height: HEADER_H, background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={restoreInsights}
            className="text-xs font-semibold flex items-center gap-1.5 hover:opacity-75"
            style={{ color: 'var(--primary)' }}>
            Show Insights → <TrendingUp className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Browse panel ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col transition-opacity duration-300"
        style={{
          width:    `calc(var(--browse-pct, ${browsePct}) * 100% - ${DIVIDER_W / 2}px)`,
          opacity:  'var(--browse-opacity, 1)',
          minWidth: 0, overflow: 'hidden',
        }}
      >
        <div className="flex items-center justify-between px-5 shrink-0" style={{ height: HEADER_H }}>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="font-semibold text-sm">Browse by Category</span>
          </div>
          {browsePct > 0 && !browseFocused && (
            <button onClick={expandBrowse} className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--primary)' }}>← Expand</button>
          )}
        </div>
        <div className="flex-1 overflow-hidden flex items-center justify-center" style={{ minHeight: 0 }}>
          <HoddleGrid />
        </div>
      </div>

      {/* ── Draggable divider ────────────────────────────────────────── */}
      <div
        onPointerDown={onDividerPointerDown}
        className="shrink-0 flex items-center justify-center relative z-20"
        style={{ width: DIVIDER_W, cursor: 'col-resize' }}
      >
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%',
          transform: 'translateX(-50%)',
          width:      isDragging ? 3 : 1,
          background: isDragging ? `rgba(251,146,60,0.70)` : 'var(--border)',
          transition: 'none',
        }} />
        <div className="flex flex-col gap-[3px] relative z-10 pointer-events-none"
          style={{ opacity: isDragging ? 1 : 0.40 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} className="rounded-full" style={{
              width: 3, height: 3,
              background: isDragging ? 'rgb(251,146,60)' : 'var(--muted-foreground)',
            }} />
          ))}
        </div>
      </div>

      {/* ── Insights panel ───────────────────────────────────────────── */}
      <div
        className="flex flex-col transition-opacity duration-300"
        style={{ flex: 1, opacity: 'var(--insight-opacity, 0.55)', minWidth: 0, overflow: 'hidden' }}
      >
        <div className="flex items-center justify-between px-5 shrink-0" style={{ height: HEADER_H }}>
          {browsePct < 1 && browseFocused && (
            <button onClick={expandInsights} className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--primary)' }}>Expand →</button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-semibold text-sm">Insights</span>
            <TrendingUp className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Vertical tab rail */}
          <div className="flex flex-col justify-center py-6 shrink-0"
            style={{ borderRight: '1px solid var(--border)', width: 120, overflow: 'visible' }}>
            <GraphNodeTabs
              tabs={TABS}
              activeId={activeTab}
              onChange={id => setActiveTab(id as TabId)}
              direction="vertical"
            />
          </div>

          {/* Active chart */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ minWidth: 0 }}>
            {mounted && (
              <Suspense fallback={
                <div className="flex items-center justify-center h-40">
                  <div className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(251,146,60,0.6)', borderTopColor: 'transparent' }} />
                </div>
              }>
                <ActiveChart />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}