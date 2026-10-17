import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, powertrain, type BodyCriterion } from "@/lib/engine/assumptions";
import { co2PerKm, queueMinutes, scoreBodyStyles, scorePowertrains, winner, type Weights } from "@/lib/engine/scoring";
import { computeMarket, defaultMarketInputs } from "@/lib/engine/market";
import { defaultInputs } from "@/lib/engine/tco";

const inp = defaultInputs();
const W = ASSUMPTIONS.scoringWeights as Weights;
const run = (cityShare: number, weights: Weights = W) =>
  scorePowertrains(ASSUMPTIONS.powertrains, inp, { cityShare, gridFactor: 0.55, weights, vantage: "all" });

describe("powertrain multi-criteria scoring", () => {
  it("EREV wins for the default mixed intra/inter-city fleet", () => {
    expect(winner(run(ASSUMPTIONS.dutyMix.cityShare.value)).id).toBe("EREV");
  });
  it("pure BEV wins for dense, 100 % intra-city duty (honest crossover)", () => {
    expect(winner(run(1)).id).toBe("BEV");
  });
  it("CNG wins when only upfront cost matters", () => {
    expect(winner(run(0.8, { costPerKm: 0, uptime: 0, infra: 0, co2: 0, upfront: 1 })).id).toMatch(/CNG/);
  });
  it("normalised scores are within 0–10 and ranks are a permutation", () => {
    const s = run(0.8);
    for (const r of s) {
      for (const v of Object.values(r.norm)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
    expect(s.map((x) => x.rank).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("queue minutes reproduce the default at the default duty mix", () => {
    const bev = powertrain("BEV");
    expect(queueMinutes(bev, ASSUMPTIONS.dutyMix.cityShare.value)).toBeCloseTo(bev.queueMinPerDay, 6);
    expect(queueMinutes(bev, 1)).toBeCloseTo(bev.queueMinCityOnly, 6);
  });
  it("CO₂: BEV tailpipe zero, Bio-CNG WTW far below CNG, CNG TTW ≈ 2.75 kg/kg ÷ km/kg", () => {
    const cng = powertrain("CNG");
    expect(co2PerKm(powertrain("BEV"), inp, 0.55).ttw).toBe(0);
    expect(co2PerKm(powertrain("BIOCNG"), inp, 0.55).wtw).toBeLessThan(co2PerKm(cng, inp, 0.55).wtw * 0.3);
    expect(co2PerKm(cng, inp, 0.55).ttw).toBeCloseTo((2.75 / cng.kmPerFuel) * 1000, 6);
  });
  it("cleaner grid lowers EV WTW CO₂", () => {
    const e = powertrain("EREV");
    expect(co2PerKm(e, inp, 0.3).wtw).toBeLessThan(co2PerKm(e, inp, 0.7).wtw);
  });
});

describe("body style scoring", () => {
  it("6+1 compact MPV wins on default weights", () => {
    const w = Object.fromEntries(ASSUMPTIONS.bodyStyles.criteria.map((c) => [c.id, c.weight])) as Record<BodyCriterion, number>;
    expect(scoreBodyStyles(w)[0].id).toBe("mpv");
  });
  it("sedan wins if only upfront cost and efficiency matter", () => {
    const w = { capacity: 0, luggage: 0, efficiency: 1, city: 0, comfort: 0, cost: 1 };
    expect(scoreBodyStyles(w)[0].id).toBe("sedan");
  });
});

describe("2035 market sizing", () => {
  const m = computeMarket(defaultMarketInputs());
  it("segment revenue shares sum to 1", () => {
    expect(ASSUMPTIONS.market.segments.reduce((s, x) => s + x.revenueShare, 0)).toBeCloseTo(1, 6);
  });
  it("segment revenues sum to the ride-hailing pool", () => {
    expect(m.segments.reduce((s, x) => s + x.revenueCr, 0)).toBeCloseTo(m.rideHailing2035Cr, 3);
  });
  it("volume pools carry most paid km; yield pools carry an outsized share of margin", () => {
    expect(m.volumeShareOfKm).toBeGreaterThan(0.6);
    const yieldRevShare = m.segments.filter((s) => s.pool === "yield").reduce((s, x) => s + x.revenueCr, 0) / m.rideHailing2035Cr;
    expect(m.yieldShareOfMargin).toBeGreaterThan(yieldRevShare);
  });
  it("airport and intercity are yield pools; intra-city is a volume pool", () => {
    const pool = (id: string) => m.segments.find((s) => s.id === id)?.pool;
    expect(pool("airport")).toBe("yield");
    expect(pool("intercity")).toBe("yield");
    expect(pool("intracity")).toBe("volume");
  });
  it("higher CAGR → bigger market", () => {
    expect(computeMarket({ ...defaultMarketInputs(), cagr2: 0.15 }).rideHailing2035Cr).toBeGreaterThan(m.rideHailing2035Cr);
  });
});
