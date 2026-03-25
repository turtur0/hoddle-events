'use client';

import { useEffect, useRef } from 'react';

// All node data stored in flat Float32Arrays — zero per-frame allocation.
// Layout: for node i — nx[i], nyPx[i], phase[i], layer[i], radius[i],
//         shimmer[i] (0|1), shimPhase[i], shimSpeed[i]
// Computed per frame into posX[i], posY[i], shimA[i]

const COUNT          = 72;
const LAYER_PARALLAX = [0.08, 0.18, 0.30];
const DRIFT_AMP      = 3;
const DRIFT_SPEED    = 0.00018;
const EDGE_PX        = 110;
const SHIMMER_FRAC   = 0.22;

function sr(s: number) { return Math.abs(Math.sin(s * 127.1 + 311.7) * 43758.5453) % 1; }

function buildNodes(totalH: number) {
  const nx        = new Float32Array(COUNT);
  const nyPx      = new Float32Array(COUNT);
  const phase     = new Float32Array(COUNT);
  const layer     = new Uint8Array(COUNT);
  const radius    = new Float32Array(COUNT);
  const shimmer   = new Uint8Array(COUNT);   // 0 | 1
  const shimPhase = new Float32Array(COUNT);
  const shimSpeed = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    nx[i]        = sr(i * 3.1 + 1);
    nyPx[i]      = sr(i * 7.3 + 2) * totalH;
    phase[i]     = sr(i * 5.1 + 3) * Math.PI * 2;
    layer[i]     = Math.floor(sr(i * 2.7 + 4) * 3);
    radius[i]    = 1.5 + sr(i * 4.9 + 5) * 2.5;
    shimmer[i]   = sr(i * 9.1 + 6) < SHIMMER_FRAC ? 1 : 0;
    shimPhase[i] = sr(i * 6.3 + 7) * Math.PI * 2;
    shimSpeed[i] = shimmer[i] ? 0.0005 + sr(i * 8.2 + 8) * 0.0009 : 0;
  }
  return { nx, nyPx, phase, layer, radius, shimmer, shimPhase, shimSpeed };
}

function buildEdges(
  nx: Float32Array, nyPx: Float32Array, viewW: number,
): Int16Array {
  // Returns flat [ai, bi, ai, bi, …] pairs
  const degree = new Uint8Array(COUNT);
  const pairs: { i: number; j: number; d: number }[] = [];

  for (let i = 0; i < COUNT; i++) {
    for (let j = i + 1; j < COUNT; j++) {
      const dx = (nx[i] - nx[j]) * viewW;
      const dy = nyPx[i] - nyPx[j];
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < EDGE_PX) pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);

  const result: number[] = [];
  const seen = new Set<number>();
  for (const { i, j } of pairs) {
    if (degree[i] >= 2 || degree[j] >= 2) continue;
    const key = i * 10000 + j;
    if (!seen.has(key)) {
      seen.add(key); result.push(i, j);
      degree[i]++; degree[j]++;
    }
  }
  return new Int16Array(result);
}

export function PageBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId     = useRef(0);
  const scrollY   = useRef(0);

  // Graph data — rebuilt on resize
  const nodes = useRef<ReturnType<typeof buildNodes> | null>(null);
  const edges = useRef<Int16Array>(new Int16Array(0));

  // Pre-allocated per-frame work buffers
  const posX  = useRef(new Float32Array(COUNT));
  const posY  = useRef(new Float32Array(COUNT));
  const shimA = useRef(new Float32Array(COUNT));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    // Cached canvas size — updated on resize, read in draw (avoids layout reads per frame)
    let W = 0, VH = 0;

    const rebuild = () => {
      W  = window.innerWidth;
      VH = window.innerHeight;
      const totalH = Math.max(document.body.scrollHeight, VH * 3);
      nodes.current = buildNodes(totalH);
      edges.current = buildEdges(nodes.current.nx, nodes.current.nyPx, W);
      canvas.width        = W * dpr;
      canvas.height       = VH * dpr;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${VH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    rebuild();

    const onScroll = () => { scrollY.current = window.scrollY; };
    const ro = new ResizeObserver(rebuild);
    ro.observe(document.documentElement);
    window.addEventListener('scroll', onScroll, { passive: true });

    const draw = (ts: number) => {
      if (!nodes.current) { rafId.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, VH);

      const { nx, nyPx, phase, layer, radius, shimmer, shimPhase, shimSpeed } = nodes.current;
      const ed  = edges.current;
      const px  = posX.current;
      const py  = posY.current;
      const sa  = shimA.current;
      const sy  = scrollY.current;
      const margin = 60;

      // ── Compute positions + shimmer alphas ──────────────────────────────
      for (let i = 0; i < COUNT; i++) {
        px[i] = nx[i] * W + DRIFT_AMP * Math.sin(ts * DRIFT_SPEED + phase[i]);
        py[i] = nyPx[i] - sy * LAYER_PARALLAX[layer[i]] + DRIFT_AMP * Math.cos(ts * DRIFT_SPEED * 0.7 + phase[i] + 1.2);
        // cos⁴ curve: spends most time near 0, flares sharply to 1 — star-like
        // floor at 0.05 so non-shimmer nodes stay constant, shimmer nodes go nearly dark
        sa[i] = shimmer[i]
          ? 0.05 + 0.95 * Math.pow(Math.max(0, Math.cos(ts * shimSpeed[i] + shimPhase[i])), 4)
          : 1.0;
      }

      // ── Edges ───────────────────────────────────────────────────────────
      ctx.lineWidth = 0.6;
      for (let e = 0; e < ed.length; e += 2) {
        const ai = ed[e], bi = ed[e + 1];
        if (py[ai] < -margin && py[bi] < -margin) continue;
        if (py[ai] > VH + margin && py[bi] > VH + margin) continue;
        const a = (sa[ai] + sa[bi]) * 0.5 * 0.14;
        ctx.beginPath();
        ctx.moveTo(px[ai], py[ai]); ctx.lineTo(px[bi], py[bi]);
        ctx.strokeStyle = `rgba(251,146,60,${a < 0.01 ? 0.01 : a > 0.14 ? 0.14 : a})`;
        ctx.stroke();
      }

      // ── Dots ────────────────────────────────────────────────────────────
      for (let i = 0; i < COUNT; i++) {
        if (py[i] < -margin || py[i] > VH + margin) continue;
        const alpha = 0.28 * sa[i];

        ctx.beginPath();
        ctx.arc(px[i], py[i], radius[i], 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251,146,60,${alpha})`;
        ctx.fill();

        // Glow corona — only for shimmer nodes in the bright top third of their cycle
        if (shimmer[i] && sa[i] > 0.65) {
          const g = (sa[i] - 0.65) / 0.35;  // 0→1 over top 35% of peak
          ctx.beginPath();
          ctx.arc(px[i], py[i], radius[i] * (1.8 + g * 1.2), 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(255,210,130,${g * 0.55})`;
          ctx.shadowBlur  = 14 * g;
          ctx.shadowColor = 'rgba(251,146,60,1)';
          ctx.fill();
          ctx.shadowBlur  = 0;
        }
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