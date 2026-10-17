"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, Card, Kpi, Note, Tag } from "@/components/ui";
import healthRaw from "@/public/data/health.json";
import { inr } from "@/lib/format";

interface VehicleHealth {
  id: number;
  flagged: boolean;
  score: number;
  reason: string | null;
  action: string | null;
  topFeature: string;
  z: Record<string, number>;
  features: Record<string, number>;
  avoidedRs: number;
  injected: string;
  soh: number[];
  tempSpread: number[];
  dc: number[];
  brake: number[];
}
interface HealthData {
  model: string;
  days: number;
  sampleEveryDays: number;
  detected: { truePositives: number; injectedFaults: number; flagged: number };
  vehicles: VehicleHealth[];
}
const H = healthRaw as unknown as HealthData;

const FEATURE_LABEL: Record<string, string> = {
  soh_slope: "SOH fade (%/day)",
  temp_spread: "Cell temp spread (°C)",
  cell_dv: "Cell ΔV (mV)",
  dc_per_day: "DC sessions/day",
  brake_idx: "Brake wear index",
};

function Spark({ data, color, unit, title }: { data: number[]; color: string; unit: string; title: string }) {
  const rows = data.map((v, i) => ({ day: i * H.sampleEveryDays, v }));
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-ink mb-1">{title}</div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" fontSize={10} tickFormatter={(d: number) => `d${d}`} />
            <YAxis fontSize={10} width={38} domain={["auto", "auto"]} />
            <Tooltip formatter={(v) => `${v} ${unit}`} labelFormatter={(d) => `Day ${d}`} />
            <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function HealthClient() {
  const flagged = H.vehicles.filter((v) => v.flagged).sort((a, b) => b.score - a.score);
  const [sel, setSel] = useState<number>(flagged[0]?.id ?? 0);
  const v = H.vehicles.find((x) => x.id === sel) ?? H.vehicles[0];
  const avoided = flagged.reduce((s, x) => s + x.avoidedRs, 0);
  const fleetSoh = H.vehicles.reduce((s, x) => s + x.soh[x.soh.length - 1], 0) / H.vehicles.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi value={`${fleetSoh.toFixed(1)}%`} label="fleet average SOH" sub={`after ${H.days} days of commercial duty`} color={COLORS.green} />
        <Kpi value={String(flagged.length)} label="cars flagged" sub="by IsolationForest (contamination 8%)" color={COLORS.red} />
        <Kpi value={`${H.detected.truePositives}/${H.detected.injectedFaults}`} label="injected faults caught" sub="on synthetic data, an easy test" color={COLORS.blue} />
        <Kpi value={inr(avoided)} label="downtime avoided (est.)" sub="3 unplanned days → 1 planned day each" color={COLORS.amber} />
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        <Card title="Fleet watch-list" tag="synthetic">
          <ul className="space-y-2">
            {flagged.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setSel(x.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${sel === x.id ? "border-mred bg-mred/5" : "border-line hover:bg-surface-2"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">Car #{x.id}</span>
                    <span className="text-[11px] font-semibold text-mred">anomaly {x.score.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-ink mt-0.5">{x.reason}</div>
                  <div className="text-xs text-muted mt-0.5">{x.action}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-muted">All other cars:</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {H.vehicles
              .filter((x) => !x.flagged)
              .map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setSel(x.id)}
                  className={`size-7 rounded-md text-[10px] num ${sel === x.id ? "bg-mblue text-white" : "bg-mgreen/15 text-mgreen hover:bg-mgreen/25"}`}
                  aria-label={`Car ${x.id}`}
                >
                  {x.id}
                </button>
              ))}
          </div>
        </Card>

        <div className="space-y-4 min-w-0">
          <Card title={`Car #${v.id} · 90-day telematics`} sub={v.flagged ? `Flagged: ${v.reason}` : "Within fleet norms"} tag="synthetic">
            <div className="grid sm:grid-cols-2 gap-4">
              <Spark data={v.soh} color={COLORS.green} unit="%" title="State of health (%)" />
              <Spark data={v.tempSpread} color={COLORS.red} unit="°C" title="Cell temperature spread (°C)" />
              <Spark data={v.dc} color={COLORS.blue} unit="sessions" title="DC fast-charge sessions / day" />
              <Spark data={v.brake} color={COLORS.amber} unit="" title="Brake wear index (0–1)" />
            </div>
          </Card>
          <Card title="Why it was (or wasn't) flagged" sub="Robust z-score of the last 14 days vs the fleet median; |z| > 3 is unusual">
            <div className="space-y-2">
              {Object.entries(v.z).map(([k, z]) => {
                const width = Math.min(100, (Math.abs(z) / 12) * 100);
                return (
                  <div key={k} className="grid grid-cols-[150px_1fr_60px] items-center gap-2 text-sm">
                    <span className="text-muted">{FEATURE_LABEL[k] ?? k}</span>
                    <div className="h-3 rounded bg-surface-2 overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${width}%`, background: Math.abs(z) > 3 ? COLORS.red : COLORS.slate }} />
                    </div>
                    <span className="num text-right text-ink">{z.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
            {v.flagged && (
              <div className="mt-3 rounded-xl bg-navy p-3 text-sm text-white dark:bg-mblue">
                <div className="text-[11px] uppercase tracking-wider text-cyan font-semibold">Recommended action</div>
                {v.action} · estimated downtime avoided {inr(v.avoidedRs)}
              </div>
            )}
            <Note>
              <Tag kind="synthetic" /> Model: {H.model}. Faults were injected after day 55 into four cars (cell imbalance, thermal, brake wear, fast-charge abuse), and all four are caught with no false alarms. Real telematics will be noisier, so a pilot would tune the thresholds on real data before acting on alerts automatically.
            </Note>
          </Card>
        </div>
      </div>
    </div>
  );
}
