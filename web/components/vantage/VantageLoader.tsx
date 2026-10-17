"use client";

import dynamic from "next/dynamic";

// The simulator reads window (URL params, screen width, canvas), so it renders client-side only.
const VantageSim = dynamic(() => import("./VantageSim"), {
  ssr: false,
  loading: () => <div className="card p-6 text-muted">Running both fleets for 24 simulated hours…</div>,
});

export default function VantageLoader() {
  return <VantageSim />;
}
