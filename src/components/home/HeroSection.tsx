'use client';

import { useEffect, useRef, Suspense } from 'react';
import { ChevronDown } from 'lucide-react';
import { Barlow } from 'next/font/google';
import { SearchBar } from '@/components/events/filters/SearchBar';

const barlow = Barlow({ subsets: ['latin'], weight: ['900'], variable: '--font-barlow' });

type Rgb = [number, number, number];

interface GraphNode {
  rx: number; ry: number;   // rest position (normalised 0–1)
  x:  number; y:  number;   // current world position
  vx: number; vy: number;
  phase: number;
  layer: number;
  tile: { color: string; rotation: number; w: number; h: number } | null;
}

interface Props {
  totalEvents: number;
  archivedEvents: number;
  sourceCount: number;
}

// ─── Layer visual config ──────────────────────────────────────────────────────
const LAYER = {
  parallax:  [0.08, 0.22, 0.48],
  alpha:     [0.20, 0.45, 0.85],
  edgeAlpha: [0.08, 0.18, 0.36],
  speed:     [0.00016, 0.00026, 0.00038],
  amp:       [8, 14, 22],           // dramatic float — was 3/5.5/9
  glow:      [0, 8, 22],
};

// ─── Cluster node definitions ─────────────────────────────────────────────────
const CLUSTERS: Array<Array<{ nx: number; ny: number; color?: string; layer: number }>> = [
  // Layer 0 — background, corners
  [
    { nx: 0.04, ny: 0.10, color: '#f43f5e', layer: 0 },
    { nx: 0.16, ny: 0.30, layer: 0 },
    { nx: 0.08, ny: 0.55, color: '#14b8a6', layer: 0 },
    { nx: 0.26, ny: 0.18, layer: 0 },
    { nx: 0.06, ny: 0.75, layer: 0 },
    { nx: 0.20, ny: 0.62, color: '#a855f7', layer: 0 },
    { nx: 0.88, ny: 0.14, layer: 0 },
    { nx: 0.94, ny: 0.40, color: '#10b981', layer: 0 },
    { nx: 0.82, ny: 0.68, layer: 0 },
    { nx: 0.92, ny: 0.80, layer: 0 },
  ],
  // Layer 1 — midground
  [
    { nx: 0.72, ny: 0.08, color: '#f97316', layer: 1 },
    { nx: 0.85, ny: 0.22, layer: 1 },
    { nx: 0.78, ny: 0.38, color: '#0ea5e9', layer: 1 },
    { nx: 0.60, ny: 0.18, layer: 1 },
    { nx: 0.18, ny: 0.82, color: '#f43f5e', layer: 1 },
    { nx: 0.34, ny: 0.90, layer: 1 },
    { nx: 0.52, ny: 0.85, color: '#a855f7', layer: 1 },
    { nx: 0.68, ny: 0.78, layer: 1 },
  ],
  // Layer 2 — foreground, crosses over content zone deliberately
  [
    { nx: 0.06, ny: 0.40, color: '#f97316', layer: 2 },
    { nx: 0.20, ny: 0.54, layer: 2 },
    { nx: 0.90, ny: 0.44, color: '#14b8a6', layer: 2 },
    { nx: 0.76, ny: 0.60, layer: 2 },
    { nx: 0.32, ny: 0.26, color: '#f43f5e', layer: 2 },
    { nx: 0.68, ny: 0.30, color: '#0ea5e9', layer: 2 },
  ],
];

