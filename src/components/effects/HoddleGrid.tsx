'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Music, Theater, Trophy, Palette, Users, Sparkles, type LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Rgb = [number, number, number];

interface GNode {
  id: number; rx: number; ry: number;
  x: number;  y: number;
  vx: number; vy: number;
  phase: number; catIdx: number;
}

interface SubcatAssignment {
  slotIdx: number; nodeId: number;
  label: string; catSlug: string; catIdx: number;
}

interface LayoutConfig {
  cols: number; rows: number; tiltDeg: number;
  catGp: [number, number][];
  ellipses: { cx: number; cy: number; rx: number; ry: number }[];
  height: number;
  subcatHops: number; maxSubcats: number;
  pillPad: string; pillFont: number;
}

// ─── Categories ───────────────────────────────────────────────────────────────
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
const TILT_PAD   = 160;
const JITTER     = 0.22;
const EDGE_MULT  = 1.32;
const MAX_DEGREE = 3;

function getLayout(W: number): LayoutConfig {
  if (W >= 800) return {
    cols: 10, rows: 6, tiltDeg: 12,
    catGp: [[1,1],[4,0],[8,2],[2,4],[5,5],[8,4]],
    ellipses: [
      { cx: 0.40, cy: 0.50, rx: 0.70, ry: 0.65 },
      { cx: 0.80, cy: 0.20, rx: 0.35, ry: 0.35 },
      { cx: 0.15, cy: 0.80, rx: 0.30, ry: 0.30 },
    ],
    height: 600, subcatHops: 3, maxSubcats: 8, pillPad: '6px 14px', pillFont: 11,
  };
  if (W >= 520) return {
    cols: 7, rows: 9, tiltDeg: 10,
    catGp: [[1,1],[4,0],[6,2],[1,5],[3,7],[6,6]],
    ellipses: [
      { cx: 0.45, cy: 0.50, rx: 0.72, ry: 0.68 },
      { cx: 0.85, cy: 0.15, rx: 0.32, ry: 0.32 },
      { cx: 0.12, cy: 0.85, rx: 0.28, ry: 0.28 },
    ],
    height: 740, subcatHops: 2, maxSubcats: 6, pillPad: '5px 11px', pillFont: 10,
  };
  return {
    cols: 5, rows: 12, tiltDeg: 8,
    catGp: [[1,1],[3,0],[4,3],[0,5],[2,8],[4,7]],
    ellipses: [
      { cx: 0.50, cy: 0.50, rx: 0.75, ry: 0.72 },
      { cx: 0.90, cy: 0.10, rx: 0.28, ry: 0.28 },
      { cx: 0.10, cy: 0.90, rx: 0.25, ry: 0.25 },
    ],
    height: 920, subcatHops: 2, maxSubcats: 4, pillPad: '4px 9px', pillFont: 10,
  };
}

function inBoundary(col: number, row: number, layout: LayoutConfig): boolean {
  const nx = col / (layout.cols - 1), ny = row / (layout.rows - 1);
  return layout.ellipses.some(e => {
    const dx = (nx - e.cx) / e.rx, dy = (ny - e.cy) / e.ry;
    return dx * dx + dy * dy <= 1;
  });
}

// ─── Physics constants ────────────────────────────────────────────────────────
const AMBIENT_AMP    = 7;
const AMBIENT_SPEED  = 0.00027;
const MOUSE_RADIUS   = 120;
const MOUSE_FORCE    = 50;
const SK_PLAIN       = 0.042;
const DAMP_PLAIN     = 0.83;
const SK_CAT         = 0.60;
const DAMP_CAT       = 0.42;
const AMBIENT_CAT    = 1.0;
const SK_SUBCAT      = 0.38;
const DAMP_SUBCAT    = 0.55;

