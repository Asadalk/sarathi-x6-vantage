import { describe, expect, it } from "vitest";
import demand from "@/public/data/demand.json";
import { DEFAULT_SIM, explainDecision, generateRequests, rng, runSim, type DemandData } from "@/lib/engine/sim";

const d = demand as unknown as DemandData;
const reqs = generateRequests(d, DEFAULT_SIM);
const naive = runSim("naive", d, DEFAULT_SIM, reqs);
const vant = runSim("vantage", d, DEFAULT_SIM, reqs);

describe("simulator determinism", () => {
  it("PRNG is seeded and reproducible", () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("same seed → identical results", () => {
    const again = runSim("vantage", d, DEFAULT_SIM);
    expect(again.metrics).toEqual(vant.metrics);
  });
  it("both policies see the identical request stream", () => {
    expect(naive.metrics.requests).toBe(vant.metrics.requests);
  });
});

describe("simulator accounting invariants", () => {
  for (const res of [naive, vant]) {
    const m = res.metrics;
    it(`${res.policy}: paid + dead + charging-detour km = total km`, () => {
      expect(m.paidKm + m.deadKm + m.chargeKm).toBeCloseTo(m.totalKm, 6);
    });
    it(`${res.policy}: served + unmet ≤ requests`, () => {
      expect(m.tripsServed + m.unmet).toBeLessThanOrEqual(m.requests);
    });
    it(`${res.policy}: revenue = paid km × fare`, () => {
      expect(m.revenue).toBeCloseTo(m.paidKm * DEFAULT_SIM.farePerKm, 3);
    });
    it(`${res.policy}: one frame per tick`, () => {
      expect(res.frames.length).toBe(DEFAULT_SIM.ticks);
      expect(res.frames[0].v.length).toBe(DEFAULT_SIM.vehicles * 4);
    });
  }
});

describe("Round-1 paid-km claim (65 % → 72 %)", () => {
  it("default seed lands near 65 % (naive) and 72 % (VANTAGE) within ±3 pts", () => {
    expect(Math.abs(naive.metrics.paidShare - 0.65)).toBeLessThan(0.03);
    expect(Math.abs(vant.metrics.paidShare - 0.72)).toBeLessThan(0.03);
  });
  it("VANTAGE also serves more trips, cuts unmet demand and peak charging, and earns more per vehicle-hour", () => {
    expect(vant.metrics.tripsServed).toBeGreaterThan(naive.metrics.tripsServed);
    expect(vant.metrics.unmet).toBeLessThan(naive.metrics.unmet);
    expect(vant.metrics.chargingMinPeak).toBeLessThan(naive.metrics.chargingMinPeak * 0.5);
    expect(vant.metrics.netPerVehicleHour).toBeGreaterThan(naive.metrics.netPerVehicleHour);
  });
  it("uplift is robust: VANTAGE ≥ +5 pts paid share in each of 10 seeds", () => {
    for (let seed = 2031; seed <= 2040; seed++) {
      const cfg = { ...DEFAULT_SIM, seed };
      const r = generateRequests(d, cfg);
      const n = runSim("naive", d, cfg, r, false).metrics.paidShare;
      const v = runSim("vantage", d, cfg, r, false).metrics.paidShare;
      expect(v - n).toBeGreaterThan(0.05);
    }
  });
});

describe("decision cards", () => {
  it("VANTAGE records 'don't charge now' deferrals with facts", () => {
    const no = vant.decisions.filter((x) => x.answer === "NO");
    expect(no.length).toBeGreaterThan(0);
    expect(no[0].facts.cngKg).toBeGreaterThan(0);
  });
  it("template explanations only use numbers present in the facts", () => {
    for (const dec of vant.decisions.slice(0, 40).concat(naive.decisions.slice(0, 10))) {
      const text = explainDecision(dec);
      const factNums = new Set(
        Object.values(dec.facts)
          .filter((v): v is number => typeof v === "number")
          .map((v) => String(v)),
      );
      const nums = text.match(/\d+(\.\d+)?/g) ?? [];
      for (const n of nums) {
        // hours are printed as HH:00
        if (n === "00" || n === "6" || n === "30" || n === "100") continue;
        expect(factNums.has(n) || factNums.has(String(Number(n)))).toBe(true);
      }
    }
  });
});
