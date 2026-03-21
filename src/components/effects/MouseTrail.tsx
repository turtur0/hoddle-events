'use client';

import { useEffect, useRef } from 'react';

// ─── Tuning ───────────────────────────────────────────────────────────────────
const TRAIL_DURATION_MS = 650;
const MAX_POINTS        = 80;
const THICKNESS         = 14;
const SEGMENT_GAP       = 4;
const HALF_PI           = Math.PI * 0.5;

interface TrailPoint {
  x: number;
  y: number;
  ts: number;
}

function dist(a: TrailPoint, b: TrailPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
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
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
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

      // Drop expired points from the tail — ribbon simply shortens, no fade
      points.current = points.current.filter(p => now - p.ts < TRAIL_DURATION_MS);
      ctx.clearRect(0, 0, W, H);

      const pts = points.current;

      if (pts.length >= 3) {
        const n = pts.length;

        const mids:   { x: number; y: number }[] = [];
        const angles: number[] = [];

        for (let i = 0; i < n - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          mids[i]   = { x: p1.x + dx * 0.5, y: p1.y + dy * 0.5 };
          angles[i] = Math.atan2(dy, dx);
        }

        const mn = mids.length;

        // ── Single closed ribbon path ─────────────────────────────────
        ctx.beginPath();

        for (let i = 0; i < mn; i++) {
          const p1    = pts[i];
          const p2    = mids[i];
          const theta = angles[i];
          const r     = Math.sin((i / mn) * Math.PI) * THICKNESS;
          const sin   = Math.sin(theta - HALF_PI) * r;
          const cos   = Math.cos(theta - HALF_PI) * r;
          ctx.quadraticCurveTo(
            p1.x + cos, p1.y + sin,
            p2.x + cos, p2.y + sin
          );
        }

        for (let i = mn - 1; i >= 0; i--) {
          const p1    = pts[i + 1];
          const p2    = mids[i];
          const theta = angles[i];
          const r     = Math.sin((i / mn) * Math.PI) * THICKNESS;
          const sin   = Math.sin(theta + HALF_PI) * r;
          const cos   = Math.cos(theta + HALF_PI) * r;
          ctx.quadraticCurveTo(
            p1.x + cos, p1.y + sin,
            p2.x + cos, p2.y + sin
          );
        }

        ctx.closePath();

        // Outer glow
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.15)';
        ctx.lineWidth   = 10;
        ctx.stroke();

        // Edge definition
        ctx.strokeStyle = 'rgba(180, 60, 0, 0.5)';
        ctx.lineWidth   = 0.75;
        ctx.stroke();

        // Solid fill — no alpha fade, always the same opacity
        ctx.fillStyle = 'rgba(249, 115, 22, 0.55)';
        ctx.fill();

        // Inner shimmer
        ctx.fillStyle = 'rgba(255, 195, 100, 0.22)';
        ctx.fill();
      }

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
      style={{
        // Sits below all page content — the layout wrapper uses z-10
        zIndex: 1,
        mixBlendMode: 'normal',
      }}
    />
  );
}