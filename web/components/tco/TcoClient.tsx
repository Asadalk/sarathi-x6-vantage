"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS, Card, Kpi, Note, PT_COLORS, Segmented, Slider, Tag } from "@/components/ui";
import type { PowertrainId, PowertrainSpec } from "@/lib/engine/assumptions";
import { breakEvenTariff, compare, computeAll, tornado, type TcoInputs, type VantageMode } from "@/lib/engine/tco";
import { inr, inrL, pct } from "@/lib/format";
import { conservativeScenario, decodeScenario, defaultScenario, encodeScenario, financedScenario, type Scenario } from "@/lib/scenario";

const COMPONENTS: { key: keyof ReturnType<typeof computeAll>[number]["breakdown"]; label: string; color: string }[] = [
  { key: "purchaseNet", label: "Purchase − residual", color: COLORS.navy },
  { key: "financing", label: "Financing", color: COLORS.violet },
  { key: "energy", label: "Energy", color: COLORS.red },
  { key: "maintenance", label: "Maintenance", color: COLORS.amber },
  { key: "insurance", label: "Insurance", color: COLORS.cyan },
  { key: "battery", label: "Battery replacement", color: COLORS.green },
  { key: "downtime", label: "Downtime cost", color: COLORS.slate },
];

type Preset = "round1" | "conservative" | "financed" | "custom";

