"use client";

import dynamic from "next/dynamic";

const MouseTrail = dynamic(
  () => import("./MouseTrail").then((m) => m.MouseTrail),
  { ssr: false }
);

export function MouseTrailLoader() {
  return <MouseTrail />;
}
