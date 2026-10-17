/** Export every number the deck quotes, computed by the same engine as the app. */
import { writeFileSync } from "node:fs";
import demandRaw from "../public/data/demand.json";
import healthRaw from "../public/data/health.json";
import { ASSUMPTIONS, powertrain } from "../lib/engine/assumptions";
import { computeMarket, defaultMarketInputs } from "../lib/engine/market";
import { physics } from "../lib/engine/physics";
import { scoreBodyStyles, scorePowertrains, type Weights } from "../lib/engine/scoring";
import { DEFAULT_SIM, generateRequests, runSim, type DemandData } from "../lib/engine/sim";
import { breakEvenTariff, compare, computeAll, computeTco, defaultInputs, tornado } from "../lib/engine/tco";
import { conservativeScenario } from "../lib/scenario";

const inp = defaultInputs();
const cng = powertrain("CNG");
const erev = powertrain("EREV");
const base = computeTco(cng, inp, false);
const cand = computeTco(erev, inp, true);
const c = compare(base, cand, cng, erev);
const all = computeAll(ASSUMPTIONS.powertrains, inp);

const cons = conservativeScenario();
const cb = computeTco(cons.specs.CNG, cons.inputs, false);
const cc = computeTco(cons.specs.EREV, cons.inputs, true);

const d = demandRaw as unknown as DemandData;
const reqs = generateRequests(d, DEFAULT_SIM);
const n = runSim("naive", d, DEFAULT_SIM, reqs, false).metrics;
const v = runSim("vantage", d, DEFAULT_SIM, reqs, false).metrics;
const seeds: { n: number; v: number; trips: number; net: number }[] = [];
for (let seed = 2031; seed <= 2040; seed++) {
  const cfg = { ...DEFAULT_SIM, seed };
  const r = generateRequests(d, cfg);
  const a = runSim("naive", d, cfg, r, false).metrics;
  const b = runSim("vantage", d, cfg, r, false).metrics;
  seeds.push({ n: a.paidShare, v: b.paidShare, trips: b.tripsServed / a.tripsServed, net: b.netPerVehicleHour / a.netPerVehicleHour });
}
const mean = (k: keyof (typeof seeds)[number]) => seeds.reduce((s, x) => s + x[k], 0) / seeds.length;

const W = ASSUMPTIONS.scoringWeights as Weights;
const score = (cs: number) => scorePowertrains(ASSUMPTIONS.powertrains, inp, { cityShare: cs, gridFactor: 0.55, weights: W, vantage: "all" }).sort((a, b) => a.rank - b.rank).map((s) => ({ id: s.id, score: s.score, ttw: s.co2.ttw, wtw: s.co2.wtw, costPerKm: s.raw.costPerKm, uptime: s.raw.uptime }));
const bw = Object.fromEntries(ASSUMPTIONS.bodyStyles.criteria.map((x) => [x.id, x.weight])) as Parameters<typeof scoreBodyStyles>[0];
const m = computeMarket(defaultMarketInputs());
const h = healthRaw as unknown as { detected: { truePositives: number; injectedFaults: number; flagged: number } };
const bars = tornado(cng, erev, inp);

const out = {
  tco: {
    cngTotal: base.total, erevTotal: cand.total, saving: c.tcoSaving, savingPct: c.tcoSavingPct, annualSaving: c.annualOperatorSaving,
    driverDelta: c.driverAnnualDelta, paidKmDelta: c.paidKmDelta, opProfitCng: base.operatorProfit, opProfitErev: cand.operatorProfit,
    driverMonthlyCng: base.driverMonthly, driverMonthlyErev: cand.driverMonthly, payback: c.paybackYears,
    breakEvenTariff: breakEvenTariff(erev, cng, inp), costPerKmCng: base.costPerKm, costPerKmErev: cand.costPerKm,
    energyPerKmCng: base.energyPerKm, energyPerKmErev: cand.energyPerKm,
    all: all.map((r) => ({ id: r.id, label: r.label, total: r.total, costPerKm: r.costPerKm, breakdown: r.breakdown })),
    conservativeSaving: cb.total - cc.total, conservativePct: (cb.total - cc.total) / cb.total,
    tornadoMin: Math.min(...bars.map((b) => Math.min(b.low, b.high))), tornadoTop: bars.slice(0, 3).map((b) => b.label),
    batteryCycles5y: cand.batteryCycles,
  },
  sim: {
    seed: DEFAULT_SIM.seed, vehicles: DEFAULT_SIM.vehicles, naive: n, vantage: v,
    meanNaive: mean("n"), meanVantage: mean("v"), meanTrips: mean("trips"), meanNet: mean("net"),
    minDelta: Math.min(...seeds.map((s) => s.v - s.n)),
  },
  physics: physics(),
  powertrain: { mixed: score(0.8), city: score(1.0), highway: score(0.5) },
  body: scoreBodyStyles(bw).map((b) => ({ id: b.id, label: b.label, total: b.total })),
  market: { usd2035: m.taxiMarket2035UsdBn, rhCr: m.rideHailing2035Cr, volumeShareOfKm: m.volumeShareOfKm, yieldShareOfMargin: m.yieldShareOfMargin, segments: m.segments },
  health: h.detected,
};
writeFileSync(process.argv[2] ?? "../deck/numbers.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ saving: out.tco.saving, pct: out.tco.savingPct, sim: [n.paidShare, v.paidShare, out.sim.meanNaive, out.sim.meanVantage, out.sim.minDelta], cons: out.tco.conservativeSaving, consPct: out.tco.conservativePct }, null, 0));