function sr(s: number) { return Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5453) % 1; }
function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function buildGraph() {
  return CLUSTERS.map((cluster, ci) => {
    const nodes: GraphNode[] = cluster.map((c, i) => ({
      rx: c.nx, ry: c.ny,
      x: c.nx, y: c.ny,
      vx: 0, vy: 0,
      phase: sr((ci * 100 + i) * 5.3) * Math.PI * 2,
      layer: c.layer,
      tile: c.color ? {
        color: c.color,
        rotation: (sr(ci * 50 + i * 2.1) - 0.5) * 0.22,
        w: 70 + sr(ci * 30 + i * 3.1) * 40,
        h: 48 + sr(ci * 30 + i * 7.3) * 28,
      } : null,
    }));

    const edgeSet = new Set<number>();
    const edges: [number, number][] = [];
    nodes.forEach((n, i) => {
      nodes
        .map((m, j) => ({ j, d: Math.hypot(n.rx - m.rx, n.ry - m.ry) }))
        .filter(o => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach(({ j }) => {
          const k = Math.min(i, j) * 1000 + Math.max(i, j);
          if (!edgeSet.has(k)) { edgeSet.add(k); edges.push([i, j]); }
        });
    });

    return { nodes, edges };
  });
}

// Physics
const SK     = 0.032;
const DAMP   = 0.80;
const MOUSE_R = 150;
const MOUSE_F = 60;

// Localised glow: how far along the edge the glow "spotlight" reaches
const EDGE_GLOW_R  = 90;   // world-space radius for edge glow
const NODE_GLOW_R  = 70;
// Orange primary
const OR = 251, OG = 146, OB = 60;

// ─── Render a single cluster onto a given canvas context ─────────────────────
function renderCluster(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: [number, number][],
  mx: number, my: number,
  ts: number, sy: number,
  W: number, H: number,
) {
  const layer      = nodes[0].layer;
  const speed      = LAYER.speed[layer];
  const amp        = LAYER.amp[layer];
  const py         = sy * LAYER.parallax[layer];
  const baseEdgeA  = LAYER.edgeAlpha[layer];
  const baseNodeA  = LAYER.alpha[layer];
  const glowRadius = LAYER.glow[layer];

  // Physics
  nodes.forEach(n => {
    const rx = n.rx * W;
    const ry = n.ry * H - py;
    n.vx += (rx + amp * Math.sin(ts * speed + n.phase)             - n.x) * SK;
    n.vy += (ry + amp * Math.cos(ts * speed * 0.7 + n.phase + 1.3) - n.y) * SK;

    const ddx = n.x - mx, ddy = n.y - my;
    const dd  = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dd < MOUSE_R && dd > 0.5) {
      const f = ((MOUSE_R - dd) / MOUSE_R) ** 2 * MOUSE_F * (0.4 + layer * 0.3);
      n.vx += (ddx / dd) * f * 0.10;
      n.vy += (ddy / dd) * f * 0.10;
    }

    n.vx *= DAMP; n.vy *= DAMP;
    n.x  += n.vx; n.y  += n.vy;
  });

  // ── Edges ─────────────────────────────────────────────────────────────────
  for (const [ai, bi] of edges) {
    const a = nodes[ai], b = nodes[bi];

    // Find closest point on segment to mouse (for localised glow)
    const edx = b.x - a.x, edy = b.y - a.y;
    const len2 = edx * edx + edy * edy;
    const t    = len2 > 0 ? Math.max(0, Math.min(1, ((mx - a.x) * edx + (my - a.y) * edy) / len2)) : 0;
    const cpx  = a.x + t * edx;   // closest point on edge to mouse
    const cpy  = a.y + t * edy;
    const dist = Math.hypot(cpx - mx, cpy - my);
    const glow = Math.max(0, 1 - dist / EDGE_GLOW_R);

    // Base edge
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(255,255,255,${baseEdgeA})`;
    ctx.lineWidth   = 0.7 + layer * 0.3;
    ctx.shadowBlur  = 0;
    ctx.stroke();

    // Localised glow overlay — drawn only around the closest point
    if (glow > 0.02) {
      const glowLen = EDGE_GLOW_R * glow;   // half-length of the lit segment
      const norm    = len2 > 0 ? Math.sqrt(len2) : 1;
      const ux      = edx / norm, uy = edy / norm;
      const t0      = Math.max(0, t - glowLen / norm);
      const t1      = Math.min(1, t + glowLen / norm);

      ctx.beginPath();
      ctx.moveTo(a.x + t0 * edx, a.y + t0 * edy);
      ctx.lineTo(a.x + t1 * edx, a.y + t1 * edy);
      ctx.strokeStyle = `rgba(${OR},${OG},${OB},${glow * 0.85})`;
      ctx.lineWidth   = 1.5 + glow * 3;
      ctx.shadowBlur  = 18 * glow;
      ctx.shadowColor = `rgba(${OR},${OG},${OB},${glow})`;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Bright dot at the closest point
      ctx.beginPath();
      ctx.arc(cpx, cpy, 2 + glow * 3, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(255,220,140,${glow * 0.9})`;
      ctx.shadowBlur  = 14 * glow;
      ctx.shadowColor = `rgba(${OR},${OG},${OB},1)`;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  nodes.forEach(n => {
    const dist = Math.hypot(n.x - mx, n.y - my);
    const glow = Math.max(0, 1 - dist / NODE_GLOW_R);

    if (!n.tile) {
      const r = 2.5 + layer * 1.2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(255,255,255,${baseNodeA})`;
      ctx.shadowBlur  = 0;
      ctx.fill();

      if (glow > 0.02) {
        // Glow halo drawn on top
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + glow * 4, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(255,200,100,${glow * 0.7})`;
        ctx.shadowBlur  = 20 * glow;
        ctx.shadowColor = `rgba(${OR},${OG},${OB},1)`;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }
      return;
    }

    const { color, rotation, w, h } = n.tile;
    const [r, g, b] = hexToRgb(color);

    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(rotation);

    // Fill
    ctx.shadowBlur  = glowRadius + glow * 28;
    ctx.shadowColor = `rgba(${r},${g},${b},${0.18 + glow * 0.55})`;
    ctx.fillStyle   = `rgba(${r},${g},${b},${Math.min(1, baseNodeA * 0.55)})`;
    roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
    ctx.shadowBlur  = 0;

    // Border — brighter near mouse
    ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(1, baseNodeA * 0.9 + glow * 0.5)})`;
    ctx.lineWidth   = 1.2 + layer * 0.6 + glow * 2;
    if (glow > 0.02) {
      ctx.shadowBlur  = 16 * glow;
      ctx.shadowColor = `rgba(${r},${g},${b},${glow})`;
    }
    roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.stroke();
    ctx.shadowBlur  = 0;

    // Hatch
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.08 + layer * 0.04})`;
    ctx.lineWidth   = 0.5;
    for (let lx = -w / 2; lx < w / 2; lx += 14) {
      ctx.beginPath(); ctx.moveTo(lx, -h / 2); ctx.lineTo(lx + h, h / 2); ctx.stroke();
    }
    ctx.restore();
  });
}

