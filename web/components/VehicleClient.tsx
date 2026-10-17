"use client";

import { useMemo, useState } from "react";
import VehicleArt from "@/components/VehicleArt";
import { COLORS, Card, Note, Segmented, Slider, Tag } from "@/components/ui";
import { ASSUMPTIONS, type BodyCriterion } from "@/lib/engine/assumptions";
import { physics } from "@/lib/engine/physics";
import { scoreBodyStyles } from "@/lib/engine/scoring";

type Mode = "six" | "airport" | "shared";

const MODES: Record<Mode, { label: string; seats: string; luggage: string; use: string; layout: ("seat" | "bag" | "empty" | "driver")[][] }> = {
  six: {
    label: "6+1 family / group",
    seats: "6 passengers + driver",
    luggage: `${ASSUMPTIONS.vehicle.luggageL.value} L behind row 3`,
    use: "Intra-city groups, commute pools, intercity families",
    layout: [
      ["driver", "seat"],
      ["seat", "seat"],
      ["seat", "seat", "seat"],
    ],
  },
  airport: {
    label: "Airport + luggage",
    seats: "4 passengers + driver",
    luggage: `${ASSUMPTIONS.vehicle.luggageFoldedL.value} L with row 3 folded (≈ 4 large suitcases)`,
    use: "Airport transfers and premium intercity — the yield pools",
    layout: [
      ["driver", "seat"],
      ["seat", "seat", "seat"],
      ["bag", "bag"],
    ],
  },
  shared: {
    label: "Shared 6-seat pool",
    seats: "6 individually booked seats",
    luggage: "Under-seat + 300 L shared",
    use: "Per-seat pooled rides on high-density corridors",
    layout: [
      ["driver", "seat"],
      ["seat", "seat"],
      ["seat", "seat", "seat"],
    ],
  },
};

function SeatMap({ mode }: { mode: Mode }) {
  const m = MODES[mode];
  return (
    <svg viewBox="0 0 220 300" className="w-full max-w-[220px] mx-auto" role="img" aria-label={`Seat layout: ${m.label}`}>
      <rect x="20" y="10" width="180" height="280" rx="60" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2" />
      <rect x="40" y="22" width="140" height="30" rx="12" fill={COLORS.cyan} opacity="0.35" />
      {m.layout.map((row, r) =>
        row.map((cell, c) => {
          const n = row.length;
          const cw = n === 3 ? 40 : 54;
          const gap = n === 3 ? 7 : 16;
          const x = 110 - (n * cw + (n - 1) * gap) / 2 + c * (cw + gap);
          const y = 66 + r * 72;
          if (cell === "bag")
            return (
              <g key={`${r}-${c}`}>
                <rect x={x} y={y} width={cw} height="58" rx="8" fill={COLORS.amber} opacity="0.85" />
                <rect x={x + cw / 2 - 7} y={y - 6} width="14" height="8" rx="3" fill={COLORS.amber} />
              </g>
            );
          const fill = cell === "driver" ? COLORS.navy : mode === "shared" ? COLORS.green : COLORS.blue;
          return (
            <g key={`${r}-${c}`}>
              <rect x={x} y={y} width={cw} height="58" rx="12" fill={fill} />
              <rect x={x + 5} y={y + 40} width={cw - 10} height="12" rx="5" fill="#fff" opacity="0.25" />
              {mode === "shared" && cell !== "driver" && (
                <text x={x + cw / 2} y={y + 30} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">
                  seat
                </text>
              )}
            </g>
          );
        }),
      )}
      <text x="110" y="284" textAnchor="middle" fontSize="11" fill="var(--muted)">
        rear
      </text>
    </svg>
  );
}

