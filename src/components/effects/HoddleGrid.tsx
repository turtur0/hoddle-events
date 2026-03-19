'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Music, Theater, Trophy, Palette, Users, Sparkles, type LucideIcon } from 'lucide-react';

type Rgb = [number, number, number];

const CATEGORIES: {
  label: string; slug: string; rgb: Rgb; Icon: LucideIcon;
  gp: [number, number]; subcategories: string[];
}[] = [
  { label: 'Music',   slug: 'music',   rgb: [249, 115,  22], Icon: Music,    gp: [1, 1],
    subcategories: ['Rock & Alternative','Pop & Electronic','Hip Hop & R&B','Jazz & Blues','Classical & Orchestra','Country & Folk','Metal & Punk','World Music'] },
  { label: 'Theatre', slug: 'theatre', rgb: [244,  63,  94], Icon: Theater,  gp: [4, 0],
    subcategories: ['Musicals','Drama','Comedy Shows','Ballet & Dance','Opera','Cabaret','Shakespeare','Experimental'] },
  { label: 'Sports',  slug: 'sports',  rgb: [ 20, 184, 166], Icon: Trophy,   gp: [8, 2],
    subcategories: ['AFL','Cricket','Soccer','Basketball','Tennis','Rugby','Motorsports','Other Sports'] },
  { label: 'Arts',    slug: 'arts',    rgb: [168,  85, 247], Icon: Palette,  gp: [2, 4],
    subcategories: ['Comedy Festival','Film & Cinema','Art Exhibitions','Literary Events','Cultural Festivals','Markets & Fairs'] },
  { label: 'Family',  slug: 'family',  rgb: [ 16, 185, 129], Icon: Users,    gp: [5, 5],
    subcategories: ['Kids Shows','Family Entertainment','Educational','Circus & Magic'] },
  { label: 'Other',   slug: 'other',   rgb: [ 14, 165, 233], Icon: Sparkles, gp: [8, 4],
    subcategories: ['Workshops','Networking','Wellness','Community Events'] },
];
const N_CATS     = CATEGORIES.length;
const MAX_SUBCAT = 8;

function subcatHref(slug: string, sub: string) {
  return `/events/?category=${slug}&subcategory=${encodeURIComponent(sub)}`;
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const COLS     = 10;
const ROWS     = 6;
const TILT_DEG = 12;
const JITTER   = 0.22;
const TILT_PAD = 160;

const BOUNDARY_ELLIPSES = [
  { cx: 0.40, cy: 0.50, rx: 0.70, ry: 0.65 },
  { cx: 0.80, cy: 0.20, rx: 0.35, ry: 0.35 },
  { cx: 0.15, cy: 0.80, rx: 0.30, ry: 0.30 },
];
function inBoundary(col: number, row: number): boolean {
  const nx = col / (COLS - 1), ny = row / (ROWS - 1);
  return BOUNDARY_ELLIPSES.some(e => {
    const dx = (nx - e.cx) / e.rx, dy = (ny - e.cy) / e.ry;
    return dx * dx + dy * dy <= 1;
  });
}

const EDGE_CELL_MULT = 1.32;
const MAX_DEGREE     = 3;

// ─── Physics ──────────────────────────────────────────────────────────────────
const AMBIENT_AMP   = 7;
const AMBIENT_SPEED = 0.00027;
const MOUSE_R       = 120;
const MOUSE_F       = 50;
const SK_PLAIN      = 0.042;
const DAMP_PLAIN    = 0.83;
const SK_CAT        = 0.60;
const DAMP_CAT      = 0.42;
const AMBIENT_CAT   = 1.0;
const SK_SUBCAT     = 0.38;
const DAMP_SUBCAT   = 0.55;

// ─── BFS & colour ────────────────────────────────────────────────────────────
const BFS_MAX_HOPS    = 6;
const BFS_GAMMA       = 0.48;
const COLOR_LERP      = 0.048;
const HOVER_LERP      = 0.10;
// Subcat fade-in speed (lerp toward 1); on dismiss we SNAP to 0 instead of lerping
const SUBCAT_FADEIN   = 0.12;

// A node is "lit" if its colorT exceeds this threshold
const BFS_STAY_THRESHOLD = 0.12;
// Mouse must be within this px of a lit node for the area to count as "active"
const BFS_STAY_RADIUS    = 72;
// Frames of being outside the BFS area before dismissal fires (~300ms @ 60fps)
const DISMISS_FRAMES     = 18;
// Subcats appear within this many BFS hops of the category node
const SUBCAT_HOP_MAX     = 3;

// ─── Node sizes ───────────────────────────────────────────────────────────────
const CAT_SLOT     = 84;
const PLAIN_R_BASE = 3.5;
const PLAIN_R_MAX  = 7.5;
const SUBCAT_R     = 2.0;

function sr(s: number) { return Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5453) % 1; }
function rot(x: number, y: number, c: number, s: number): [number, number] {
  return [x * c - y * s, x * s + y * c];
}

