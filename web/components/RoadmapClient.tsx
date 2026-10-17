"use client";

import { useState } from "react";
import { COLORS, Card, Tag } from "@/components/ui";

export const PHASES = [
  {
    id: "pilot",
    years: "2027–29",
    name: "Pilot",
    color: COLORS.blue,
    headline: "2 metros · ~500 cars · prove 72% paid km on real fleets",
    fleet: "~500 vehicles with one partner fleet operator",
    cities: "2 metros with dense depot sites and an airport, e.g. Bengaluru and Delhi NCR",
    localisation: "~40% local content (imported LFP cells, local body and trim)",
    supply: "Cells imported; pack assembly and CNG range-extender integrated in India; low-volume line",
    infra: "Fleet depots with 11 kW AC + 2–4 × 60 kW DC per hub; CNG at existing city stations",
    partners: "One aggregator / fleet operator, one charge-point operator (CPO), one city gas distributor, one vehicle financier",
    gate: "Gate to Localise: paid-km share ≥ 70%, TCO within 10% of model, pack SOH tracking at or above plan",
  },
  {
    id: "localise",
    years: "2030–32",
    name: "Localise",
    color: COLORS.red,
    headline: "5–8 cities · cell & pack localisation · tier-1 sourcing",
    fleet: "~10,000 vehicles across several fleet operators",
    cities: "5–8 cities incl. Mumbai, Hyderabad, Chennai, Pune, Ahmedabad",
    localisation: "~70% local content: Indian cell supply (PLI-style advanced chemistry cell incentives), local motors and power electronics",
    supply: "Tier-1 sourcing for motor/inverter and Type-IV tanks; dual-source cells; battery-passport data for second life",
    infra: "Highway DC corridors for intercity, CNG/Bio-CNG on key expressways, time-of-day depot tariffs",
    partners: "Multiple aggregators and fleets, 2+ CPOs, gas distributors with Bio-CNG offtake, insurers using telematics pricing",
    gate: "Gate to Scale: 70% local content, 8-year pack warranty on actual data, profitability at 2–3 fleets",
  },
  {
    id: "scale",
    years: "2033–35",
    name: "Scale",
    color: COLORS.green,
    headline: "Pan-India · Bio-CNG in tier-2/3 · battery second life",
    fleet: "Tens of thousands of vehicles a year; open sale to fleets and owner-drivers",
    cities: "Metros plus tier-2/3 cities, where the range-extender bridges sparse charging",
    localisation: "85%+ local content",
    supply: "High-volume line; pack refurbishment and second-life stationary storage for depots",
    infra: "Bio-CNG from SATAT-type compressed biogas plants for tier-2/3 range-extension; depot storage from second-life packs",
    partners: "National aggregators, OEM-backed financing, recyclers and second-life integrators",
    gate: "Steady state: ₹/productive hour leadership across all duty cycles",
  },
] as const;

const RISKS: [string, string][] = [
  ["Cell price or supply shock", "LFP chemistry (no nickel/cobalt), dual sourcing, small 24 kWh pack limits exposure"],
  ["Slow DC corridor roll-out", "The CNG range-extender keeps intercity and airport duty running without public DC"],
  ["CNG price spikes (₹77 → ₹87/kg in Delhi during 2026)", "70% of km on electricity; the range-extender also runs on Bio-CNG as CBG plants scale"],
  ["Bio-CNG availability (132 plants vs 5,000 target)", "Bio-CNG is upside, not a dependency; the fossil-CNG fallback stays"],
  ["Driver adoption of app guidance", "One action with a reason; earnings are visible; pilot incentives tied to following VANTAGE"],
  ["Battery resale value uncertainty", "SOH telematics, battery passport, second-life route; the Conservative TCO preset tests a 20% residual"],
  ["Data privacy and regulation", "DPDP-compliant consent, data minimisation, data kept in India"],
];

export default function RoadmapClient() {
  const [sel, setSel] = useState<(typeof PHASES)[number]["id"]>("pilot");
  const p = PHASES.find((x) => x.id === sel) ?? PHASES[0];

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6">
        <div className="relative grid grid-cols-3 gap-2">
          <div className="absolute left-[16%] right-[16%] top-6 h-1 rounded bg-line" aria-hidden />
          {PHASES.map((ph, i) => (
            <button key={ph.id} type="button" onClick={() => setSel(ph.id)} className="relative flex flex-col items-center text-center group" aria-pressed={sel === ph.id}>
              <span
                className={`grid place-items-center size-12 rounded-full text-white font-bold text-lg ring-4 transition-transform ${sel === ph.id ? "scale-110 ring-surface-2" : "ring-transparent opacity-80 group-hover:opacity-100"}`}
                style={{ background: ph.color }}
              >
                {i + 1}
              </span>
              <span className="mt-2 text-sm font-bold text-ink">{ph.name}</span>
              <span className="text-xs text-muted num">{ph.years}</span>
              <span className="mt-1 hidden sm:block text-xs text-muted max-w-[16rem]">{ph.headline}</span>
            </button>
          ))}
        </div>
      </div>

      <Card title={`${p.name} · ${p.years}`} sub={p.headline} tag="target">
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {(
            [
              ["Fleet", p.fleet],
              ["Cities", p.cities],
              ["Localisation", p.localisation],
              ["Supply chain", p.supply],
              ["Infrastructure dependencies", p.infra],
              ["Partnership types", p.partners],
            ] as const
          ).map(([k, val]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wider text-muted font-semibold">{k}</dt>
              <dd className="text-ink mt-0.5">{val}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 rounded-xl px-4 py-3 text-sm text-white" style={{ background: p.color }}>
          <strong>Gate:</strong> {p.gate.replace(/^Gate to \w+: /, "").replace(/^Steady state: /, "")}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Infrastructure readiness today" tag="sourced">
          <ul className="text-sm text-ink space-y-2">
            <li>
              <strong>52,718</strong> public EV charging stations, of which <strong>16,561</strong> have fast chargers for cars (Lok Sabha reply, July 2026, S9).
            </li>
            <li>
              About <strong>8,150</strong> CNG stations, with a target of 18,000+ by 2030 (S11).
            </li>
            <li>
              <strong>132</strong> compressed-biogas plants complete vs a 5,000 target; CBG blending obligation rises to 5% from FY28-29 (S15, S16).
            </li>
            <li>
              PM E-DRIVE: ₹2,000 cr for charging, including 22,100 fast chargers for e-4Ws, until March 2028 (S23).
            </li>
          </ul>
        </Card>
        <Card title="Key risks & mitigations">
          <table className="w-full text-sm">
            <tbody>
              {RISKS.map(([r, m]) => (
                <tr key={r} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3 font-semibold text-ink w-[42%]">{r}</td>
                  <td className="py-1.5 text-muted">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">
            <Tag kind="illustrative" />
          </div>
        </Card>
      </div>
    </div>
  );
}