// ─── Colour / BFS constants ───────────────────────────────────────────────────
const BFS_MAX_HOPS       = 6;
const BFS_GAMMA          = 0.48;
const COLOR_LERP         = 0.048;
const HOVER_LERP         = 0.10;
const SUBCAT_FADEIN      = 0.12;
const BFS_STAY_THRESHOLD = 0.12;
const BFS_STAY_RADIUS    = 72;
const DISMISS_FRAMES     = 18;  // ~300ms at 60fps

// ─── Node sizes ───────────────────────────────────────────────────────────────
const CAT_SLOT     = 84;
const PLAIN_R_BASE = 3.5;
const PLAIN_R_MAX  = 7.5;
const SUBCAT_R     = 2.0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sr(seed: number) { return Math.abs(Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1; }
function rot(x: number, y: number, c: number, s: number): [number, number] {
  return [x * c - y * s, x * s + y * c];
}

function pillCSS(l: LayoutConfig) {
  return `
    .subcat-pill {
      display: inline-flex; align-items: center; justify-content: center;
      padding: ${l.pillPad}; border-radius: 999px;
      border: 1.5px solid transparent; background: transparent;
      text-decoration: none; cursor: pointer; white-space: nowrap;
      transition: filter 0.12s ease, transform 0.12s ease;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    }
    .subcat-pill:hover { filter: brightness(1.25); transform: scale(1.10); }
    .subcat-pill-text {
      font-size: ${l.pillFont}px; font-weight: 700;
      letter-spacing: 0.02em; line-height: 1; color: #ffffff;
      text-shadow: 0 1px 4px rgba(0,0,0,0.70), 0 0 10px rgba(0,0,0,0.40);
    }
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
export function HoddleGrid() {
  const outerRef     = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const catRefs      = useRef<(HTMLDivElement | null)[]>(Array(N_CATS).fill(null));

  const subcatWrapRefs = useRef<(HTMLDivElement | null)[]>(Array(MAX_SUBCAT).fill(null));
  const subcatLinkRefs = useRef<(HTMLAnchorElement | null)[]>(Array(MAX_SUBCAT).fill(null));
  const subcatTextRefs = useRef<(HTMLSpanElement | null)[]>(Array(MAX_SUBCAT).fill(null));

  // Graph state
  const nodes  = useRef<GNode[]>([]);
  const adj    = useRef<number[][]>([]);
  const edges  = useRef<[number, number][]>([]);
  const catNId = useRef<number[]>([]);  // node index per category

  // Mouse + sizing
  const sizeRef  = useRef({ W: 0, H: 0 });
  const mouse    = useRef({ x: -9999, y: -9999 });
  const layoutRef = useRef<LayoutConfig>(getLayout(800));

  // Animation values — Float32Arrays for performance
  const colorT    = useRef<Float32Array>(new Float32Array(0));  // per-node BFS colour blend 0→1
  const targetT   = useRef<Float32Array>(new Float32Array(0));  // BFS target for colorT
  const hoverT    = useRef<Float32Array>(new Float32Array(N_CATS));  // per-cat hover 0→1

  const subcatVisibleT  = useRef<Float32Array>(new Float32Array(MAX_SUBCAT));
  const subcatFrozenPos = useRef<Float32Array>(new Float32Array(MAX_SUBCAT * 2).fill(-9999));

  // Interaction state
  const hoveredCat    = useRef(-1);
  const activeCatRef  = useRef(-1);   // category whose BFS/subcats are currently active
  const lastActiveCat = useRef(-1);   // persists through fade-out for smooth colour blend
  const exitFrameCount = useRef(0);

  const subcatAssignments = useRef<SubcatAssignment[]>([]);
  const subcatNodeMap     = useRef<Map<number, SubcatAssignment>>(new Map());

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

  // ── Dismiss subcats (clicks disabled immediately; opacity fades via draw loop) ─
  const dismissSubcats = useCallback(() => {
    activeCatRef.current      = -1;
    exitFrameCount.current    = 0;
    subcatAssignments.current = [];
    subcatNodeMap.current.clear();
    for (let i = 0; i < MAX_SUBCAT; i++) {
      const wrap = subcatWrapRefs.current[i];
      if (wrap) wrap.style.pointerEvents = 'none';
    }
  }, []);

  // ── Assign subcats to the BFS-nearest plain nodes ────────────────────────
  const assignSubcats = useCallback((catIdx: number) => {
    dismissSubcats();

    const cat     = CATEGORIES[catIdx];
    const startId = catNId.current[catIdx];
    if (startId < 0) return;

    const { subcatHops, maxSubcats } = layoutRef.current;
    const N     = nodes.current.length;
    const dists = bfs(startId, N);

    const candidates = nodes.current
      .filter(n => n.catIdx < 0 && dists[n.id] > 0 && dists[n.id] <= subcatHops)
      .sort((a, b) => dists[a.id] - dists[b.id])
      .slice(0, Math.min(cat.subcategories.length, maxSubcats));

    const newAssignments: SubcatAssignment[] = candidates.map((n, i) => ({
      slotIdx: i, nodeId: n.id,
      label: cat.subcategories[i], catSlug: cat.slug, catIdx,
    }));

    subcatAssignments.current = newAssignments;
    subcatNodeMap.current     = new Map(newAssignments.map(a => [a.nodeId, a]));
    activeCatRef.current      = catIdx;

    const [r, g, b] = cat.rgb;
    newAssignments.forEach((a, i) => {
      const link = subcatLinkRefs.current[i];
      const text = subcatTextRefs.current[i];
      const wrap = subcatWrapRefs.current[i];
      if (!link || !text || !wrap) return;
      link.href              = subcatHref(a.catSlug, a.label);
      text.textContent       = a.label;
      link.style.borderColor = `rgba(${r},${g},${b},0.55)`;
      link.style.background  = `rgba(${r},${g},${b},0.22)`;
      wrap.style.pointerEvents = 'auto';
    });
    // Hide unused slots
    for (let i = newAssignments.length; i < MAX_SUBCAT; i++) {
      subcatVisibleT.current[i] = 0;
    }
  }, [bfs, dismissSubcats]);

  // ── Build graph geometry ─────────────────────────────────────────────────
  const buildGraph = useCallback((W: number, H: number, layout: LayoutConfig) => {
    const { cols, rows, tiltDeg, catGp } = layout;
    const padX  = W * 0.08, padY  = H * 0.12;
    const cellW = (W - padX * 2) / (cols - 1);
    const cellH = (H - padY * 2) / (rows - 1);
    const maxEdge = Math.max(cellW, cellH) * EDGE_MULT;
    const rad = (tiltDeg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = W / 2, cy = H / 2;

    const catLookup = new Map<string, number>();
    catGp.forEach(([gc, gr], i) => catLookup.set(`${gc},${gr}`, i));

    const newNodes: GNode[] = [];
    let seed = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ci    = catLookup.get(`${col},${row}`) ?? -1;
        const isCat = ci >= 0;
        if (!isCat && !inBoundary(col, row, layout)) { seed++; continue; }

        const bx = padX + col * cellW - cx, by = padY + row * cellH - cy;
        const [rx, ry] = rot(bx, by, cos, sin);
        const jx = isCat ? 0 : (sr(seed) - 0.5) * cellW * JITTER;
        const jy = isCat ? 0 : (sr(seed + 99) - 0.5) * cellH * JITTER;
        const fx = cx + rx + jx, fy = cy + ry + jy;

        newNodes.push({ id: newNodes.length, rx: fx, ry: fy, x: fx, y: fy, vx: 0, vy: 0, phase: sr(seed * 5.3) * Math.PI * 2, catIdx: ci });
        seed++;
      }
    }

    const N = newNodes.length;
    nodes.current = newNodes;

    // Build edges: sort by length, add shortest first, cap degree on plain nodes
    const allEdges = [] as { i: number; j: number; d: number }[];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = newNodes[i].rx - newNodes[j].rx, dy = newNodes[i].ry - newNodes[j].ry;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < maxEdge) allEdges.push({ i, j, d });
      }
    }
    allEdges.sort((a, b) => a.d - b.d);

    const degree   = new Int32Array(N);
    const newAdj:   number[][]         = Array.from({ length: N }, () => []);
    const newEdges: [number, number][] = [];

    for (const { i, j } of allEdges) {
      const iCat = newNodes[i].catIdx >= 0, jCat = newNodes[j].catIdx >= 0;
      if (!iCat && degree[i] >= MAX_DEGREE) continue;
      if (!jCat && degree[j] >= MAX_DEGREE) continue;
      newEdges.push([i, j]);
      newAdj[i].push(j); newAdj[j].push(i);
      degree[i]++; degree[j]++;
    }

    adj.current    = newAdj;
    edges.current  = newEdges;
    catNId.current = CATEGORIES.map((_, ci) => newNodes.findIndex(n => n.catIdx === ci));

    colorT.current         = new Float32Array(N);
    targetT.current        = new Float32Array(N);
    hoverT.current         = new Float32Array(N_CATS);
    subcatVisibleT.current = new Float32Array(MAX_SUBCAT);

    // Set initial category node DOM positions
    catNId.current.forEach((nid, ci) => {
      if (nid < 0) return;
      const n = newNodes[nid], el = catRefs.current[ci];
      if (el) el.style.transform = `translate(${n.rx - CAT_SLOT / 2}px, ${n.ry - CAT_SLOT / 2}px)`;
    });
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
      const { width: W } = container.getBoundingClientRect();
      const layout = getLayout(W);
      layoutRef.current = layout;
      if (outerRef.current) outerRef.current.style.height = `${layout.height}px`;
      sizeRef.current = { W, H: layout.height };

      const pillStyle = document.getElementById('hoddle-pill-style');
      if (pillStyle) pillStyle.textContent = pillCSS(layout);

      const CW = W + TILT_PAD * 2, CH = layout.height + TILT_PAD * 2;
      canvas.width = CW * dpr; canvas.height = CH * dpr;
      canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, TILT_PAD * dpr, TILT_PAD * dpr);
      buildGraph(W, layout.height, layout);
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
      ctx.clearRect(0, 0, (W + TILT_PAD * 2) * dpr, (H + TILT_PAD * 2) * dpr);
      ctx.restore();

      const dark   = document.documentElement.classList.contains('dark');
      const BASE: Rgb = dark ? [255, 255, 255] : [15, 15, 15];
      const mx = mouse.current.x, my = mouse.current.y;
      const ns = nodes.current;
      const N  = ns.length;
      const catHov = hoveredCat.current;

      // ── Determine if mouse is inside the lit BFS region ───────────────
      const inBFS = activeCatRef.current >= 0 && (
        catHov >= 0 ||
        ns.some(n => colorT.current[n.id] >= BFS_STAY_THRESHOLD &&
          (n.x - mx) ** 2 + (n.y - my) ** 2 < BFS_STAY_RADIUS ** 2)
      );

      // ── Dismiss after DISMISS_FRAMES consecutive frames outside BFS ───
      if (!inBFS && activeCatRef.current >= 0) {
        if (++exitFrameCount.current >= DISMISS_FRAMES) {
          dismissSubcats();
          targetT.current.fill(0);
        }
      } else {
        exitFrameCount.current = 0;
      }

      // ── Update active category ────────────────────────────────────────
      if (catHov >= 0 && catHov !== activeCatRef.current) {
        activeCatRef.current   = catHov;
        exitFrameCount.current = 0;
      }
      const effectiveCat = catHov >= 0 ? catHov : activeCatRef.current;

      // ── Recompute BFS targets when the active category changes ─────────
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

      // ── Lerp all animated values ──────────────────────────────────────
      for (let i = 0; i < N; i++) colorT.current[i] += (targetT.current[i] - colorT.current[i]) * COLOR_LERP;
      for (let ci = 0; ci < N_CATS; ci++) {
        hoverT.current[ci] += ((catHov === ci ? 1 : 0) - hoverT.current[ci]) * HOVER_LERP;
      }

      // Subcat slots: fade in if assigned, fade out (at COLOR_LERP rate) if not
      const assignedSlots = new Set(subcatAssignments.current.map(a => a.slotIdx));
      for (let i = 0; i < MAX_SUBCAT; i++) {
        if (assignedSlots.has(i)) {
          subcatVisibleT.current[i] += (1 - subcatVisibleT.current[i]) * SUBCAT_FADEIN;
        } else {
          subcatVisibleT.current[i] *= (1 - COLOR_LERP); // equivalent lerp toward 0
          if (subcatVisibleT.current[i] < 0.01) {
            subcatVisibleT.current[i] = 0;
            const wrap = subcatWrapRefs.current[i];
            if (wrap) wrap.style.transform = 'translate(-9999px,-9999px)';
          }
        }
      }

      // ── Physics ───────────────────────────────────────────────────────
      const snm = subcatNodeMap.current;
      for (const n of ns) {
        const isCat    = n.catIdx >= 0;
        const isSubcat = !isCat && snm.has(n.id);
        const amp  = isCat ? AMBIENT_CAT : AMBIENT_AMP;
        const sk   = isCat ? SK_CAT   : isSubcat ? SK_SUBCAT   : SK_PLAIN;
        const damp = isCat ? DAMP_CAT : isSubcat ? DAMP_SUBCAT : DAMP_PLAIN;

        // Spring toward rest position + ambient drift
        n.vx += (n.rx + amp * Math.sin(ts * AMBIENT_SPEED + n.phase) - n.x) * sk;
        n.vy += (n.ry + amp * Math.cos(ts * AMBIENT_SPEED * 0.7 + n.phase + 1.3) - n.y) * sk;

        // Mouse repulsion for plain (non-subcat) nodes only
        if (!isCat && !isSubcat) {
          const ddx = n.x - mx, ddy = n.y - my;
          const dd  = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd < MOUSE_RADIUS && dd > 0.5) {
            const f = ((MOUSE_RADIUS - dd) / MOUSE_RADIUS) ** 2 * MOUSE_FORCE;
            n.vx += (ddx / dd) * f * 0.13;
            n.vy += (ddy / dd) * f * 0.13;
          }
        }

        n.vx *= damp; n.vy *= damp;
        n.x  += n.vx;  n.y  += n.vy;

        // Sync category node DOM position
        if (isCat) {
          const el = catRefs.current[n.catIdx];
          if (el) el.style.transform = `translate(${(n.x - CAT_SLOT / 2).toFixed(1)}px,${(n.y - CAT_SLOT / 2).toFixed(1)}px)`;
        }

        // Sync live subcat pill position + store frozen position for fade-out
        if (isSubcat) {
          const a = snm.get(n.id)!;
          const PW = 110, PH = 30;
          const px = n.x - PW / 2, py = n.y - PH / 2;
          subcatFrozenPos.current[a.slotIdx * 2]     = px;
          subcatFrozenPos.current[a.slotIdx * 2 + 1] = py;
          const wrap = subcatWrapRefs.current[a.slotIdx];
          if (wrap) {
            wrap.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
            wrap.style.opacity   = subcatVisibleT.current[a.slotIdx].toFixed(3);
          }
        }
      }

      // Fading-out pills: hold last position while opacity drains
      for (let i = 0; i < MAX_SUBCAT; i++) {
        if (subcatVisibleT.current[i] <= 0 || assignedSlots.has(i)) continue;
        const wrap = subcatWrapRefs.current[i];
        const fx   = subcatFrozenPos.current[i * 2];
        const fy   = subcatFrozenPos.current[i * 2 + 1];
        if (wrap && fx > -9000) {
          wrap.style.transform = `translate(${fx.toFixed(1)}px,${fy.toFixed(1)}px)`;
          wrap.style.opacity   = subcatVisibleT.current[i].toFixed(3);
        }
      }

      // ── Colour blend (use lastActiveCat as fallback during fade-out) ──
      if (effectiveCat >= 0) lastActiveCat.current = effectiveCat;
      const colourCat = effectiveCat >= 0 ? effectiveCat : lastActiveCat.current;

      const nr = new Float32Array(N), ng = new Float32Array(N), nb2 = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = colorT.current[i];
        if (t > 0.001 && colourCat >= 0) {
          const [cr, cg, cb] = CATEGORIES[colourCat].rgb;
          nr[i]  = BASE[0] + (cr - BASE[0]) * t;
          ng[i]  = BASE[1] + (cg - BASE[1]) * t;
          nb2[i] = BASE[2] + (cb - BASE[2]) * t;
        } else { nr[i] = BASE[0]; ng[i] = BASE[1]; nb2[i] = BASE[2]; }
      }

      // ── Render: edges ────────────────────────────────────────────────
      const baseLineAlpha = dark ? 0.13 : 0.09;
      for (const [ai, bi] of edges.current) {
        const t = (colorT.current[ai] + colorT.current[bi]) * 0.5;
        const r = (nr[ai] + nr[bi]) * 0.5, g = (ng[ai] + ng[bi]) * 0.5, b = (nb2[ai] + nb2[bi]) * 0.5;
        ctx.beginPath();
        ctx.moveTo(ns[ai].x, ns[ai].y);
        ctx.lineTo(ns[bi].x, ns[bi].y);
        ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${baseLineAlpha + t * 0.50})`;
        ctx.lineWidth   = 0.8 + t * 1.6;
        ctx.stroke();
      }

      // ── Render: plain intersection nodes ─────────────────────────────
      for (let i = 0; i < N; i++) {
        const n = ns[i];
        if (n.catIdx >= 0) continue;
        const isSubcat = snm.has(n.id);
        const t = colorT.current[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, isSubcat ? SUBCAT_R : PLAIN_R_BASE + (PLAIN_R_MAX - PLAIN_R_BASE) * t, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${nr[i] | 0},${ng[i] | 0},${nb2[i] | 0},${
          isSubcat ? (dark ? 0.10 : 0.07) : (dark ? 0.28 : 0.20) + t * 0.55
        })`;
        ctx.fill();
      }

      // ── Render: category node glow auras ─────────────────────────────
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
        const grd   = ctx.createRadialGradient(n.x, n.y, CAT_SLOT * 0.1, n.x, n.y, glowR);
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

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div ref={outerRef} className="relative w-full" style={{ height: 600, maxHeight: '100%' }}>
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{ left: -TILT_PAD, top: -TILT_PAD }}
        />

        {/* Category hover colours */}
        <style id="hoddle-cat-style">{
          CATEGORIES.map((cat, ci) => {
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
          }).join('')
        }</style>

        {/* Pill styles — textContent replaced on resize */}
        <style id="hoddle-pill-style">{pillCSS(getLayout(800))}</style>

        {/* Category icon nodes */}
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
                  <span className="font-bold text-center select-none leading-none" style={{ fontSize: 10, color: 'currentColor' }}>
                    {cat.label}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}

        {/* Subcat pill slots — position/opacity shell only, styled imperatively */}
        {Array.from({ length: MAX_SUBCAT }, (_, i) => (
          <div
            key={`subcat-${i}`}
            ref={el => { subcatWrapRefs.current[i] = el; }}
            className="absolute top-0 left-0 will-change-transform"
            style={{ transform: 'translate(-9999px,-9999px)', opacity: 0, pointerEvents: 'none', zIndex: 20 }}
          >
            <a ref={el => { subcatLinkRefs.current[i] = el; }} href="#" className="subcat-pill">
              <span ref={el => { subcatTextRefs.current[i] = el; }} className="subcat-pill-text" />
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