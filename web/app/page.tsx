import Link from "next/link";
import VehicleArt from "@/components/VehicleArt";
import { COLORS, Kpi, ModuleLink } from "@/components/ui";
import { powertrain } from "@/lib/engine/assumptions";
import { physics } from "@/lib/engine/physics";
import { compare, computeTco, defaultInputs } from "@/lib/engine/tco";
import { inrL } from "@/lib/format";

export default function Home() {
  const inp = defaultInputs();
  const cng = powertrain("CNG");
  const erev = powertrain("EREV");
  const c = compare(computeTco(cng, inp, false), computeTco(erev, inp, true), cng, erev);
  const p = physics();

  return (
    <>
      <div className="mt-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-2 text-xs sm:text-sm text-ink">
        All economics are illustrative 2035 planning values; data marked <strong>synthetic</strong> is simulated. Every number is computed live by tested code —{" "}
        <Link href="/assumptions" className="underline font-semibold">
          see every assumption
        </Link>
        .
      </div>

      <section className="grid lg:grid-cols-2 gap-6 items-center pt-8 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Maruti Suzuki XCELerate 2026 · E-Track · Round 2</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight">SARATHI-X6</h1>
          <p className="mt-1 text-lg sm:text-xl font-semibold text-ink">The ride-service workhorse for India 2035</p>
          <p className="mt-3 text-muted leading-relaxed max-w-xl text-pretty">
            A 6+1 compact MPV with a 24 kWh LFP battery and a CNG range-extender, run by <strong className="text-ink">VANTAGE</strong>, a fleet intelligence layer that turns idle time into paid kilometres. The design rule:{" "}
            <strong className="text-ink">optimise ₹ per productive hour, not claimed range.</strong>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/tco" className="rounded-xl bg-mblue px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              Run the TCO calculator
            </Link>
            <Link href="/vantage" className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2">
              Watch the fleet simulator
            </Link>
          </div>
        </div>
        <div className="card p-4 sm:p-6 bg-gradient-to-b from-surface to-surface-2">
          <VehicleArt className="w-full h-auto" />
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-cyan px-3 py-1 text-navy">EV-FIRST</span>
            <span className="rounded-lg bg-mred px-3 py-1 text-white">6+1 SEATS</span>
            <span className="rounded-lg bg-navy px-3 py-1 text-white dark:bg-mblue">CNG RANGE-EXTENDER</span>
          </div>
          <p className="mt-2 text-center text-xs text-muted">24 kWh LFP · 80–90 kW e-motor · 60 kW DC · original illustration</p>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi value={`${Math.floor(p.combinedRangeKm / 10) * 10}+ km`} label="combined operating range" sub={`${Math.round(p.evRangeKm)} km EV + ${Math.round(p.rangeExtenderKm)} km CNG`} color={COLORS.blue} />
        <Kpi value="70%" label="urban km on EV" sub="2035 planning assumption" color={COLORS.green} />
        <Kpi value={`${Math.round(c.tcoSavingPct * 100)}%`} label="lower 5-year TCO" sub={`${inrL(c.baseline.total)} → ${inrL(c.candidate.total)}`} color={COLORS.red} />
        <Kpi value={`+${inrL(c.driverAnnualDelta, 2)}`} label="driver earnings / year" sub={`+${Math.round(c.paidKmDelta / 100) * 100} paid km/yr`} color={COLORS.amber} />
        <Kpi value="20 min" label="10–80% DC charge" sub={`${p.dcAvgPowerKw.toFixed(0)} kW avg · ${p.dcAvgCRate.toFixed(1)}C`} color={COLORS.navy} />
      </section>

      <h2 className="mt-10 mb-3 text-lg font-bold">One question per module, one tested engine underneath</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ModuleLink href="/market" n="1" title="2035 Market Explorer" text="Where the volume is and where the margin is: six segments, adjustable growth." />
        <ModuleLink href="/vehicle" n="2" title="Concept & Specs" text="Why a 6+1 compact MPV: seat modes, luggage, safety, durability targets, re-weightable body-style matrix." />
        <ModuleLink href="/powertrain" n="3" title="Powertrain Selector" text="CNG, Bio-CNG, HEV, PHEV, BEV and EREV compared on ₹/km, uptime, infrastructure and CO₂." />
        <ModuleLink href="/tco" n="5" title="TCO & Driver Earnings" text={`5-year TCO, operator profit, driver net, payback and sensitivity. Round-1 preset: ${inrL(c.tcoSaving)} saved.`} />
        <ModuleLink href="/vantage" n="6" title="Live Fleet Simulator" text="50 cars over 24 hours, a naive fleet vs a VANTAGE fleet, side by side, with click-to-explain decisions." />
        <ModuleLink href="/health" n="6" title="Battery & Predictive Maintenance" text="Synthetic telematics; an IsolationForest flags at-risk vehicles with a reason and an action." />
        <ModuleLink href="/apps" n="6" title="Driver & Rider Apps" text="Best-next-action, earnings vs target, seat modes, SOS, and the data loop that connects them." />
        <ModuleLink href="/roadmap" n="7" title="Roadmap 2027–35" text="Pilot → Localise → Scale, with infrastructure dependencies, partner types and risks." />
        <ModuleLink href="/assumptions" n="✓" title="Every assumption" text="Every input with its value, unit, source or rationale, and the pages that use it." />
      </div>
    </>
  );
}
