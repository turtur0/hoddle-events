"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

// Primary orange rgb — matches oklch(0.70 0.16 42) from globals.css
const OR = 251,
  OG = 146,
  OB = 60;

export interface GraphTab {
  id: string;
  label: string;
  Icon: LucideIcon;
}

interface GraphNodeTabsProps {
  tabs: GraphTab[];
  activeId: string;
  onChange: (id: string) => void;
  direction?: "horizontal" | "vertical";
}

export function GraphNodeTabs({
  tabs,
  activeId,
  onChange,
  direction = "horizontal"
}: GraphNodeTabsProps) {
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nodeT = useRef<Float32Array>(new Float32Array(tabs.length));
  const glowPos = useRef(tabs.findIndex((t) => t.id === activeId));
  const glowTgt = useRef(glowPos.current);
  const rafId = useRef(0);

  // Update glow target when active tab changes
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeId);
    glowTgt.current = idx;
  }, [activeId, tabs]);

  // RAF: lerp glow position and write to DOM
  useEffect(() => {
    const GLOW_SPEED = 0.032; // slower = more satisfying travel
    const NODE_LERP = 0.08;
    const activeIdx = tabs.findIndex((t) => t.id === activeId);

    const draw = () => {
      glowPos.current += (glowTgt.current - glowPos.current) * GLOW_SPEED;

      for (let i = 0; i < tabs.length; i++) {
        const dist = Math.abs(glowPos.current - i);
        const target = i === activeIdx ? 1 : Math.max(0, 1 - dist);
        nodeT.current[i] += (target - nodeT.current[i]) * NODE_LERP;

        const t = nodeT.current[i];
        const el = nodeRefs.current[i];
        if (!el) continue;

        const dot = el.querySelector<HTMLElement>(".gnt-dot");
        const icon = el.querySelector<HTMLElement>(".gnt-icon");
        const label = el.querySelector<HTMLElement>(".gnt-label");

        if (dot) {
          // Unselected: grey border, no fill. Selected/passing: orange fill + glow.
          const isSelected = i === activeIdx && t > 0.85;
          dot.style.background = isSelected
            ? `rgba(${OR},${OG},${OB},0.18)`
            : "transparent";
          dot.style.borderColor = isSelected
            ? `rgba(${OR},${OG},${OB},0.90)`
            : `rgba(160,160,160,${0.25 + t * 0.2})`;
          dot.style.boxShadow =
            t > 0.15
              ? `0 0 ${5 + t * 12}px rgba(${OR},${OG},${OB},${t * 0.5})`
              : "none";
        }

        if (icon) {
          icon.style.color = `rgba(${OR},${OG},${OB},${0.4 + t * 0.6})`;
        }

        if (label) {
          const isSelected = i === activeIdx && t > 0.85;
          if (isSelected) {
            label.style.color = `rgba(${OR},${OG},${OB},1)`;
            label.style.fontWeight = "700";
          } else {
            const grey = Math.round((0.38 + t * 0.45) * 255);
            label.style.color = `rgb(${grey},${grey},${grey})`;
            label.style.fontWeight = t > 0.5 ? "600" : "400";
          }
        }
      }

      // Line segments
      for (let i = 0; i < tabs.length - 1; i++) {
        const seg = lineRefs.current[i];
        if (!seg) continue;
        const segT = Math.max(
          Math.max(0, 1 - Math.abs(glowPos.current - i - 0.5)),
          (nodeT.current[i] + nodeT.current[i + 1]) * 0.5
        );
        seg.style.background = `rgba(${OR},${OG},${OB},${0.08 + segT * 0.42})`;
      }

      rafId.current = requestAnimationFrame(draw);
    };

    rafId.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId.current);
  }, [activeId, tabs]);

  const isH = direction === "horizontal";
  const NODE = 34; // node diameter px
  const LINE_H = isH ? "1.5px" : "18px";
  const LINE_W = isH ? "40px" : "1.5px";

  return (
    <div
      className={`flex ${isH ? "flex-row items-center" : "flex-col items-center"}`}
      style={{
        gap: 0,
        // No overflow property here — any overflow on a flex container clips box-shadows.
        // Callers that need horizontal scroll should wrap this in their own scroll container.
        padding: isH ? "6px 8px" : "6px 4px"
      }}
    >
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          className={`flex ${isH ? "flex-row items-center" : "flex-col items-center"} flex-shrink-0`}
        >
          {/* Node + label */}
          <div
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            onClick={() => onChange(tab.id)}
            className={`flex flex-col items-center gap-1.5 cursor-pointer ${isH ? "px-1 py-1" : "py-3 px-2 w-full"}`}
            style={{ userSelect: "none" }}
          >
            <div
              className="gnt-dot rounded-full border-2 flex items-center justify-center"
              style={{
                width: NODE,
                height: NODE,
                flexShrink: 0,
                transition: "none"
              }}
            >
              <tab.Icon
                className="gnt-icon"
                style={{ width: 13, height: 13, transition: "none" }}
              />
            </div>
            <span
              className="gnt-label text-center leading-tight whitespace-nowrap"
              style={{ fontSize: "0.68rem", transition: "none" }}
            >
              {tab.label}
            </span>
          </div>

          {/* Connecting line to next tab */}
          {i < tabs.length - 1 && (
            <div
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              style={{
                width: LINE_W,
                height: LINE_H,
                flexShrink: 0,
                borderRadius: "1px",
                background: `rgba(${OR},${OG},${OB},0.08)`,
                // Align line with node centre vertically (horizontal mode)
                marginBottom: isH ? `${NODE / 2 + 14}px` : 0
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
