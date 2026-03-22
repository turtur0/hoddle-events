'use client';

import { useEffect, useRef } from 'react';

// ─── Node definition in page-space ───────────────────────────────────────────
// nx/ny are normalised: nx in 0..1 (viewport width), ny in 0..totalPageH
// layer drives parallax speed so nodes drift at different rates on scroll

interface BgNode {
  nx:     number;   // 0..1 of viewport width
  nyPx:   number;   // absolute page-space Y (px), updated on resize
  phase:  number;
  layer:  number;   // 0 = slowest, 1 = medium, 2 = fastest
  radius: number;   // dot radius
}

const LAYER_PARALLAX = [0.08, 0.18, 0.30]; // fraction of scrollY subtracted
const DRIFT_AMP      = 3;
const DRIFT_SPEED    = 0.00018;
const EDGE_PX        = 110;   // px threshold for drawing an edge

// Deterministic seeded random
function sr(s: number) { return Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5453) % 1; }

// Generate nodes in page-space. totalH = estimated total page height.
function buildNodes(totalH: number): BgNode[] {
  const nodes: BgNode[] = [];
  // ~70 nodes spread over the full page height, randomly placed
  const COUNT = 72;
  for (let i = 0; i < COUNT; i++) {
    nodes.push({
      nx:     sr(i * 3.1 + 1),
      nyPx:   sr(i * 7.3 + 2) * totalH,
      phase:  sr(i * 5.1 + 3) * Math.PI * 2,
      layer:  Math.floor(sr(i * 2.7 + 4) * 3),
      radius: 1.5 + sr(i * 4.9 + 5) * 2.0,  // 1.5–3.5 px
    });
  }
  return nodes;
}

// Precompute edges: connect nodes that are close in page-space
// (so only nodes that are near each other physically connect)
function buildEdges(nodes: BgNode[], viewW: number): [number, number][] {
  const edges: [number, number][] = [];
  const edgeSet = new Set<number>();
  // Max 2 edges per node so the graph stays sparse
  const degree = new Array(nodes.length).fill(0);

  // Sort candidates by distance and greedily add
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = (nodes[i].nx - nodes[j].nx) * viewW;
      const dy = nodes[i].nyPx - nodes[j].nyPx;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < EDGE_PX) pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);

  for (const { i, j } of pairs) {
    if (degree[i] >= 2 || degree[j] >= 2) continue;
    const key = i * 10000 + j;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push([i, j]);
      degree[i]++;
      degree[j]++;
    }
  }
  return edges;
}

export function PageBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef  = useRef<BgNode[]>([]);
  const edgesRef  = useRef<[number, number][]>([]);
  const rafId     = useRef(0);
  const scrollY   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const rebuild = () => {
      const W        = window.innerWidth;
      const totalH   = Math.max(document.body.scrollHeight, window.innerHeight * 3);
      nodesRef.current = buildNodes(totalH);
      edgesRef.current = buildEdges(nodesRef.current, W);

      // Canvas covers exactly the viewport (we redraw based on scroll each frame)
      canvas.width        = W * dpr;
      canvas.height       = window.innerHeight * dpr;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    rebuild();

    const onScroll  = () => { scrollY.current = window.scrollY; };
    const ro        = new ResizeObserver(rebuild);
    ro.observe(document.documentElement);
    window.addEventListener('scroll', onScroll, { passive: true });

    const draw = (ts: number) => {
      const W  = window.innerWidth;
      const VH = window.innerHeight;
      const sy = scrollY.current;
      ctx.clearRect(0, 0, W, VH);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Compute screen position for each node
      const pos = nodes.map(n => ({
        x: n.nx * W + DRIFT_AMP * Math.sin(ts * DRIFT_SPEED + n.phase),
        y: n.nyPx - sy * LAYER_PARALLAX[n.layer] + DRIFT_AMP * Math.cos(ts * DRIFT_SPEED * 0.7 + n.phase + 1.2),
        r: n.radius,
      }));

      // Only draw nodes/edges that are within the viewport (+ small margin)
      const margin = 60;
      const visible = (y: number) => y > -margin && y < VH + margin;

      // ── Edges ────────────────────────────────────────────────────────────
      for (const [ai, bi] of edges) {
        const a = pos[ai], b = pos[bi];
        if (!visible(a.y) && !visible(b.y)) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(251,146,60,0.12)`;
        ctx.lineWidth   = 0.6;
        ctx.stroke();
      }

      // ── Dots ─────────────────────────────────────────────────────────────
      for (const p of pos) {
        if (!visible(p.y)) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251,146,60,0.22)`;
        ctx.fill();
      }

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
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed top-0 left-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}