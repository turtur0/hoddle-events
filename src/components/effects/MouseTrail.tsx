'use client';

import { useEffect, useRef } from 'react';

const TRAIL_DURATION_MS = 600;
const MAX_POINTS        = 80;
const THICKNESS         = 17;
const SEGMENT_GAP       = 4;
const HALF_PI           = Math.PI * 0.5;

interface TrailPoint { x: number; y: number; ts: number; }

function dist(a: TrailPoint, b: TrailPoint) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function MouseTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points    = useRef<TrailPoint[]>([]);
  const rafId     = useRef<number>(0);
  const isTouch   = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width        = window.innerWidth  * dpr;
      canvas.height       = window.innerHeight * dpr;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    const onMove = (e: MouseEvent) => {
      if (isTouch.current) return;
      const pt: TrailPoint = { x: e.clientX, y: e.clientY, ts: performance.now() };
      const last = points.current[points.current.length - 1];
      if (!last || dist(pt, last) >= SEGMENT_GAP) {
        points.current.push(pt);
        if (points.current.length > MAX_POINTS) points.current.shift();
      }
    };
    const onTouch = () => { isTouch.current = true; };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });

    const draw = () => {
      const now = performance.now();
      const W   = window.innerWidth;
      const H   = window.innerHeight;

      // Expire old points — but DON'T wait for expiry to start fading.
      // We fade continuously based on each point's age.
      points.current = points.current.filter(p => now - p.ts < TRAIL_DURATION_MS);
      ctx.clearRect(0, 0, W, H);

      const pts = points.current;
      if (pts.length < 3) { rafId.current = requestAnimationFrame(draw); return; }

      const n = pts.length;

      // Midpoints + angles between consecutive points
      const mids:   { x: number; y: number }[] = [];
      const angles: number[] = [];
      for (let i = 0; i < n - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        mids[i]   = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
        angles[i] = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      }

      const mn = mids.length; // = n - 1

      // ── Build the ribbon path ──────────────────────────────────────────
      ctx.beginPath();
      // Start at the tail midpoint
      const startTheta = angles[0];
      const startR     = 0; // tail width = 0 (tapers to a point)
      ctx.moveTo(
        mids[0].x + Math.cos(startTheta - HALF_PI) * startR,
        mids[0].y + Math.sin(startTheta - HALF_PI) * startR,
      );

      // Top edge: tail → head
      for (let i = 0; i < mn; i++) {
        const p1    = pts[i];
        const p2    = mids[i];
        const theta = angles[i];
        const r     = Math.sin((i / mn) * Math.PI) * THICKNESS;
        const ox    = Math.cos(theta - HALF_PI) * r;
        const oy    = Math.sin(theta - HALF_PI) * r;
        ctx.quadraticCurveTo(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy);
      }

      // Bottom edge: head → tail (reverse)
      for (let i = mn - 1; i >= 0; i--) {
        const p1    = pts[i + 1];
        const p2    = mids[i];
        const theta = angles[i];
        const r     = Math.sin((i / mn) * Math.PI) * THICKNESS;
        const ox    = Math.cos(theta + HALF_PI) * r;
        const oy    = Math.sin(theta + HALF_PI) * r;
        ctx.quadraticCurveTo(p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy);
      }

      ctx.closePath();

      // ── Age-based gradient fill ────────────────────────────────────────
      // Build a linearGradient from tail point to head point.
      // Each colour stop has alpha derived from that point's actual age,
      // so fading begins immediately and continuously — no pause.
      const tail = pts[0];
      const head = pts[n - 1];

      const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);

      // Sample 8 evenly-spaced positions along the point array for stop positions.
      // More stops = smoother fade, 8 is plenty for performance.
      const STOPS = 8;
      for (let s = 0; s <= STOPS; s++) {
        const t      = s / STOPS;                              // 0 = tail, 1 = head
        const pIdx   = Math.round(t * (n - 1));
        const age    = (now - pts[pIdx].ts) / TRAIL_DURATION_MS; // 0 = just created, 1 = about to expire
        // Fresh points: full opacity. Ageing points: smoothly fade.
        // easeIn so recent head stays bright; easeOut so tail drops fast.
        const alpha  = Math.max(0, (1 - age) * (1 - age)) * 0.60;

        grad.addColorStop(t, `rgba(249, 115, 22, ${alpha})`);
      }

      // Outer soft glow
      ctx.shadowBlur  = 12;
      ctx.shadowColor = 'rgba(249, 115, 22, 0.30)';
      ctx.fillStyle   = grad;
      ctx.fill();

      // Crisp edge definition (re-uses the same path already in ctx)
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = 'rgba(200, 70, 0, 0.35)';
      ctx.lineWidth   = 0.75;
      ctx.stroke();

      // Inner bright shimmer — same gradient but lighter colour
      const shimmer = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      for (let s = 0; s <= STOPS; s++) {
        const t      = s / STOPS;
        const pIdx   = Math.round(t * (n - 1));
        const age    = (now - pts[pIdx].ts) / TRAIL_DURATION_MS;
        const alpha  = Math.max(0, (1 - age) * (1 - age)) * 0.22;
        shimmer.addColorStop(t, `rgba(255, 200, 100, ${alpha})`);
      }
      ctx.fillStyle = shimmer;
      ctx.fill();

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('mousemove', onMove);
      ro.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1, mixBlendMode: 'normal' }}
    />
  );
}