export function HeroSection({ totalEvents, archivedEvents, sourceCount }: Props) {
  const sectionRef   = useRef<HTMLElement>(null);
  // Two canvases: back (layers 0+1) sits behind content, front (layer 2) sits in front
  const canvasBackRef  = useRef<HTMLCanvasElement>(null);
  const canvasFrontRef = useRef<HTMLCanvasElement>(null);
  const graphRef    = useRef<ReturnType<typeof buildGraph>>([]);
  const scrollY     = useRef(0);
  const mouse       = useRef({ x: -9999, y: -9999 });
  const rafId       = useRef(0);

  useEffect(() => {
    graphRef.current = buildGraph();

    const cBack  = canvasBackRef.current;
    const cFront = canvasFrontRef.current;
    if (!cBack || !cFront) return;
    const ctxBack  = cBack.getContext('2d',  { alpha: true });
    const ctxFront = cFront.getContext('2d', { alpha: true });
    if (!ctxBack || !ctxFront) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const W = window.innerWidth, H = window.innerHeight;
      [cBack, cFront].forEach(c => {
        c.width  = W * dpr; c.height = H * dpr;
        c.style.width  = `${W}px`; c.style.height = `${H}px`;
      });
      ctxBack.setTransform(dpr,  0, 0, dpr, 0, 0);
      ctxFront.setTransform(dpr, 0, 0, dpr, 0, 0);
      graphRef.current.forEach(({ nodes }) => {
        nodes.forEach(n => { n.x = n.rx * W; n.y = n.ry * H; n.vx = 0; n.vy = 0; });
      });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    const onScroll    = () => { scrollY.current = window.scrollY; };
    const onMouseMove = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseOut  = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener('scroll',     onScroll,    { passive: true });
    window.addEventListener('mousemove',  onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseOut);

    const draw = (ts: number) => {
      const W = window.innerWidth, H = window.innerHeight;
      ctxBack.clearRect(0,  0, W, H);
      ctxFront.clearRect(0, 0, W, H);

      const sy = scrollY.current;
      const mx = mouse.current.x, my = mouse.current.y;

      graphRef.current.forEach(({ nodes, edges }) => {
        const ctx = nodes[0].layer === 2 ? ctxFront : ctxBack;
        renderCluster(ctx, nodes, edges, mx, my, ts, sy, W, H);
      });

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll',     onScroll);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseleave', onMouseOut);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden" style={{ minHeight: '100svh' }}>

      {/* Back canvas — behind everything */}
      <div className="absolute inset-0" aria-hidden="true" style={{ zIndex: 0 }}>
        <canvas ref={canvasBackRef} className="absolute inset-0" />
        {/* Atmospheric tint */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.32) 55%, rgba(0,0,0,0.05) 100%)',
          pointerEvents: 'none',
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-44" style={{
          background: 'linear-gradient(to bottom, transparent, var(--background))',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Content — z-10 */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-4"
        style={{ minHeight: '100svh', paddingBottom: '5rem', zIndex: 10 }}
      >
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

        <div className="w-full max-w-2xl">
          <style>{`
            .hero-search-shell {
              background: rgba(255,255,255,0.09);
              backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
              border-radius: 0.75rem; border: 1.5px solid var(--primary);
              opacity: 0.85; transition: border-color 0.18s, box-shadow 0.18s, opacity 0.18s;
            }
            .hero-search-shell:focus-within {
              opacity: 1; border-color: var(--ring);
              box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 22%, transparent);
            }
            .hero-search-shell form, .hero-search-shell > div, .hero-search-shell [class] {
              background: transparent !important; border: none !important;
              border-radius: 0 !important; box-shadow: none !important;
            }
            .hero-search-shell input {
              background: transparent !important; color: rgba(255,255,255,0.88) !important;
              border: none !important; outline: none !important; box-shadow: none !important;
            }
            .hero-search-shell input::placeholder { color: rgba(255,255,255,0.36) !important; }
            .hero-search-shell button[type="submit"] {
              background: var(--primary) !important; color: var(--primary-foreground) !important;
              border-radius: 0.5rem !important; padding: 0 1.1rem !important;
              font-weight: 600 !important; font-size: 0.85rem !important;
              height: 2.2rem !important; margin-right: 0.35rem !important;
              transition: background 0.15s !important; white-space: nowrap !important;
            }
            .hero-search-shell button[type="submit"]:hover {
              background: color-mix(in oklch, var(--primary) 85%, black) !important;
            }
            .hero-search-shell button:not([type="submit"]) svg { color: rgba(255,255,255,0.50) !important; }
          `}</style>
          <div className="hero-search-shell">
            <Suspense fallback={<div className="h-14 rounded-full" style={{ background: 'rgba(255,255,255,0.09)' }} />}>
              <SearchBar />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Front canvas — on top of content, pointer-events-none so clicks pass through */}
      <canvas
        ref={canvasFrontRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 20 }}
      />

      {/* Scroll cue */}
      <button
        onClick={() => sectionRef.current?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-pointer"
        style={{ color: 'rgba(255,255,255,0.38)', border: 'none', background: 'none', zIndex: 30 }}
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