export default function VehicleClient() {
  const [mode, setMode] = useState<Mode>("six");
  const crit = ASSUMPTIONS.bodyStyles.criteria;
  const [w, setW] = useState<Record<BodyCriterion, number>>(() => Object.fromEntries(crit.map((c) => [c.id, c.weight])) as Record<BodyCriterion, number>);
  const ranked = useMemo(() => scoreBodyStyles(w), [w]);
  const p = physics();
  const v = ASSUMPTIONS.vehicle;
  const m = MODES[mode];

  const specs: [string, string, string][] = [
    ["Body", "6+1 compact MPV, ≈ 4.4 m long, high roof, sliding-rail row 3", "concept"],
    ["Battery", `${v.batteryKWh.value} kWh LFP · ${Math.round(p.usableKWh * 10) / 10} kWh usable`, "target"],
    ["E-motor", "80–90 kW permanent-magnet, single speed", "target"],
    ["Range-extender", `CNG / Bio-CNG generator, ${v.cngTankKg.value} kg Type-IV tanks under floor`, "target"],
    ["EV range", `${Math.round(p.evRangeKm)} km at ${v.kWhPerKm.value} kWh/km`, "computed"],
    ["Combined range", `${Math.round(p.combinedRangeKm)} km (EV + ${Math.round(p.rangeExtenderKm)} km CNG)`, "computed"],
    ["DC fast charge", `${v.dcChargerKw.value} kW · 10→80 % in 20 min (≈${p.dcAvgPowerKw.toFixed(0)} kW avg, ${p.dcAvgCRate.toFixed(1)}C)`, "computed"],
    ["Depot AC", "11 kW on-board charger, full overnight", "target"],
    ["Luggage", `${v.luggageL.value} L all rows up · ${v.luggageFoldedL.value} L row 3 folded`, "target"],
    ["Design life", `${v.designLifeYears.value} years commercial duty · pack ≥ ${v.lfpCycleLife.value.toLocaleString("en-IN")} cycles to 80 % SOH`, "target"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <Card title="Seat modes: one body, three businesses">
          <Segmented<Mode> label="Seat mode" value={mode} onChange={setMode} options={(Object.keys(MODES) as Mode[]).map((k) => ({ id: k, label: MODES[k].label }))} />
          <div className="mt-4 grid sm:grid-cols-[220px_1fr] gap-4 items-center">
            <SeatMap mode={mode} />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Seating</dt>
                <dd className="text-ink font-semibold">{m.seats}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Luggage</dt>
                <dd className="text-ink">{m.luggage}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted font-semibold">Serves</dt>
                <dd className="text-ink">{m.use}</dd>
              </div>
              <div className="rounded-lg bg-surface-2 p-3 text-xs text-muted">The rider app sells the mode (solo, shared or airport + luggage), and VANTAGE dispatches the car that is already configured for it.</div>
            </dl>
          </div>
        </Card>
        <Card title="SARATHI-X6 at a glance" tag="target">
          <VehicleArt className="w-full h-auto" />
          <div className="grid grid-cols-3 gap-2 mt-2 text-center">
            {[
              [`${v.batteryKWh.value} kWh`, "LFP"],
              ["80–90 kW", "e-motor"],
              [`${v.dcChargerKw.value} kW`, "DC"],
              [`${Math.floor(p.combinedRangeKm / 10) * 10}+ km`, "combined"],
              [`${v.luggageL.value}/${v.luggageFoldedL.value} L`, "luggage"],
              [`${v.designLifeYears.value} yr`, "duty life"],
            ].map(([a, b]) => (
              <div key={b} className="rounded-lg bg-surface-2 py-2">
                <div className="font-bold text-ink num">{a}</div>
                <div className="text-[11px] text-muted">{b}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Specification sheet" sub="“computed” rows come from the tested physics functions; the rest are concept targets" tag="target">
          <table className="w-full text-sm">
            <tbody>
              {specs.map(([k, val, kind]) => (
                <tr key={k} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3 text-muted whitespace-nowrap">{k}</td>
                  <td className="py-1.5 pr-2 text-ink">{val}</td>
                  <td className="py-1.5 text-right">
                    <span className={`text-[10px] font-semibold uppercase ${kind === "computed" ? "text-mgreen" : "text-muted"}`}>{kind}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 rounded-xl border border-amber/40 bg-amber/10 p-3 text-xs text-ink leading-relaxed">
            <strong>Sanity check (unit-tested):</strong> adding 16.8 kWh (10→80%) in 20 minutes needs about {p.dcAvgPowerKw.toFixed(0)} kW on average, which is {p.dcAvgCRate.toFixed(1)}C on a 24 kWh pack. That is within the 60 kW charger and our assumed {v.maxCRate.value}C cell limit, but it is <em>aggressive for LFP</em> and needs fast-charge-rated cells and active cooling. At 210 km/day with 70% of km on EV, the car needs {p.evKmPerDay.toFixed(0)} EV km per day, about {p.chargesPerDay.toFixed(2)} usable-pack equivalents. So the overnight depot charge covers a typical day, and one off-peak DC top-up is a buffer for heavy days.
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Safety" tag="target">
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-ink">
              {[
                "6+ airbags incl. full-length curtain to row 3",
                "ESC, hill-hold, TPMS",
                "L2-ready ADAS: AEB, lane-keep, driver-monitoring camera",
                "Bharat NCAP 5-star design target",
                "Rider SOS + live trip share (app + roof button)",
                "IP67 pack, cell-level thermal-runaway detection",
                "Type-IV CNG tanks with excess-flow valves",
                "Fatigue alerts from shift-hours telematics",
              ].map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-mgreen">●</span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Commercial durability & comfort" tag="target">
            <ul className="space-y-1.5 text-sm text-ink">
              <li>
                <strong>Duty cycle:</strong> {v.designLifeYears.value} years / 6–7 lakh km, two shifts; pack warranty target 8 yr or 4 lakh km to 80% SOH.
              </li>
              <li>
                <strong>Wear parts:</strong> regen braking cuts pad wear; washable vinyl-leatherette seats; replaceable door-sill and row-3 scuff panels.
              </li>
              <li>
                <strong>Serviceability:</strong> modular pack (module-level swap), 1-day planned service slot scheduled by VANTAGE off-peak.
              </li>
              <li>
                <strong>Comfort:</strong> roof-mounted rear AC vents for all three rows, USB-C at every seat, low step-in height, sliding row 3 for legroom.
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Why a 6+1 compact MPV, and not a sedan, SUV or van?" sub="Scores 1–5 are a team assessment (assumption). Re-weight the criteria to test the conclusion." tag="illustrative">
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          <div>
            {crit.map((c) => (
              <Slider key={c.id} label={c.label} value={w[c.id]} min={0} max={0.5} step={0.02} onChange={(x) => setW((o) => ({ ...o, [c.id]: x }))} fmt={(x) => x.toFixed(2)} />
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm num">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-line">
                  <th className="py-2 pr-2 font-medium">Body style</th>
                  {crit.map((c) => (
                    <th key={c.id} className="py-2 px-1 font-medium text-center">
                      {c.label.split(" ")[0]}
                    </th>
                  ))}
                  <th className="py-2 pl-2 font-medium text-right">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((b, i) => (
                  <tr key={b.id} className={`border-b border-line/60 ${i === 0 ? "bg-mblue/5" : ""}`}>
                    <td className={`py-2 pr-2 ${i === 0 ? "font-bold text-ink" : "text-ink"}`}>
                      {i === 0 && "★ "}
                      {b.label}
                    </td>
                    {crit.map((c) => (
                      <td key={c.id} className="py-2 px-1 text-center">
                        <span className="inline-block w-6 rounded" style={{ background: `rgba(30,79,168,${b.scores[c.id] / 6})`, color: b.scores[c.id] >= 4 ? "#fff" : "var(--text)" }}>
                          {b.scores[c.id]}
                        </span>
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right font-semibold">{b.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Note>
              <Tag kind="illustrative" /> A sedan wins only if seats and luggage stop mattering, and then it gives up the airport and pooled-ride pools. A van has the space, but its ₹/km and city footprint hurt the volume pools. The MPV is the best compromise across all six criteria.
            </Note>
          </div>
        </div>
      </Card>
    </div>
  );
}