export default function TcoClient() {
  const sp = useSearchParams();
  const [s, setS] = useState<Scenario>(() => decodeScenario(sp.toString()));
  const [preset, setPreset] = useState<Preset>(() => (sp.toString() ? "custom" : "round1"));
  const [copied, setCopied] = useState(false);

  // Keep the URL in sync so the scenario can be shared.
  useEffect(() => {
    const qs = encodeScenario(s);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [s]);

  const setI = (k: keyof TcoInputs) => (v: number) => {
    setS((o) => ({ ...o, inputs: { ...o.inputs, [k]: v } }));
    setPreset("custom");
  };
  const setP = (id: PowertrainId, k: keyof PowertrainSpec) => (v: number) => {
    setS((o) => ({ ...o, specs: { ...o.specs, [id]: { ...o.specs[id], [k]: v } } }));
    setPreset("custom");
  };
  const load = (p: Preset) => {
    setPreset(p);
    if (p === "round1") setS(defaultScenario());
    if (p === "conservative") setS(conservativeScenario());
    if (p === "financed") setS(financedScenario());
  };

  const { inputs: inp, specs, vantage } = s;
  const results = useMemo(() => computeAll(Object.values(specs), inp, vantage), [specs, inp, vantage]);
  const base = results.find((r) => r.id === "CNG")!;
  const cand = results.find((r) => r.id === "EREV")!;
  const cmp = compare(base, cand, specs.CNG, specs.EREV);
  const bars = useMemo(() => tornado(specs.CNG, specs.EREV, inp), [specs, inp]);
  const be = breakEvenTariff(specs.EREV, specs.CNG, inp);

  const stacked = results.map((r) => ({
    name: r.label.replace(" (baseline)", "").replace("SARATHI-X6 ", "SARATHI "),
    ...Object.fromEntries(COMPONENTS.map((c) => [c.key, +(r.breakdown[c.key] / 1e5).toFixed(2)])),
    total: +(r.total / 1e5).toFixed(2),
  }));
  const tornadoData = bars.map((b) => {
    const lo = (b.low - cmp.tcoSaving) / 1e5;
    const hi = (b.high - cmp.tcoSaving) / 1e5;
    return { label: b.label, neg: +Math.min(lo, hi, 0).toFixed(2), pos: +Math.max(lo, hi, 0).toFixed(2) };
  });
  const lk = (v: number) => `₹${v.toFixed(1)} L`;

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
      {/* Inputs */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <Card title="Scenario">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["round1", "Round-1 preset"],
                ["conservative", "Conservative"],
                ["financed", "Financed"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => load(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${preset === id ? "bg-mblue text-white border-mblue" : "border-line text-ink hover:bg-surface-2"}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="rounded-lg px-3 py-1.5 text-sm border border-line text-muted hover:bg-surface-2"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          <div className="mt-3 text-xs text-muted">Who gets VANTAGE (sets the paid-km share)</div>
          <div className="mt-1">
            <Segmented<VantageMode>
              label="VANTAGE applies to"
              value={vantage}
              onChange={(v) => {
                setS((o) => ({ ...o, vantage: v }));
                setPreset("custom");
              }}
              options={[
                { id: "sarathi-only", label: "SARATHI only" },
                { id: "all", label: "All" },
                { id: "none", label: "None" },
              ]}
            />
          </div>
        </Card>

        <Card title="Duty & revenue">
          <Slider label="km per day (before refuel losses)" value={inp.kmPerDay} min={120} max={320} step={5} onChange={setI("kmPerDay")} fmt={(v) => `${v} km`} />
          <Slider label="Operating days / year" value={inp.scheduledDays} min={250} max={360} step={5} onChange={setI("scheduledDays")} fmt={(v) => `${v}`} />
          <Slider label="Fare per paid km" value={inp.farePerPaidKm} min={20} max={50} step={1} onChange={setI("farePerPaidKm")} fmt={(v) => `₹${v}`} />
          <Slider label="Platform commission" value={inp.platformCommission} min={0} max={0.35} step={0.01} onChange={setI("platformCommission")} fmt={(v) => pct(v)} />
          <Slider label="Driver share of net fare" value={inp.driverShareOfNet} min={0.3} max={0.8} step={0.01} onChange={setI("driverShareOfNet")} fmt={(v) => pct(v)} />
          <Slider label="Drivers per vehicle (shifts)" value={inp.driverShifts} min={1} max={3} step={1} onChange={setI("driverShifts")} fmt={(v) => `${v}`} />
          <Slider label="Paid-km share without VANTAGE" value={inp.paidShareBaseline} min={0.5} max={0.8} step={0.01} onChange={setI("paidShareBaseline")} fmt={(v) => pct(v)} />
          <Slider label="Paid-km share with VANTAGE" value={inp.paidShareVantage} min={0.5} max={0.85} step={0.01} onChange={setI("paidShareVantage")} fmt={(v) => pct(v)} hint="The /vantage simulator gives 62% → 72% (10-seed mean)" />
          <Slider label="Downtime cost per day" value={inp.downtimeCostPerDay} min={0} max={5000} step={100} onChange={setI("downtimeCostPerDay")} fmt={inr} />
        </Card>

        <Card title="Energy">
          <Slider label="CNG price" value={inp.cngPrice} min={60} max={120} step={1} onChange={setI("cngPrice")} fmt={(v) => `₹${v}/kg`} hint="Delhi ₹86.98, Mumbai ₹89 in 2026 (S5, S6)" />
          <Slider label="Depot electricity" value={inp.depotTariff} min={3} max={14} step={0.5} onChange={setI("depotTariff")} fmt={(v) => `₹${v}/kWh`} />
          <Slider label="Public DC electricity" value={inp.publicDcTariff} min={8} max={28} step={0.5} onChange={setI("publicDcTariff")} fmt={(v) => `₹${v}/kWh`} hint="₹15–26/kWh in 2026 (S7, S8)" />
          <Slider label="SARATHI depot share of charging" value={specs.EREV.depotShare} min={0} max={1} step={0.05} onChange={setP("EREV", "depotShare")} fmt={(v) => pct(v)} />
          <Slider label="SARATHI km on EV" value={specs.EREV.evShare} min={0.3} max={0.95} step={0.01} onChange={setP("EREV", "evShare")} fmt={(v) => pct(v)} />
          <Slider label="Consumption" value={inp.kWhPerKm} min={0.1} max={0.2} step={0.005} onChange={setI("kWhPerKm")} fmt={(v) => `${v.toFixed(3)} kWh/km`} />
          <Slider label="CNG car real-world efficiency" value={specs.CNG.kmPerFuel} min={15} max={27} step={0.5} onChange={setP("CNG", "kmPerFuel")} fmt={(v) => `${v} km/kg`} hint="ARAI 26.08 km/kg for Ertiga Tour (S22)" />
          <Slider label="Petrol price" value={inp.petrolPrice} min={80} max={130} step={1} onChange={setI("petrolPrice")} fmt={(v) => `₹${v}/L`} />
          <Slider label="Bio-CNG price" value={inp.bioCngPrice} min={60} max={120} step={1} onChange={setI("bioCngPrice")} fmt={(v) => `₹${v}/kg`} />
        </Card>

        <Card title="Vehicle, finance & uptime">
          <Slider label="SARATHI-X6 price" value={specs.EREV.price} min={900000} max={1600000} step={10000} onChange={setP("EREV", "price")} fmt={(v) => inrL(v, 2)} />
          <Slider label="CNG baseline price" value={specs.CNG.price} min={800000} max={1400000} step={10000} onChange={setP("CNG", "price")} fmt={(v) => inrL(v, 2)} />
          <Slider label="Purchase subsidy (all)" value={inp.subsidy} min={0} max={200000} step={5000} onChange={setI("subsidy")} fmt={inr} />
          <Slider label="SARATHI residual after 5 yr" value={specs.EREV.residualPct} min={0.05} max={0.4} step={0.01} onChange={setP("EREV", "residualPct")} fmt={(v) => pct(v)} />
          <Slider label="CNG residual after 5 yr" value={specs.CNG.residualPct} min={0.05} max={0.4} step={0.01} onChange={setP("CNG", "residualPct")} fmt={(v) => pct(v)} />
          <Slider label="SARATHI maintenance" value={specs.EREV.maintPerKm} min={0.1} max={0.8} step={0.01} onChange={setP("EREV", "maintPerKm")} fmt={(v) => `₹${v.toFixed(2)}/km`} />
          <Slider label="CNG maintenance" value={specs.CNG.maintPerKm} min={0.2} max={1.2} step={0.01} onChange={setP("CNG", "maintPerKm")} fmt={(v) => `₹${v.toFixed(2)}/km`} />
          <Slider label="SARATHI insurance / yr" value={specs.EREV.insurancePerYear} min={15000} max={60000} step={1000} onChange={setP("EREV", "insurancePerYear")} fmt={inr} />
          <Slider label="SARATHI downtime days / yr" value={specs.EREV.downtimeDays} min={0} max={30} step={1} onChange={setP("EREV", "downtimeDays")} fmt={(v) => `${v}`} />
          <Slider label="CNG downtime days / yr" value={specs.CNG.downtimeDays} min={0} max={30} step={1} onChange={setP("CNG", "downtimeDays")} fmt={(v) => `${v}`} />
          <Slider label="CNG queue minutes / day" value={specs.CNG.queueMinPerDay} min={0} max={120} step={5} onChange={setP("CNG", "queueMinPerDay")} fmt={(v) => `${v} min`} />
          <Slider label="Battery pack cost (replacement)" value={inp.batteryPackCostPerKWh} min={3000} max={12000} step={250} onChange={setI("batteryPackCostPerKWh")} fmt={(v) => `₹${v}/kWh`} />
          <Slider label="Down payment" value={inp.downPaymentPct} min={0} max={1} step={0.05} onChange={setI("downPaymentPct")} fmt={(v) => (v >= 1 ? "Cash" : pct(v))} />
          <Slider label="Loan rate" value={inp.loanRate} min={0.06} max={0.18} step={0.005} onChange={setI("loanRate")} fmt={(v) => pct(v, 1)} />
        </Card>
      </div>

      {/* Outputs */}
      <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <Kpi value={inrL(cmp.tcoSaving)} label="5-yr TCO saving vs CNG" sub={`${inrL(base.total)} → ${inrL(cand.total)} (${pct(cmp.tcoSavingPct)})`} color={COLORS.red} />
          <Kpi value={inrL(cmp.annualOperatorSaving, 2)} label="operator cost saving / yr" sub="TCO view, per vehicle" color={COLORS.blue} />
          <Kpi value={`${cmp.driverAnnualDelta >= 0 ? "+" : "−"}${inrL(Math.abs(cmp.driverAnnualDelta), 2)}`} label="driver earnings / yr" sub={`${cmp.paidKmDelta >= 0 ? "+" : ""}${Math.round(cmp.paidKmDelta).toLocaleString("en-IN")} paid km per driver-vehicle`} color={COLORS.amber} />
          <Kpi value={inrL(cand.operatorProfit, 2)} label="SARATHI operator profit / yr" sub={`CNG baseline: ${inrL(base.operatorProfit, 2)}`} color={COLORS.green} />
          <Kpi value={inr(cand.driverMonthly)} label="driver net / month" sub={`CNG baseline: ${inr(base.driverMonthly)}`} color={COLORS.navy} />
          <Kpi
            value={Number.isFinite(cmp.paybackYears) ? `${cmp.paybackYears.toFixed(1)} yr` : "never"}
            label="payback of price premium"
            sub={be !== null ? `Break-even electricity: ₹${be.toFixed(1)}/kWh` : "—"}
            color={COLORS.cyan}
          />
        </div>

        <Card title="5-year TCO by powertrain (₹ lakh per vehicle)" sub="Purchase is net of residual value · same duty cycle for all · bars sum to the total" tag="illustrative">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stacked} layout="vertical" margin={{ left: 8, right: 36, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => `₹${v}L`} fontSize={12} label={{ value: "₹ lakh over 5 years", position: "insideBottom", offset: -2, fontSize: 11 }} height={36} />
                <YAxis type="category" dataKey="name" width={104} fontSize={12} />
                <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)} L`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {COMPONENTS.map((c) => (
                  <Bar key={c.key} dataKey={c.key} name={c.label} stackId="t" fill={c.color} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            {results.map((r) => (
              <div key={r.id} className="rounded-lg bg-surface-2 px-2 py-1.5">
                <div className="font-semibold" style={{ color: PT_COLORS[r.id] }}>
                  {r.id === "EREV" ? "SARATHI" : r.id}
                </div>
                <div className="num text-ink">{inrL(r.total)}</div>
                <div className="num text-muted">₹{r.costPerKm.toFixed(2)}/km</div>
              </div>
            ))}
          </div>
          <Note>
            A pure BEV can match or beat SARATHI on cost alone. It loses on uptime: intercity and airport duty forces mid-shift DC queues ({specs.BEV.queueMinPerDay} min/day here vs {specs.EREV.queueMinPerDay} for SARATHI), which costs paid km. See the{" "}
            <a href="/powertrain" className="underline">
              powertrain selector
            </a>
            .
          </Note>
        </Card>

        <div className="grid xl:grid-cols-2 gap-4">
          <Card title="Sensitivity: 5-yr saving vs CNG" sub={`Each input moved ±20%, others held · base saving ${inrL(cmp.tcoSaving)}`} tag="illustrative">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tornadoData} layout="vertical" stackOffset="sign" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} fontSize={12} height={36} label={{ value: "Δ saving, ₹ lakh", position: "insideBottom", offset: -2, fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={118} fontSize={11} />
                  <ReferenceLine x={0} stroke="var(--muted)" />
                  <Tooltip formatter={(v) => lk(Number(v))} />
                  <Bar dataKey="neg" name="Lower saving" stackId="s" fill={COLORS.red} isAnimationActive={false} />
                  <Bar dataKey="pos" name="Higher saving" stackId="s" fill={COLORS.green} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Note>Saving stays positive across every ±20% swing shown: the lowest case is {inrL(Math.min(...bars.map((b) => Math.min(b.low, b.high))))}.</Note>
          </Card>

          <Card title="Operator & driver view (per vehicle, per year)" tag="illustrative">
            <div className="overflow-x-auto">
              <table className="w-full text-sm num">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-line">
                    <th className="py-2 pr-2 font-medium">Item</th>
                    <th className="py-2 px-2 font-medium text-right">CNG</th>
                    <th className="py-2 pl-2 font-medium text-right">SARATHI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Effective km / day", base.dailyKm.toFixed(0), cand.dailyKm.toFixed(0)],
                    ["Operating days", base.operatingDays, cand.operatingDays],
                    ["Total km / yr", Math.round(base.annualKm).toLocaleString("en-IN"), Math.round(cand.annualKm).toLocaleString("en-IN")],
                    ["Paid-km share", pct(base.paidShare), pct(cand.paidShare)],
                    ["Paid km / yr", Math.round(base.annualPaidKm).toLocaleString("en-IN"), Math.round(cand.annualPaidKm).toLocaleString("en-IN")],
                    ["Fare net of commission", inrL(base.netRevenue, 2), inrL(cand.netRevenue, 2)],
                    ["Driver pay", inrL(base.driverPay, 2), inrL(cand.driverPay, 2)],
                    ["Vehicle cost (TCO ÷ 5)", inrL(base.total / inp.years, 2), inrL(cand.total / inp.years, 2)],
                    ["Operator profit", inrL(base.operatorProfit, 2), inrL(cand.operatorProfit, 2)],
                    ["Energy ₹ / km", `₹${base.energyPerKm.toFixed(2)}`, `₹${cand.energyPerKm.toFixed(2)}`],
                  ].map(([k, a, b]) => (
                    <tr key={String(k)} className="border-b border-line/60">
                      <td className="py-1.5 pr-2 text-ink">{k}</td>
                      <td className="py-1.5 px-2 text-right">{a}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              <Tag kind="illustrative" /> The driver model is a revenue share: the driver keeps {pct(inp.driverShareOfNet)} of the fare after commission, so more paid km means more pay. Battery cycles in 5 years: {Math.round(cand.batteryCycles).toLocaleString("en-IN")} against a rated {inp.lfpCycleLife.toLocaleString("en-IN")}, so no pack replacement is needed.
            </Note>
          </Card>
        </div>
      </div>
    </div>
  );
}
