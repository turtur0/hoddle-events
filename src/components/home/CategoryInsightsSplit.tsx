'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { Calendar, DollarSign, TrendingUp, LayoutGrid } from 'lucide-react';
import { HoddleGrid } from '@/components/effects/HoddleGrid';
import { TimelineChart } from '@/components/analytics/TimelineChart';
import { PriceDistributionChart } from '@/components/analytics/PriceDistributionChart';
import { PopularityScatterChart } from '@/components/analytics/PopularityScatterChart';
// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'timeline',   label: 'Events Timeline',    Icon: Calendar,   desc: 'Distribution over 6 months' },
  { id: 'price',      label: 'Price Distribution', Icon: DollarSign, desc: 'Pricing patterns by category' },
  { id: 'popularity', label: 'Popularity Analysis',Icon: TrendingUp, desc: 'Price vs popularity' },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── BFS constants ────────────────────────────────────────────────────────────
const COLOR_LERP  = 0.065;
const BFS_GAMMA   = 0.50;
const TAB_RGB: [number, number, number] = [251, 146, 60];

// ─── Drag constants ───────────────────────────────────────────────────────────
const MIN_PCT = 0;      // allow full collapse to either side
const MAX_PCT = 1;
const SNAP_BROWSE   = 0.60;
const SNAP_INSIGHTS = 0.40;
const DIVIDER_W     = 14;  // wider for easier mobile grab

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Component ────────────────────────────────────────────────────────────────
export function CategoryInsightsSplit() {
  // browsePct = fraction of total width given to the browse panel
  const [browsePct, setBrowsePct] = useState(0.58);
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [mounted,   setMounted]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const animPct      = useRef(0.58);
  const [containerWidth, setContainerWidth] = useState(900); // tracks rendered width

  // BFS tab animation
  const colorT    = useRef<Float32Array>(new Float32Array(TABS.length));
  const targetT   = useRef<Float32Array>(new Float32Array(TABS.length));
  const tabRefs   = useRef<(HTMLDivElement | null)[]>(Array(TABS.length).fill(null));
  const lineRefs  = useRef<(HTMLDivElement | null)[]>(Array(TABS.length - 1).fill(null));
  const rafId     = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Track container width so we can compute the graph's layout height
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  function graphHeightForWidth(w: number): number {
    if (w >= 800) return 600;
    if (w >= 520) return 740;
    return 920;
  }

  const browseWidth    = containerWidth * browsePct;
  const graphHeight    = graphHeightForWidth(browseWidth);
  const HEADER_H       = 52;
  const GRAPH_PAD      = 48;
  // Insights panel natural height — tallest chart (PriceDistribution) ~560px + padding
  const INSIGHTS_MIN_H = 640;

  const browseFullH   = graphHeight + HEADER_H + GRAPH_PAD;
  const insightsFullH = INSIGHTS_MIN_H + HEADER_H;
  // Interpolate between both panels' full heights; container is always at least
  // as tall as whichever is currently dominant
  const containerH = Math.max(
    Math.round(lerp(insightsFullH, browseFullH, browsePct)),
    600  // hard floor
  );

  // ── BFS target update ───────────────────────────────────────────────────
  const updateTargets = useCallback((id: TabId) => {
    const sel = TABS.findIndex(t => t.id === id);
    for (let i = 0; i < TABS.length; i++) {
      const dist = Math.abs(i - sel);
      targetT.current[i] = dist === 0
        ? 1
        : Math.max(0, 1 - dist / TABS.length) ** BFS_GAMMA;
    }
  }, []);

  useEffect(() => { updateTargets(activeTab); }, [activeTab, updateTargets]);

  // ── RAF: BFS tab DOM writes + animPct lerp → CSS var ───────────────────
  useEffect(() => {
    const [r, g, b] = TAB_RGB;

    const draw = () => {
      // Lerp display split fraction
      animPct.current += (browsePct - animPct.current) * 0.10;
      const pct = animPct.current;

      // Write to container CSS var so both panels react
      const container = containerRef.current;
      if (container) {
        container.style.setProperty('--browse-pct', String(pct));
        // Focus: panel with > 52% is "focused", other is dimmed
        const browseFocused  = pct >= 0.50;
        const browseOpacity  = browseFocused  ? 1    : 0.55;
        const insightOpacity = !browseFocused ? 1    : 0.55;
        container.style.setProperty('--browse-opacity',  String(browseOpacity));
        container.style.setProperty('--insight-opacity', String(insightOpacity));
      }

      // BFS tab lerps
      for (let i = 0; i < TABS.length; i++) {
        colorT.current[i] += (targetT.current[i] - colorT.current[i]) * COLOR_LERP;
        const t  = colorT.current[i];
        const el = tabRefs.current[i];
        if (!el) continue;

        const isSelected = t > 0.92;

        const dot = el.querySelector<HTMLElement>('.tab-dot');
        if (dot) {
          if (isSelected) {
            // Selected: orange fill, orange border, glow
            dot.style.background  = `rgba(${r},${g},${b},0.18)`;
            dot.style.borderColor = `rgba(${r},${g},${b},0.90)`;
            dot.style.boxShadow   = `0 0 ${12 + t * 8}px rgba(${r},${g},${b},0.35)`;
            dot.style.transform   = 'scale(1.18)';
          } else {
            // Not selected: grey border, orange icon (handled on icon itself), faint BFS glow
            const bfsGlow = t * 0.18;
            dot.style.background  = 'transparent';
            dot.style.borderColor = `rgba(160,160,160,0.35)`;
            dot.style.boxShadow   = bfsGlow > 0.02 ? `0 0 ${t * 8}px rgba(${r},${g},${b},${bfsGlow})` : 'none';
            dot.style.transform   = 'scale(1)';
          }
        }

        const icon = el.querySelector<HTMLElement>('.tab-icon');
        if (icon) {
          // Icon always orange, brighter when selected
          icon.style.color   = `rgba(${r},${g},${b},${0.45 + t * 0.55})`;
          icon.style.opacity = String(0.55 + t * 0.45);
        }

        const label = el.querySelector<HTMLElement>('.tab-label');
        if (label) {
          if (isSelected) {
            label.style.color      = `rgba(${r},${g},${b},1)`;
            label.style.fontWeight = '700';
          } else {
            const grey = Math.round(lerp(0.40, 0.72, t) * 255);
            label.style.color      = `rgba(${grey},${grey},${grey},1)`;
            label.style.fontWeight = t > 0.5 ? '600' : '500';
          }
          label.style.opacity = String(0.5 + t * 0.5);
        }
      }

      // Line segments
      for (let i = 0; i < TABS.length - 1; i++) {
        const avgT = (colorT.current[i] + colorT.current[i + 1]) * 0.5;
        const seg  = lineRefs.current[i];
        if (seg) {
          seg.style.background = `rgba(${r},${g},${b},${0.10 + avgT * 0.40})`;
          seg.style.width      = `${1 + avgT * 1.5}px`;
        }
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId.current);
  }, [browsePct]);

  // ── Drag logic ──────────────────────────────────────────────────────────
  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const raw  = (e.clientX - rect.left) / rect.width;
    setBrowsePct(Math.min(MAX_PCT, Math.max(MIN_PCT, raw)));
  }, [isDragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    setBrowsePct(prev => {
      if (prev < 0.08) return 0;       // snap fully to insights
      if (prev > 0.92) return 1;       // snap fully to browse
      if (prev > 0.52) return SNAP_BROWSE;
      if (prev < 0.48) return SNAP_INSIGHTS;
      return prev;
    });
  }, [isDragging]);

  // Expand: each button expands the OTHER panel to full screen
  const expandBrowse   = () => setBrowsePct(0);   // expand insights → hide browse
  const expandInsights = () => setBrowsePct(1);   // expand browse → hide insights

  const ActiveChart = () => {
    if (activeTab === 'timeline')   return <TimelineChart />;
    if (activeTab === 'price')      return <PriceDistributionChart />;
    if (activeTab === 'popularity') return <PopularityScatterChart />;
    return null;
  };

  const browseFocused = browsePct >= 0.50;

  return (
    <div
      ref={containerRef}
      className="relative flex overflow-hidden rounded-2xl"
      style={{
        border:     '1.5px solid var(--border)',
        height:     `${containerH}px`,
        minHeight:  '600px',
        cursor:     isDragging ? 'col-resize' : 'default',
        userSelect: isDragging ? 'none' : 'auto',
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/*
        ── Restore buttons — absolute overlay, always visible ──────────────
        Lives outside both panels so overflow:hidden never clips them.
        Only shown when a panel is fully collapsed (browsePct === 0 or 1).
      */}
      {browsePct === 0 && (
        <div
          className="absolute top-0 left-0 z-30 flex items-center px-4"
          style={{ height: HEADER_H, borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <button
            onClick={expandBrowse}
            className="text-xs font-semibold flex items-center gap-1.5 hover:opacity-75 transition-opacity"
            style={{ color: 'var(--primary)' }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            ← Show Browse
          </button>
        </div>
      )}
      {browsePct === 1 && (
        <div
          className="absolute top-0 right-0 z-30 flex items-center px-4"
          style={{ height: HEADER_H, borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
        >
          <button
            onClick={expandInsights}
            className="text-xs font-semibold flex items-center gap-1.5 hover:opacity-75 transition-opacity"
            style={{ color: 'var(--primary)' }}
          >
            Show Insights →
            <TrendingUp className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Single continuous header border — spans full width, never broken */}
      <div
        aria-hidden="true"
        style={{
          position:   'absolute',
          top:        HEADER_H,
          left:       0,
          right:      0,
          height:     '1px',
          background: 'var(--border)',
          zIndex:     25,
          pointerEvents: 'none',
        }}
      />

      {/* ── Browse panel ──────────────────────────────────────────────── */}
      <div
        className="flex flex-col transition-opacity duration-300"
        style={{
          width:    `calc(var(--browse-pct, ${browsePct}) * 100% - ${DIVIDER_W / 2}px)`,
          opacity:  `var(--browse-opacity, 1)`,
          minWidth: 0,
          overflow: 'hidden',   // prevents header/content bleeding when width → 0
        }}
      >
        {/* Header: title left, expand-to-insights button right */}
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Browse by Category
            </span>
          </div>
          {browsePct > 0 && !browseFocused && (
            <button
              onClick={expandBrowse}
              className="text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--primary)' }}
            >
              ← Expand
            </button>
          )}
        </div>

        {/* HoddleGrid — centred in available space */}
        <div className="flex-1 overflow-hidden flex items-center justify-center" style={{ minHeight: 0 }}>
          <HoddleGrid />
        </div>
      </div>

      {/* ── Draggable divider — always rendered, wide hit area ────── */}
      <div
        onPointerDown={onDividerPointerDown}
        className="flex-shrink-0 flex items-center justify-center relative z-20"
        style={{
          width:      `${DIVIDER_W}px`,
          cursor:     'col-resize',
          background: 'transparent',
        }}
        title="Drag to resize"
      >
        {/* Thin visual line centred inside the wide hit area */}
        <div
          style={{
            position:   'absolute',
            top:        0,
            bottom:     0,
            left:       '50%',
            transform:  'translateX(-50%)',
            width:      isDragging ? '3px' : '1px',
            background: isDragging
              ? `rgba(${TAB_RGB.join(',')},0.70)`
              : 'var(--border)',
            transition: isDragging ? 'none' : 'background 0.2s ease, width 0.15s ease',
          }}
        />
        {/* Grip dots — centred */}
        <div
          className="flex flex-col gap-[3px] relative z-10 pointer-events-none"
          style={{ opacity: isDragging ? 1 : 0.45 }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width:      3,
                height:     3,
                background: isDragging ? `rgb(${TAB_RGB.join(',')})` : 'var(--muted-foreground)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Insights panel ────────────────────────────────────────────── */}
      <div
        className="flex flex-col transition-opacity duration-300"
        style={{
          flex:     1,
          opacity:  `var(--insight-opacity, 0.55)`,
          minWidth: 0,
          overflow: 'hidden',   // prevents header bleed when browse is fully expanded
        }}
      >
        {/* Header: expand-to-browse button left, title right */}
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        >
          {browsePct < 1 && browseFocused && (
            <button
              onClick={expandInsights}
              className="text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--primary)' }}
            >
              Expand →
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Insights
            </span>
            <TrendingUp className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          </div>
        </div>

        {/* Tab nav + chart */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── BFS vertical tab rail ───────────────────────────────── */}
          <div
            className="flex flex-col justify-center items-center py-6 flex-shrink-0"
            style={{
              borderRight: '1px solid var(--border)',
              width:       '120px',
              gap:         0,
            }}
          >
            {TABS.map((tab, i) => (
              <div key={tab.id} className="flex flex-col items-center w-full">
                {/* Tab row */}
                <div
                  ref={el => { tabRefs.current[i] = el; }}
                  onClick={() => {
                    setActiveTab(tab.id);
                    updateTargets(tab.id);
                  }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 w-full cursor-pointer"
                >
                  {/* Dot */}
                  <div
                    className="tab-dot rounded-full border-2 flex items-center justify-center"
                    style={{
                      width:  30, height: 30,
                      transition: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <tab.Icon
                      className="tab-icon"
                      style={{ width: 13, height: 13, transition: 'none' }}
                    />
                  </div>

                  {/* Label */}
                  <span
                    className="tab-label text-center leading-tight"
                    style={{ fontSize: '0.68rem', transition: 'none' }}
                  >
                    {tab.label}
                  </span>
                </div>

                {/* Connecting line */}
                {i < TABS.length - 1 && (
                  <div
                    ref={el => { lineRefs.current[i] = el; }}
                    style={{
                      width:        '1.5px',
                      height:       '18px',
                      background:   `rgba(${TAB_RGB.join(',')},0.10)`,
                      borderRadius: '1px',
                      flexShrink:   0,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Active chart ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ minWidth: 0 }}>
            {mounted && (
              <Suspense fallback={
                <div className="flex items-center justify-center h-40">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `rgba(${TAB_RGB.join(',')},0.6)`, borderTopColor: 'transparent' }}
                  />
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