interface GNode { id: number; rx: number; ry: number; x: number; y: number; vx: number; vy: number; phase: number; catIdx: number; }
interface SubcatAssignment { slotIdx: number; nodeId: number; label: string; catSlug: string; catIdx: number; }

export function HoddleGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const catRefs      = useRef<(HTMLDivElement | null)[]>(Array(N_CATS).fill(null));

  // One DOM wrapper per subcat slot — purely a position/opacity shell.
  // All visual styling lives on the inner <a>, updated imperatively.
  const subcatWrapRefs = useRef<(HTMLDivElement | null)[]>(Array(MAX_SUBCAT).fill(null));
  const subcatLinkRefs = useRef<(HTMLAnchorElement | null)[]>(Array(MAX_SUBCAT).fill(null));
  const subcatTextRefs = useRef<(HTMLSpanElement | null)[]>(Array(MAX_SUBCAT).fill(null));

  const nodes    = useRef<GNode[]>([]);
  const adj      = useRef<number[][]>([]);
  const edges    = useRef<[number, number][]>([]);
  const catNId   = useRef<number[]>([]);

  const sizeRef        = useRef({ W: 0, H: 0 });
  const mouse          = useRef({ x: -9999, y: -9999 });
  const colorT         = useRef<Float32Array>(new Float32Array(0));
  const targetT        = useRef<Float32Array>(new Float32Array(0));
  const hoverT         = useRef<Float32Array>(new Float32Array(N_CATS));
  // Per-slot animated visibility 0→1 for fade-in; snapped to 0 on dismiss
  const subcatVisibleT = useRef<Float32Array>(new Float32Array(MAX_SUBCAT));

  const hoveredCat        = useRef(-1);
  const activeCatRef      = useRef(-1);
  const subcatAssignments = useRef<SubcatAssignment[]>([]);
  const subcatNodeMap     = useRef<Map<number, SubcatAssignment>>(new Map());

  // Frame counter: how many consecutive frames mouse has been outside BFS area
  const exitFrameCount = useRef(0);

  const rafId = useRef(0);

  // ── BFS ───────────────────────────────────────────────────────────────────
  const bfs = useCallback((startId: number, N: number): Int32Array => {
    const dist = new Int32Array(N).fill(-1);
    dist[startId] = 0;
    const q = [startId]; let h = 0;
    while (h < q.length) {
      const cur = q[h++];
      for (const nb of adj.current[cur]) {
        if (dist[nb] < 0) { dist[nb] = dist[cur] + 1; q.push(nb); }
      }
    }
    return dist;
  }, []);

  // ── Hard-dismiss: snap all subcats invisible immediately ─────────────────
  const dismissSubcats = useCallback(() => {
    activeCatRef.current  = -1;
    exitFrameCount.current = 0;
    subcatAssignments.current = [];
    subcatNodeMap.current.clear();

    for (let i = 0; i < MAX_SUBCAT; i++) {
      // Snap visibility to 0 — no lerp delay
      subcatVisibleT.current[i] = 0;
      const wrap = subcatWrapRefs.current[i];
      if (wrap) {
        wrap.style.opacity       = '0';
        wrap.style.pointerEvents = 'none';
        // Park off-screen so it doesn't block clicks
        wrap.style.transform     = 'translate(-9999px,-9999px)';
      }
    }
  }, []);

  // ── Assign subcat pills to BFS-adjacent plain nodes ──────────────────────
  const assignSubcats = useCallback((catIdx: number) => {
    // Dismiss any previous set first
    dismissSubcats();

    const cat     = CATEGORIES[catIdx];
    const subcats = cat.subcategories;
    const startId = catNId.current[catIdx];
    if (startId < 0 || !subcats.length) return;

    const N     = nodes.current.length;
    const dists = bfs(startId, N);

    const candidates = nodes.current
      .filter(n => n.catIdx < 0 && dists[n.id] > 0 && dists[n.id] <= SUBCAT_HOP_MAX)
      .sort((a, b) => dists[a.id] - dists[b.id])
      .slice(0, subcats.length);

    const newAssignments: SubcatAssignment[] = candidates.map((n, i) => ({
      slotIdx: i, nodeId: n.id, label: subcats[i], catSlug: cat.slug, catIdx,
    }));

    subcatAssignments.current = newAssignments;
    subcatNodeMap.current     = new Map(newAssignments.map(a => [a.nodeId, a]));
    activeCatRef.current      = catIdx;

    // Style the inner <a> element only — wrapper div has no visual styling
    const [r, g, b] = cat.rgb;
    for (let i = 0; i < MAX_SUBCAT; i++) {
      const link = subcatLinkRefs.current[i];
      const text = subcatTextRefs.current[i];
      const wrap = subcatWrapRefs.current[i];
      const a    = newAssignments[i];

      if (!link || !text || !wrap) continue;

      if (a) {
        link.href              = subcatHref(a.catSlug, a.label);
        text.textContent       = a.label;
        // Style the pill <a> — border + background only here, nowhere else
        link.style.borderColor = `rgba(${r},${g},${b},0.55)`;
        link.style.background  = `rgba(${r},${g},${b},0.22)`;
        wrap.style.pointerEvents = 'auto';
        // subcatVisibleT already snapped to 0 by dismissSubcats above,
        // will now lerp toward 1 over the next frames
      } else {
        wrap.style.pointerEvents = 'none';
        subcatVisibleT.current[i] = 0;
      }
    }
  }, [bfs, dismissSubcats]);

  // ── Build graph ──────────────────────────────────────────────────────────
  const buildGraph = useCallback((W: number, H: number) => {
    const padX  = W * 0.08, padY  = H * 0.12;
    const cellW = (W - padX * 2) / (COLS - 1);
    const cellH = (H - padY * 2) / (ROWS - 1);
    const maxEdge = Math.max(cellW, cellH) * EDGE_CELL_MULT;
    const rad = (TILT_DEG * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = W / 2, cy = H / 2;

    const catLookup = new Map<string, number>();
    CATEGORIES.forEach((c, i) => catLookup.set(c.gp.join(','), i));

    const newNodes: GNode[] = [];
    let seed = 0;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ci    = catLookup.get(`${col},${row}`) ?? -1;
        const isCat = ci >= 0;
        if (!isCat && !inBoundary(col, row)) { seed++; continue; }

        const bx = padX + col * cellW - cx, by = padY + row * cellH - cy;
        const [rx, ry] = rot(bx, by, cos, sin);
        const jx = isCat ? 0 : (sr(seed) - 0.5) * cellW * JITTER;
        const jy = isCat ? 0 : (sr(seed + 99) - 0.5) * cellH * JITTER;

        newNodes.push({ id: newNodes.length, rx: cx+rx+jx, ry: cy+ry+jy, x: cx+rx+jx, y: cy+ry+jy, vx: 0, vy: 0, phase: sr(seed*5.3)*Math.PI*2, catIdx: ci });
        seed++;
      }
    }

    const N = newNodes.length;
    nodes.current = newNodes;

    type EE = { i: number; j: number; d: number };
    const allEdges: EE[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i+1; j < N; j++) {
        const dx = newNodes[i].rx - newNodes[j].rx, dy = newNodes[i].ry - newNodes[j].ry;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < maxEdge) allEdges.push({ i, j, d });
      }
    }
    allEdges.sort((a, b) => a.d - b.d);

    const degree  = new Int32Array(N);
    const newAdj:   number[][]         = Array.from({ length: N }, () => []);
    const newEdges: [number, number][] = [];

    for (const { i, j } of allEdges) {
      const iC = newNodes[i].catIdx >= 0, jC = newNodes[j].catIdx >= 0;
      if (!iC && degree[i] >= MAX_DEGREE) continue;
      if (!jC && degree[j] >= MAX_DEGREE) continue;
      newEdges.push([i, j]);
      newAdj[i].push(j); newAdj[j].push(i);
      degree[i]++; degree[j]++;
    }

    adj.current    = newAdj;
    edges.current  = newEdges;
    catNId.current = CATEGORIES.map((_, ci) => newNodes.findIndex(n => n.catIdx === ci));

    colorT.current        = new Float32Array(N);
    targetT.current       = new Float32Array(N);
    hoverT.current        = new Float32Array(N_CATS);
    subcatVisibleT.current = new Float32Array(MAX_SUBCAT);

    for (let ci = 0; ci < N_CATS; ci++) {
      const nid = catNId.current[ci];
      if (nid < 0) continue;
      const n = newNodes[nid];
      const el = catRefs.current[ci];
      if (el) el.style.transform = `translate(${n.rx - CAT_SLOT/2}px, ${n.ry - CAT_SLOT/2}px)`;
    }
  }, []);

  // ── Main effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const { width: W, height: H } = container.getBoundingClientRect();
      sizeRef.current = { W, H };
      const CW = W + TILT_PAD*2, CH = H + TILT_PAD*2;
      canvas.width = CW*dpr; canvas.height = CH*dpr;
      canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, TILT_PAD*dpr, TILT_PAD*dpr);
      buildGraph(W, H);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const onMove  = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    container.addEventListener('mousemove',  onMove,  { passive: true });
    container.addEventListener('mouseleave', onLeave);

    let prevBFSCat = -1;

    const draw = (ts: number) => {
      const { W, H } = sizeRef.current;
      if (!W) { rafId.current = requestAnimationFrame(draw); return; }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, (W + TILT_PAD*2)*dpr, (H + TILT_PAD*2)*dpr);
      ctx.restore();

      const dark  = document.documentElement.classList.contains('dark');
      const BASE: Rgb = dark ? [255, 255, 255] : [15, 15, 15];
      const mx = mouse.current.x, my = mouse.current.y;
      const ns = nodes.current;
      const N  = ns.length;
      const catHov = hoveredCat.current;

      // ── Is mouse inside the lit BFS region? ───────────────────────────
      // Check: any lit node (colorT > threshold) within BFS_STAY_RADIUS px,
      // OR the cursor is directly on a category node.
      let inBFS = false;
      if (activeCatRef.current >= 0) {
        if (catHov >= 0) {
          inBFS = true;
        } else {
          for (let i = 0; i < N; i++) {
            if (colorT.current[i] < BFS_STAY_THRESHOLD) continue;
            const n = ns[i];
            const dx = n.x - mx, dy = n.y - my;
            if (dx*dx + dy*dy < BFS_STAY_RADIUS * BFS_STAY_RADIUS) { inBFS = true; break; }
          }
        }
      }

      // ── Dismiss counter — driven by RAF, not setTimeout ────────────────
      if (!inBFS && activeCatRef.current >= 0) {
        exitFrameCount.current++;
        if (exitFrameCount.current >= DISMISS_FRAMES) {
          dismissSubcats();   // snaps subcatVisibleT to 0, clears assignments
          targetT.current.fill(0); // also start fading the BFS colour
        }
      } else if (inBFS) {
        exitFrameCount.current = 0;
      }

      // ── Effective category for BFS & colour ──────────────────────────
      const effectiveCat = catHov >= 0 ? catHov : activeCatRef.current;

      // Activate new category on hover
      if (catHov >= 0 && catHov !== activeCatRef.current) {
        activeCatRef.current   = catHov;
        exitFrameCount.current = 0;
      }

      // BFS target refresh on category change
      if (effectiveCat !== prevBFSCat) {
        prevBFSCat = effectiveCat;
        if (effectiveCat >= 0) {
          const sid = catNId.current[effectiveCat];
          if (sid >= 0) {
            const dists = bfs(sid, N);
            for (let i = 0; i < N; i++) {
              const d = dists[i];
              targetT.current[i] = d < 0 ? 0 : Math.max(0, 1 - d / BFS_MAX_HOPS) ** BFS_GAMMA;
            }
          }
        } else {
          targetT.current.fill(0);
        }
      }

      // ── Lerp colour & hover ───────────────────────────────────────────
      for (let i = 0; i < N; i++) colorT.current[i] += (targetT.current[i] - colorT.current[i]) * COLOR_LERP;
      for (let ci = 0; ci < N_CATS; ci++) {
        hoverT.current[ci] += ((catHov === ci ? 1 : 0) - hoverT.current[ci]) * HOVER_LERP;
      }

      // ── Subcat visibility — lerp toward 1 for assigned slots ─────────
      // (toward 0 handled by snap in dismissSubcats, not lerp)
      const assigned = new Set(subcatAssignments.current.map(a => a.slotIdx));
      for (let i = 0; i < MAX_SUBCAT; i++) {
        if (assigned.has(i)) {
          subcatVisibleT.current[i] += (1 - subcatVisibleT.current[i]) * SUBCAT_FADEIN;
        }
        // If not assigned, stays at 0 (was snapped by dismissSubcats)
      }

      // ── Physics ───────────────────────────────────────────────────────
      const snm = subcatNodeMap.current;

      for (const n of ns) {
        const isCat    = n.catIdx >= 0;
        const isSubcat = !isCat && snm.has(n.id);

        const amp = isCat ? AMBIENT_CAT : AMBIENT_AMP;
        const sk  = isCat ? SK_CAT : (isSubcat ? SK_SUBCAT : SK_PLAIN);
        const dp  = isCat ? DAMP_CAT : (isSubcat ? DAMP_SUBCAT : DAMP_PLAIN);

        n.vx += (n.rx + amp * Math.sin(ts * AMBIENT_SPEED + n.phase) - n.x) * sk;
        n.vy += (n.ry + amp * Math.cos(ts * AMBIENT_SPEED * 0.7 + n.phase + 1.3) - n.y) * sk;

        if (!isCat && !isSubcat) {
          const ddx = n.x - mx, ddy = n.y - my;
          const dd  = Math.sqrt(ddx*ddx + ddy*ddy);
          if (dd < MOUSE_R && dd > 0.5) {
            const f = ((MOUSE_R - dd) / MOUSE_R) ** 2 * MOUSE_F;
            n.vx += (ddx / dd) * f * 0.13;
            n.vy += (ddy / dd) * f * 0.13;
          }
        }

        n.vx *= dp; n.vy *= dp;
        n.x  += n.vx; n.y += n.vy;

        // Sync category node DOM positions
        if (isCat) {
          const el = catRefs.current[n.catIdx];
          if (el) el.style.transform = `translate(${(n.x - CAT_SLOT/2).toFixed(1)}px, ${(n.y - CAT_SLOT/2).toFixed(1)}px)`;
        }

        // Sync subcat pill wrapper positions
        if (isSubcat) {
          const a    = snm.get(n.id)!;
          const wrap = subcatWrapRefs.current[a.slotIdx];
          if (wrap) {
            // Use fixed pill dimensions for centering (actual size is set by CSS)
            const PW = 110, PH = 30;
            wrap.style.transform = `translate(${(n.x - PW/2).toFixed(1)}px, ${(n.y - PH/2).toFixed(1)}px)`;
            wrap.style.opacity   = subcatVisibleT.current[a.slotIdx].toFixed(3);
          }
        }
      }

      // ── Colour source ─────────────────────────────────────────────────
      const activeCat = effectiveCat;

      // ── Per-node blended colour ───────────────────────────────────────
      const nr = new Float32Array(N), ng = new Float32Array(N), nb2 = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = colorT.current[i];
        if (t > 0.003 && activeCat >= 0) {
          const [cr, cg, cb] = CATEGORIES[activeCat].rgb;
          nr[i]  = BASE[0] + (cr - BASE[0]) * t;
          ng[i]  = BASE[1] + (cg - BASE[1]) * t;
          nb2[i] = BASE[2] + (cb - BASE[2]) * t;
        } else { nr[i] = BASE[0]; ng[i] = BASE[1]; nb2[i] = BASE[2]; }
      }

      // ── Edges ─────────────────────────────────────────────────────────
      const baseA = dark ? 0.13 : 0.09;
      for (const [ai, bi] of edges.current) {
        const t = (colorT.current[ai] + colorT.current[bi]) * 0.5;
        const r = (nr[ai]+nr[bi])*0.5, g = (ng[ai]+ng[bi])*0.5, b = (nb2[ai]+nb2[bi])*0.5;
        ctx.beginPath();
        ctx.moveTo(ns[ai].x, ns[ai].y);
        ctx.lineTo(ns[bi].x, ns[bi].y);
        ctx.strokeStyle = `rgba(${r|0},${g|0},${b|0},${baseA + t * 0.50})`;
        ctx.lineWidth   = 0.8 + t * 1.6;
        ctx.stroke();
      }

      // ── Plain nodes ───────────────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        const n = ns[i];
        if (n.catIdx >= 0) continue;
        const isSubcat = snm.has(n.id);
        const t = colorT.current[i];
        const radius = isSubcat ? SUBCAT_R : PLAIN_R_BASE + (PLAIN_R_MAX - PLAIN_R_BASE) * t;
        const alpha  = isSubcat ? (dark ? 0.10 : 0.07) : (dark ? 0.28 : 0.20) + t * 0.55;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${nr[i]|0},${ng[i]|0},${nb2[i]|0},${alpha})`;
        ctx.fill();
      }

      // ── Category glow auras ───────────────────────────────────────────
      for (let ci = 0; ci < N_CATS; ci++) {
        const nid = catNId.current[ci];
        if (nid < 0) continue;
        const n  = ns[nid];
        const ht = hoverT.current[ci];
        const t  = colorT.current[nid];
        if (ht < 0.01 && t < 0.02) continue;
        const [cr, cg, cb] = CATEGORIES[ci].rgb;
        const glowR = CAT_SLOT * 0.90 + ht * 55;
        const glowA = 0.04 + ht * 0.22 + t * 0.07;
        const grd   = ctx.createRadialGradient(n.x, n.y, CAT_SLOT*0.1, n.x, n.y, glowR);
        grd.addColorStop(0, `rgba(${cr},${cg},${cb},${glowA})`);
        grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      container.removeEventListener('mousemove',  onMove);
      container.removeEventListener('mouseleave', onLeave);
      ro.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, [buildGraph, bfs, dismissSubcats]);

  return (
    <div className="relative w-full" style={{ height: 'clamp(520px, 58vw, 680px)' }}>
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ left: -TILT_PAD, top: -TILT_PAD }}
        />

        <style>{`
          /* Category node hover: icon + label → white */
          ${CATEGORIES.map((cat, ci) => {
            const [r, g, b] = cat.rgb;
            return `
              .cat-node-${ci} .cat-inner { color: rgb(${r},${g},${b}); }
              .cat-node-${ci}:hover .cat-inner,
              .cat-node-${ci}:focus-within .cat-inner {
                color: #ffffff;
                background: rgba(${r},${g},${b},0.82);
                border-color: rgba(${r},${g},${b},0.9);
              }
            `;
          }).join('')}

          /* Subcat pill — ALL styling on the <a>, wrapper div is transparent */
          .subcat-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 14px;
            border-radius: 999px;
            border: 1.5px solid transparent;   /* overridden imperatively per-category */
            background: transparent;            /* overridden imperatively per-category */
            text-decoration: none;
            cursor: pointer;
            white-space: nowrap;
            transition: filter 0.12s ease, transform 0.12s ease;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
          }
          .subcat-pill:hover {
            filter: brightness(1.25);
            transform: scale(1.10);
          }
          .subcat-pill-text {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.02em;
            line-height: 1;
            /* Always white for readability — category colour comes from border/bg */
            color: #ffffff;
            text-shadow:
              0 1px 4px rgba(0, 0, 0, 0.70),
              0 0 10px rgba(0, 0, 0, 0.40);
          }
        `}</style>

        {/* Category nodes */}
        {CATEGORIES.map((cat, ci) => {
          const [r, g, b] = cat.rgb;
          const colorA = (a: number) => `rgba(${r},${g},${b},${a})`;
          return (
            <div
              key={cat.slug}
              ref={el => { catRefs.current[ci] = el; }}
              className={`cat-node-${ci} absolute top-0 left-0 will-change-transform`}
              style={{ width: CAT_SLOT, height: CAT_SLOT, transform: 'translate(-9999px,-9999px)' }}
              onMouseEnter={() => {
                hoveredCat.current = ci;
                if (activeCatRef.current !== ci) assignSubcats(ci);
              }}
              onMouseLeave={() => { hoveredCat.current = -1; }}
            >
              <Link href={`/category/${cat.slug}`} className="flex items-center justify-center w-full h-full">
                <div
                  className="cat-inner flex flex-col items-center justify-center gap-1.5 rounded-full
                             transition-all duration-300 ease-out hover:scale-[1.55]"
                  style={{ width: CAT_SLOT, height: CAT_SLOT, background: colorA(0.13), border: `2px solid ${colorA(0.45)}`, transformOrigin: 'center center' }}
                >
                  <cat.Icon style={{ width: 26, height: 26, strokeWidth: 1.8, color: 'currentColor' }} />
                  <span className="font-bold text-center select-none leading-none" style={{ fontSize: 10, color: 'currentColor' }}>{cat.label}</span>
                </div>
              </Link>
            </div>
          );
        })}

        {/*
          Subcat pill slots — pre-rendered DOM nodes, updated imperatively.
          Wrapper: ONLY handles position + opacity. Zero border, zero background.
          Inner <a>: ALL visual styling (border + bg set by assignSubcats).
        */}
        {Array.from({ length: MAX_SUBCAT }, (_, i) => (
          <div
            key={`subcat-${i}`}
            ref={el => { subcatWrapRefs.current[i] = el; }}
            className="absolute top-0 left-0 will-change-transform"
            style={{
              // No background, no border — purely a position shell
              transform:     'translate(-9999px,-9999px)',
              opacity:       0,
              pointerEvents: 'none',
              zIndex:        20,
            }}
          >
            <a
              ref={el => { subcatLinkRefs.current[i] = el; }}
              href="#"
              className="subcat-pill"
            >
              <span
                ref={el => { subcatTextRefs.current[i] = el; }}
                className="subcat-pill-text"
              />
            </a>
          </div>
        ))}

        <nav className="sr-only" aria-label="Browse by category">
          {CATEGORIES.map(c => <Link key={c.slug} href={`/category/${c.slug}`}>{c.label}</Link>)}
        </nav>
      </div>
    </div>
  );
}