'use client';

import { useEffect, useRef, Suspense } from 'react';
import { ChevronDown } from 'lucide-react';
import { Barlow } from 'next/font/google';
import { SearchBar } from '@/components/events/filters/SearchBar';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['900'],
  variable: '--font-barlow',
});

type Rgb = [number, number, number];

interface GraphNode {
  nx: number; ny: number;
  phase: number;
  layer: number;
  tile: ImageTile | null;
}
interface ImageTile { color: string; rotation: number; w: number; h: number; }

interface Props {
  totalEvents: number;
  archivedEvents: number;
  sourceCount: number;
}

const LAYER_SPEED = [0.15, 0.32, 0.52];

type CNode = { nx: number; ny: number; color?: string; layer: number };

const CLUSTER_A: CNode[] = [
  { nx: 0.05, ny: 0.12, color: '#f43f5e', layer: 0 }, { nx: 0.18, ny: 0.28, layer: 0 },
  { nx: 0.12, ny: 0.45, color: '#14b8a6', layer: 0 }, { nx: 0.28, ny: 0.18, layer: 0 },
  { nx: 0.08, ny: 0.62, layer: 0 },                   { nx: 0.22, ny: 0.55, color: '#a855f7', layer: 0 },
  { nx: 0.35, ny: 0.40, layer: 0 },
];
const CLUSTER_B: CNode[] = [
  { nx: 0.50, ny: 0.08, color: '#f97316', layer: 1 }, { nx: 0.65, ny: 0.20, layer: 1 },
  { nx: 0.78, ny: 0.10, color: '#10b981', layer: 1 }, { nx: 0.88, ny: 0.28, layer: 1 },
  { nx: 0.72, ny: 0.38, color: '#0ea5e9', layer: 1 }, { nx: 0.58, ny: 0.30, layer: 1 },
  { nx: 0.90, ny: 0.55, color: '#f43f5e', layer: 1 }, { nx: 0.76, ny: 0.62, layer: 1 },
];
const CLUSTER_C: CNode[] = [
  { nx: 0.15, ny: 0.72, color: '#f97316', layer: 2 }, { nx: 0.30, ny: 0.82, layer: 2 },
  { nx: 0.48, ny: 0.75, color: '#a855f7', layer: 2 }, { nx: 0.62, ny: 0.85, layer: 2 },
  { nx: 0.78, ny: 0.78, color: '#14b8a6', layer: 2 }, { nx: 0.92, ny: 0.72, layer: 2 },
  { nx: 0.42, ny: 0.92, layer: 2 },
];
const ALL_CLUSTERS = [CLUSTER_A, CLUSTER_B, CLUSTER_C];

