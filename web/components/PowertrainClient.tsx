"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, Note, PT_COLORS, Segmented, Slider, Tag } from "@/components/ui";
import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { CRITERIA, scorePowertrains, winner, type Criterion, type Weights } from "@/lib/engine/scoring";
import { defaultInputs, type VantageMode } from "@/lib/engine/tco";
import { pct } from "@/lib/format";

const DEFAULT_W = ASSUMPTIONS.scoringWeights as Weights;

export default function PowertrainClient() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_W);
  const [cityShare, setCityShare] = useState(ASSUMPTIONS.dutyMix.cityShare.value);
  const [grid, setGrid] = useState(ASSUMPTIONS.energy.gridFactor2035.value);
  const [vantage, setVantage] = useState<VantageMode>("all");
  const inp = useMemo(() => defaultInputs(), []);

  const scores = useMemo(
    () => scorePowertrains(ASSUMPTIONS.powertrains, inp, { cityShare, gridFactor: grid, weights, vantage }),
    [inp, cityShare, grid, weights, vantage],
  );
  const best = winner(scores);
  const ranked = [...scores].sort((a, b) => a.rank - b.rank);
  const radarIds = ["CNG", "BEV", "EREV"] as const;
  const radar = CRITERIA.map((c) => ({
    criterion: c.label.replace(" (duty-weighted)", ""),
    ...Object.fromEntries(radarIds.map((id) => [id, +(scores.find((s) => s.id === id)?.norm[c.id] ?? 0).toFixed(1)])),
  }));

  const presets: { label: string; city: number; w: Weights }[] = [
    { label: "Mixed fleet (default)", city: 0.8, w: DEFAULT_W },
    { label: "Dense city only", city: 1, w: DEFAULT_W },
    { label: "Lowest upfront", city: 0.8, w: { costPerKm: 0.1, uptime: 0.1, infra: 0.1, co2: 0, upfront: 0.7 } },
    { label: "Highway-heavy", city: 0.5, w: DEFAULT_W },
  ];

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Scenario presets">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setCityShare(p.city);
                  setWeights(p.w);
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-surface-2"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Duty & context">
          <Slider label="City share of fleet km" value={cityShare} min={0.3} max={1} step={0.05} onChange={setCityShare} fmt={(v) => pct(v)} hint="Rest is airport and intercity highway km" />
          <Slider label="2035 grid CO₂ factor" value={grid} min={0.2} max={0.8} step={0.01} onChange={setGrid} fmt={(v) => `${v.toFixed(2)} kg/kWh`} hint="CEA FY24 weighted average: 0.727 (S13)" />
          <div className="mt-2 text-xs text-muted">VANTAGE fleet software on</div>
          <Segmented<VantageMode> label="VANTAGE" value={vantage} onChange={setVantage} options={[{ id: "all", label: "All (fair)" }, { id: "sarathi-only", label: "SARATHI only" }]} />
        </Card>
        <Card title="Criteria weights">
          {CRITERIA.map((c) => (
            <Slider
              key={c.id}
              label={c.label}
              value={weights[c.id]}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setWeights((w) => ({ ...w, [c.id]: v }) as Record<Criterion, number>)}
              fmt={(v) => v.toFixed(2)}
            />
          ))}
          <Note>Weights are normalised automatically. The defaults favour ₹/km and uptime, because utilisation drives fleet economics.</Note>
        </Card>
      </div>

      <div className="space-y-4 min-w-0">
        <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-4" style={{ borderColor: PT_COLORS[best.id] }}>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted font-semibold">Best fit for this duty</div>
            <div className="text-2xl font-bold" style={{ color: PT_COLORS[best.id] }}>
              {best.label}
            </div>
          </div>
          <div className="text-sm text-muted max-w-xl">
            {best.id === "EREV" && "Grid electricity for dense city km plus a CNG range-extender for airport and intercity runs: low ₹/km without mid-shift DC queues."}
            {best.id === "BEV" && "With almost all km in the city, depot charging covers the day and the battery-only car's lowest ₹/km wins."}
            {best.id.includes("CNG") && "When upfront price dominates, the cheapest vehicle wins, but its ₹/km is roughly 2× SARATHI's."}
            {(best.id === "HEV" || best.id === "PHEV") && "Petrol infrastructure everywhere gives uptime and readiness, at a high ₹/km."}
          </div>
        </div>

        <Card title="Weighted score (0–10)" sub="Each criterion is normalised 0–10 across the six options; 10 = best" tag="illustrative">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranked.map((s) => ({ name: s.id === "EREV" ? "SARATHI EREV" : s.label.replace(" (baseline)", ""), score: +s.score.toFixed(2), id: s.id }))} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 10]} fontSize={12} />
                <YAxis type="category" dataKey="name" width={110} fontSize={12} />
                <Tooltip formatter={(v) => Number(v).toFixed(2)} />
                <Bar dataKey="score" isAnimationActive={false} label={{ position: "right", fontSize: 11 }}>
                  {ranked.map((s) => (
                    <Cell key={s.id} fill={PT_COLORS[s.id]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid xl:grid-cols-2 gap-4">
          <Card title="Profile: CNG vs BEV vs SARATHI" sub="Normalised criterion scores" tag="illustrative">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="70%">
                  <PolarGrid stroke="var(--grid)" />
                  <PolarAngleAxis dataKey="criterion" fontSize={11} />
                  <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                  {radarIds.map((id) => (
                    <Radar key={id} dataKey={id} name={id === "EREV" ? "SARATHI" : id} stroke={PT_COLORS[id]} fill={PT_COLORS[id]} fillOpacity={id === "EREV" ? 0.25 : 0.08} isAnimationActive={false} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Raw metrics" tag="illustrative">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm num">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="py-1.5 pr-2 font-medium">Option</th>
                    <th className="py-1.5 px-1 font-medium text-right">₹/km</th>
                    <th className="py-1.5 px-1 font-medium text-right">Uptime</th>
                    <th className="py-1.5 px-1 font-medium text-right">Infra</th>
                    <th className="py-1.5 px-1 font-medium text-right">CO₂ TTW / WTW</th>
                    <th className="py-1.5 pl-1 font-medium text-right">Range · refuel</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((s) => {
                    const pt = ASSUMPTIONS.powertrains.find((p) => p.id === s.id)!;
                    return (
                      <tr key={s.id} className="border-b border-line/60">
                        <td className="py-1.5 pr-2 font-semibold" style={{ color: PT_COLORS[s.id] }}>
                          {s.id === "EREV" ? "SARATHI" : s.id}
                        </td>
                        <td className="py-1.5 px-1 text-right">{s.raw.costPerKm.toFixed(2)}</td>
                        <td className="py-1.5 px-1 text-right">{s.raw.uptime.toFixed(1)}%</td>
                        <td className="py-1.5 px-1 text-right">{s.raw.infra.toFixed(1)}</td>
                        <td className="py-1.5 px-1 text-right">
                          {s.co2.ttw.toFixed(0)} / {s.co2.wtw.toFixed(0)}
                        </td>
                        <td className="py-1.5 pl-1 text-right">
                          {pt.rangeKm} km · {pt.refuelMinutes} min
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Note>
              <Tag kind="sourced" /> CO₂ in g/km. TTW = tailpipe; WTW includes upstream fuel and the editable 2035 grid factor. Bio-CNG is the best liquid/gas path on WTW, but only 132 CBG plants were complete in June 2026 against a 5,000 target (S15), so its readiness score is low. That is why SARATHI&apos;s range-extender is designed to run on CNG <em>or</em> Bio-CNG.
            </Note>
          </Card>
        </div>
      </div>
    </div>
  );
}
