"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { COLORS, Card, Kpi, Note, Slider, Tag } from "@/components/ui";
import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { computeMarket, defaultMarketInputs, type MarketInputs } from "@/lib/engine/market";
import { pct } from "@/lib/format";

const SEG_COLORS: Record<string, string> = {
  intracity: COLORS.blue,
  commute: COLORS.cyan,
  airport: COLORS.red,
  intercity: COLORS.amber,
  shared: COLORS.green,
  premium: COLORS.violet,
};

export default function MarketClient() {
  const [inp, setInp] = useState<MarketInputs>(defaultMarketInputs);
  const m = useMemo(() => computeMarket(inp), [inp]);
  const set = (k: keyof MarketInputs) => (v: number) => setInp((o) => ({ ...o, [k]: v }));
  const avgMargin = ASSUMPTIONS.market.segments.reduce((s, x) => s + x.marginPct * x.revenueShare, 0);
  const totalKm = m.segments.reduce((s, x) => s + x.paidKmBn, 0);
  const data = m.segments.map((s) => ({
    ...s,
    kmShare: +((s.paidKmBn / totalKm) * 100).toFixed(1),
    marginPctX: +(s.marginPct * 100).toFixed(1),
    marginCrK: +(s.marginCr / 1000).toFixed(1),
    short: s.label.split(" ")[0].replace("Intra-city", "Intra-city"),
  }));

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Growth & share" tag="sourced">
          <Slider label="CAGR 2026–31" value={inp.cagr1} min={0.05} max={0.25} step={0.005} onChange={set("cagr1")} fmt={(v) => pct(v, 1)} hint="Mordor Intelligence: 17.93% (S1); TechSci: 6.16% (S4)" />
          <Slider label="CAGR 2031–35" value={inp.cagr2} min={0.02} max={0.2} step={0.005} onChange={set("cagr2")} fmt={(v) => pct(v, 1)} hint="Assumption: deceleration as market matures" />
          <Slider label="Ride-hailing share of taxi market, 2035" value={inp.rideHailingShare2035} min={0.5} max={0.95} step={0.01} onChange={set("rideHailingShare2035")} fmt={(v) => pct(v)} hint="65.1% in 2025 (S2)" />
          <Slider label="Fare-yield multiplier" value={inp.fareMultiplier} min={0.7} max={1.4} step={0.05} onChange={set("fareMultiplier")} fmt={(v) => `${v.toFixed(2)}×`} hint="Higher ₹/km → fewer paid km for the same ₹ pool" />
          <button type="button" onClick={() => setInp(defaultMarketInputs())} className="mt-2 text-sm text-accent underline">
            Reset
          </button>
        </Card>
        <Card title="Why it matters for the vehicle">
          <p className="text-sm text-muted leading-relaxed">
            Volume pools (intra-city, commute, shared) need a low ₹/km car that runs cheaply on electricity. Yield pools (airport, intercity, premium) need luggage space, comfort and range without a charging stop. <strong className="text-ink">One 6+1 vehicle that can serve both</strong> stays busy all day.
          </p>
        </Card>
      </div>

      <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi value={`$${m.taxiMarket2035UsdBn.toFixed(0)} bn`} label="India taxi market, 2035" sub={`from $${ASSUMPTIONS.market.taxiMarket2026UsdBn.value} bn in 2026 (S1)`} color={COLORS.navy} />
          <Kpi value={`₹${(m.rideHailing2035Cr / 1e5).toFixed(1)} L cr`} label="ride-hailing pool" sub="₹ lakh crore per year" color={COLORS.blue} />
          <Kpi value={pct(m.volumeShareOfKm)} label="of paid km in volume pools" sub="intra-city · commute · shared" color={COLORS.cyan} />
          <Kpi value={pct(m.yieldShareOfMargin)} label="of margin in yield pools" sub="airport · intercity · premium" color={COLORS.red} />
        </div>

        <Card title="Volume vs margin, 2035" sub="x = share of paid km · y = operating margin · bubble = margin pool (₹ ’000 crore)" tag="illustrative">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 4, right: 24, top: 16, bottom: 16 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="kmShare" name="Share of paid km" unit="%" fontSize={12} label={{ value: "Share of 2035 paid km (%)", position: "insideBottom", offset: -8, fontSize: 11 }} />
                <YAxis type="number" dataKey="marginPctX" name="Margin" unit="%" fontSize={12} width={44} domain={[0, 26]} label={{ value: "Margin %", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <ZAxis type="number" dataKey="marginCrK" range={[250, 2400]} name="Margin pool" unit="k cr" />
                <ReferenceLine y={+(avgMargin * 100).toFixed(1)} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: "avg margin", fontSize: 10, position: "right" }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={data} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.id} fill={SEG_COLORS[d.id]} fillOpacity={0.75} />
                  ))}
                  <LabelList dataKey="short" position="top" fontSize={11} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="2035 segment sizing" tag="illustrative">
          <div className="overflow-x-auto">
            <table className="w-full text-sm num">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-line">
                  <th className="py-2 pr-2 font-medium">Segment</th>
                  <th className="py-2 px-2 font-medium text-right">Trips/day</th>
                  <th className="py-2 px-2 font-medium text-right">Avg trip</th>
                  <th className="py-2 px-2 font-medium text-right">Paid km/yr</th>
                  <th className="py-2 px-2 font-medium text-right">₹/km</th>
                  <th className="py-2 px-2 font-medium text-right">Margin</th>
                  <th className="py-2 pl-2 font-medium">Pool</th>
                </tr>
              </thead>
              <tbody>
                {m.segments.map((s) => (
                  <tr key={s.id} className="border-b border-line/60">
                    <td className="py-1.5 pr-2">
                      <span className="inline-block size-2.5 rounded-full mr-2 align-middle" style={{ background: SEG_COLORS[s.id] }} />
                      {s.label}
                    </td>
                    <td className="py-1.5 px-2 text-right">{s.tripsPerDayLakh.toFixed(1)} L</td>
                    <td className="py-1.5 px-2 text-right">{s.avgTripKm} km</td>
                    <td className="py-1.5 px-2 text-right">{s.paidKmBn.toFixed(1)} bn</td>
                    <td className="py-1.5 px-2 text-right">₹{s.farePerKm.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right">{pct(s.marginPct)}</td>
                    <td className="py-1.5 pl-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.pool === "yield" ? "bg-mred/15 text-mred" : "bg-mblue/15 text-mblue dark:text-accent"}`}>{s.pool}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            <Tag kind="sourced" /> Anchors: 2026 market and CAGR (S1), ride-hailing share 65.1% (S2), intra-city point-to-point is 60.75% of trips and airport transfers are growing at 19.14% CAGR (S3). Sources disagree: another Mordor snippet gives $24 bn at 7.8%, and TechSci gives 6.2% (S4). Use the sliders to test the low case. Revenue shares, trip lengths, ₹/km and margins by segment are{" "}
            <a href="/assumptions" className="underline">
              assumptions
            </a>
            . These are not Maruti Suzuki forecasts.
          </Note>
        </Card>
      </div>
    </div>
  );
}