function sr(s: number) { return Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5453) % 1; }
function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function buildGraphNodes() {
  const nodes: GraphNode[][] = [];
  const edges: [number, number][][] = [];
  const COLORS = ['#f97316','#f43f5e','#14b8a6','#a855f7','#10b981','#0ea5e9'];

  ALL_CLUSTERS.forEach((cluster, ci) => {
    const cn: GraphNode[] = cluster.map((c, i) => ({
      nx: c.nx, ny: c.ny,
      phase: sr((ci * 100 + i) * 5.3) * Math.PI * 2,
      layer: c.layer,
      tile: c.color ? {
        color: c.color,
        rotation: (sr(ci * 50 + i * 2.1) - 0.5) * 0.20,
        w: 80 + sr(ci * 30 + i * 3.1) * 36,
        h: 56 + sr(ci * 30 + i * 7.3) * 26,
      } : null,
    }));
    nodes.push(cn);

    const edgeSet = new Set<number>();
    const ce: [number, number][] = [];
    cn.forEach((n, i) => {
      cn.map((m, j) => ({ j, d: Math.hypot(n.nx - m.nx, n.ny - m.ny) }))
        .filter(o => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 2)
        .forEach(({ j }) => {
          const k = Math.min(i, j) * 1000 + Math.max(i, j);
          if (!edgeSet.has(k)) { edgeSet.add(k); ce.push([i, j]); }
        });
    });
    edges.push(ce);
  });
  return { nodes, edges };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

export function HeroSection({ totalEvents, archivedEvents, sourceCount }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const sectionRef   = useRef<HTMLElement>(null);
  const nodesRef     = useRef<GraphNode[][]>([]);
  const edgesRef     = useRef<[number, number][][]>([]);
  const scrollY      = useRef(0);
  const rafId        = useRef(0);

  useEffect(() => {
    const { nodes, edges } = buildGraphNodes();
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const W = window.innerWidth, H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    const getProgress = () => {
      const heroH = sectionRef.current?.offsetHeight ?? window.innerHeight;
      return Math.min(1, window.scrollY / heroH);
    };

    const onScroll = () => { scrollY.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    const draw = (ts: number) => {
      const W = window.innerWidth, H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      const sy       = scrollY.current;
      const progress = getProgress();
      const waveY = progress * H * 1.85;
      const DA = 5, DS = 0.00020;

      // Read primary colour from CSS variable each frame so it stays in sync
      const primaryRgb = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary').trim();
      // --primary is oklch — convert to a usable rgb fallback via a temp element
      // Simpler: just use the known dark-mode rgb equivalent directly from the token
      // oklch(0.70 0.16 42) ≈ rgb(251, 146, 60) — cached constant, matches globals.css
      const OR = 251, OG = 146, OB = 60;

      nodesRef.current.forEach((clusterNodes, ci) => {
        const pos = clusterNodes.map(n => ({
          x: n.nx * W + DA * Math.sin(ts * DS + n.phase),
          y: n.ny * H + DA * Math.cos(ts * DS * 0.7 + n.phase + 1.3) - sy * LAYER_SPEED[n.layer],
        }));

        // ── Edges ──────────────────────────────────────────────────────────
        for (const [ai, bi] of edgesRef.current[ci]) {
          const a = pos[ai], b = pos[bi];

          // Always draw the base white edge
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(255,255,255,0.13)';
          ctx.lineWidth   = 0.8;
          ctx.stroke();

          const topPt    = a.y <= b.y ? a : b;
          const botPt    = a.y <= b.y ? b : a;
          const edgeMinY = topPt.y;
          const edgeMaxY = botPt.y;

          if (waveY <= edgeMinY) continue; // wave hasn't reached top of this edge

          if (waveY >= edgeMaxY) {
            // Fully lit — entire edge orange
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${OR},${OG},${OB},0.60)`;
            ctx.lineWidth   = 1.4;
            ctx.stroke();
          } else {
            // Partially lit — find the point where y = waveY along the edge
            const frac   = (waveY - topPt.y) / (botPt.y - topPt.y);
            const headX  = topPt.x + frac * (botPt.x - topPt.x);
            const headY  = waveY;

            ctx.beginPath();
            ctx.moveTo(topPt.x, topPt.y);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = `rgba(${OR},${OG},${OB},0.65)`;
            ctx.lineWidth   = 1.5;
            ctx.stroke();

            // Glowing head at the wave front
            ctx.beginPath();
            ctx.arc(headX, headY, 3.5, 0, Math.PI * 2);
            ctx.shadowBlur  = 14;
            ctx.shadowColor = `rgba(${OR},${OG},${OB},0.95)`;
            ctx.fillStyle   = 'rgba(255,200,100,1)';
            ctx.fill();
            ctx.shadowBlur  = 0;
          }
        }

        // ── Nodes ──────────────────────────────────────────────────────────
        clusterNodes.forEach((n, i) => {
          const { x, y } = pos[i];
          const lit    = y < waveY;
          const atWave = lit && waveY - y < 28;

          if (!n.tile) {
            ctx.beginPath();
            ctx.arc(x, y, atWave ? 5 : 3, 0, Math.PI * 2);
            if (atWave) {
              ctx.shadowBlur  = 14;
              ctx.shadowColor = `rgba(${OR},${OG},${OB},0.90)`;
              ctx.fillStyle   = 'rgba(255,200,100,1)';
            } else {
              ctx.shadowBlur = 0;
              ctx.fillStyle  = lit ? `rgba(${OR},${OG},${OB},0.55)` : 'rgba(255,255,255,0.25)';
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            return;
          }

          const { color, rotation, w, h } = n.tile;
          const [r, g, b] = hexToRgb(color);
          ctx.save();
          ctx.translate(x, y); ctx.rotate(rotation);
          ctx.shadowBlur  = 16; ctx.shadowColor = `rgba(${r},${g},${b},0.25)`;
          ctx.fillStyle   = `rgba(${r},${g},${b},${lit ? 0.36 : 0.20})`;
          roundRect(ctx, -w/2, -h/2, w, h, 8); ctx.fill();
          ctx.shadowBlur  = 0;
          ctx.strokeStyle = `rgba(${r},${g},${b},${lit ? 0.72 : 0.45})`;
          ctx.lineWidth   = lit ? 2.0 : 1.4;
          roundRect(ctx, -w/2, -h/2, w, h, 8); ctx.stroke();
          ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`;
          ctx.lineWidth   = 0.5;
          for (let lx = -w/2; lx < w/2; lx += 14) {
            ctx.beginPath(); ctx.moveTo(lx, -h/2); ctx.lineTo(lx + h, h/2); ctx.stroke();
          }
          ctx.restore();
        });
      });

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden" style={{ minHeight: '100svh' }}>

      {/* ── Background canvas ── */}
      <div className="absolute inset-0" aria-hidden="true">
        <canvas ref={canvasRef} className="absolute inset-0" />
        {/* Tint */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05) 100%)',
        }} />
        {/* Fade into page */}
        <div className="absolute bottom-0 left-0 right-0 h-44" style={{
          background: 'linear-gradient(to bottom, transparent, var(--background))',
        }} />
      </div>

      {/* ── Foreground ── */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center px-4"
        style={{ minHeight: '100svh', paddingBottom: '5rem' }}
      >
        {/* HODDLE — Barlow Black, orange */}
        <h1
          className={barlow.className}
          style={{
            fontSize:      'clamp(4.5rem, 15vw, 13rem)',
            fontWeight:    900,
            letterSpacing: '-0.03em',
            lineHeight:    1,
            color:         'var(--primary)',
            marginBottom:  '0.75rem',
          }}
        >
          HODDLE
        </h1>

        {/* Subtitle — stats folded in on second line */}
        <p
          className="mb-10 font-medium"
          style={{
            fontSize:      'clamp(0.95rem, 2.2vw, 1.35rem)',
            letterSpacing: '0.01em',
            color:         'rgba(255,255,255,0.72)',
            lineHeight:    1.6,
          }}
        >
          Every Melbourne Event,{' '}
          <span style={{ color: 'var(--primary)' }}>One Platform</span>
          <br />
          <span style={{ fontSize: '0.78em', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            {totalEvents.toLocaleString()}+ active · {archivedEvents.toLocaleString()}+ archived · updated daily from {sourceCount} sources
          </span>
        </p>

        {/* Search bar — single translucent pill, CSS vars for colour */}
        <div className="w-full max-w-2xl">
          {/*
            One styled shell div. All inner SearchBar elements (form, input, divs)
            get border/bg reset to transparent so only this shell is visible.
          */}
          <style>{`
            .hero-search-shell {
              background:             rgba(255,255,255,0.09);
              backdrop-filter:        blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border-radius:          0.75rem;
              border:                 1.5px solid var(--primary);
              opacity:                0.85;
              transition:             border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
            }
            .hero-search-shell:focus-within {
              opacity:      1;
              border-color: var(--ring);
              box-shadow:   0 0 0 3px color-mix(in oklch, var(--primary) 22%, transparent);
            }
            /* Reset every inner element to transparent/borderless */
            .hero-search-shell form,
            .hero-search-shell > div,
            .hero-search-shell [class] {
              background:    transparent !important;
              border:        none !important;
              border-radius: 0 !important;
              box-shadow:    none !important;
            }
            .hero-search-shell input {
              background:    transparent !important;
              color:         rgba(255,255,255,0.88) !important;
              border:        none !important;
              outline:       none !important;
              box-shadow:    none !important;
            }
            .hero-search-shell input::placeholder {
              color: rgba(255,255,255,0.36) !important;
            }
            /* Search submit button */
            .hero-search-shell button[type="submit"] {
              background:    var(--primary) !important;
              color:         var(--primary-foreground) !important;
              border-radius: 0.5rem !important;
              padding:       0 1.1rem !important;
              font-weight:   600 !important;
              font-size:     0.85rem !important;
              height:        2.2rem !important;
              margin-right:  0.35rem !important;
              transition:    background 0.15s ease !important;
              white-space:   nowrap !important;
            }
            .hero-search-shell button[type="submit"]:hover {
              background: color-mix(in oklch, var(--primary) 85%, black) !important;
            }
            /* Icon buttons (clear, etc.) */
            .hero-search-shell button:not([type="submit"]) svg {
              color: rgba(255,255,255,0.50) !important;
            }
          `}</style>
          <div className="hero-search-shell">
            <Suspense fallback={
              <div className="h-14 rounded-full" style={{ background: 'rgba(255,255,255,0.09)' }} />
            }>
              <SearchBar />
            </Suspense>
          </div>
        </div>
      </div>

      {/* ── Scroll cue ── */}
      <button
        onClick={() => sectionRef.current?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 cursor-pointer"
        style={{ color: 'rgba(255,255,255,0.38)', border: 'none', background: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.38)')}
        aria-label="Scroll to explore"
      >
        <span className="text-xs font-semibold uppercase" style={{ letterSpacing: '0.16em' }}>Explore</span>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </button>
    </section>
  );
}