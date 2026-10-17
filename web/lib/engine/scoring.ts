import { ASSUMPTIONS, type AssumptionsFile, type BodyCriterion, type PowertrainSpec } from "./assumptions";
import { computeTco, type TcoInputs, vantageFor, type VantageMode } from "./tco";

export type Criterion = "costPerKm" | "uptime" | "infra" | "co2" | "upfront";
export type Weights = Record<Criterion, number>;

export const CRITERIA: { id: Criterion; label: string; unit: string; better: "low" | "high" }[] = [
  { id: "costPerKm", label: "5-yr TCO ₹/km", unit: "₹/km", better: "low" },
  { id: "uptime", label: "Productive uptime", unit: "%", better: "high" },
  { id: "infra", label: "Infra readiness (duty-weighted)", unit: "/10", better: "high" },
  { id: "co2", label: "Well-to-wheel CO₂", unit: "g/km", better: "low" },
  { id: "upfront", label: "Upfront price", unit: "₹ L", better: "low" },
];

/** Minutes lost per day to refuelling/charging, interpolated by duty mix (default mix = 0.8 city). */
export function queueMinutes(pt: PowertrainSpec, cityShare: number, defaultCityShare = ASSUMPTIONS.dutyMix.cityShare.value): number {
  const hwyDefault = 1 - defaultCityShare;
  if (hwyDefault <= 0) return pt.queueMinPerDay;
  const q = pt.queueMinCityOnly + ((pt.queueMinPerDay - pt.queueMinCityOnly) * (1 - cityShare)) / hwyDefault;
  return Math.max(0, q);
}

export interface Co2 {
  ttw: number; // tailpipe g/km
  wtw: number; // well-to-wheel g/km (grid-mix adjusted)
}

export function co2PerKm(pt: PowertrainSpec, inp: TcoInputs, gridFactor: number, a: AssumptionsFile = ASSUMPTIONS): Co2 {
  const e = a.energy;
  const evWtw = ((inp.kWhPerKm / inp.chargingEfficiency) * gridFactor) * 1000;
  let fuelTtw = 0;
  let fuelWtw = 0;
  if (pt.kmPerFuel > 0) {
    if (pt.fuel === "cng" || pt.fuel === "biocng") {
      fuelTtw = (e.cngCo2PerKg.value / pt.kmPerFuel) * 1000;
      fuelWtw = fuelTtw * (1 + e.upstreamFossil.value) * (pt.fuel === "biocng" ? e.bioCngNetFactor.value : 1);
    } else if (pt.fuel === "petrol") {
      fuelTtw = (e.petrolCo2PerL.value / pt.kmPerFuel) * 1000;
      fuelWtw = fuelTtw * (1 + e.upstreamFossil.value);
    }
  }
  return {
    ttw: (1 - pt.evShare) * fuelTtw,
    wtw: pt.evShare * evWtw + (1 - pt.evShare) * fuelWtw,
  };
}

export interface PowertrainScore {
  id: PowertrainSpec["id"];
  label: string;
  raw: Record<Criterion, number>;
  norm: Record<Criterion, number>; // 0–10, 10 = best
  co2: Co2;
  score: number; // weighted 0–10
  rank: number;
}

export interface ScoreOptions {
  cityShare: number;
  gridFactor: number;
  weights: Weights;
  vantage: VantageMode;
  shiftMinutes?: number;
}

export function scorePowertrains(pts: PowertrainSpec[], inp: TcoInputs, opt: ScoreOptions): PowertrainScore[] {
  const shift = opt.shiftMinutes ?? 720;
  const rows = pts.map((pt) => {
    const q = queueMinutes(pt, opt.cityShare);
    const tco = computeTco({ ...pt, queueMinPerDay: q }, inp, vantageFor(pt.id, opt.vantage));
    const co2 = co2PerKm(pt, inp, opt.gridFactor);
    const raw: Record<Criterion, number> = {
      costPerKm: tco.costPerKm,
      uptime: (tco.operatingDays / inp.scheduledDays) * (1 - q / shift) * 100,
      infra: opt.cityShare * pt.infraCity + (1 - opt.cityShare) * pt.infraHighway,
      co2: co2.wtw,
      upfront: pt.price / 1e5,
    };
    return { pt, raw, co2 };
  });
  const norm = (c: Criterion, v: number) => {
    const vals = rows.map((r) => r.raw[c]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max === min) return 10;
    const better = CRITERIA.find((x) => x.id === c)?.better ?? "high";
    return better === "high" ? ((v - min) / (max - min)) * 10 : ((max - v) / (max - min)) * 10;
  };
  const wSum = Object.values(opt.weights).reduce((s, v) => s + v, 0) || 1;
  const scored = rows.map(({ pt, raw, co2 }) => {
    const n = Object.fromEntries(CRITERIA.map((c) => [c.id, norm(c.id, raw[c.id])])) as Record<Criterion, number>;
    const score = CRITERIA.reduce((s, c) => s + n[c.id] * opt.weights[c.id], 0) / wSum;
    return { id: pt.id, label: pt.label, raw, norm: n, co2, score, rank: 0 };
  });
  [...scored].sort((a, b) => b.score - a.score).forEach((s, i) => (s.rank = i + 1));
  return scored;
}

export function winner(scores: PowertrainScore[]): PowertrainScore {
  return scores.reduce((best, s) => (s.score > best.score ? s : best));
}

/** Weighted body-style scores (0–5). */
export function scoreBodyStyles(weights: Record<BodyCriterion, number>, a: AssumptionsFile = ASSUMPTIONS) {
  const wSum = Object.values(weights).reduce((s, v) => s + v, 0) || 1;
  return a.bodyStyles.options
    .map((o) => ({
      id: o.id,
      label: o.label,
      scores: o.scores,
      total: a.bodyStyles.criteria.reduce((s, c) => s + o.scores[c.id] * weights[c.id], 0) / wSum,
    }))
    .sort((x, y) => y.total - x.total);
}
