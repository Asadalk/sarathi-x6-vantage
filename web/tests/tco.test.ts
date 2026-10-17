import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, powertrain } from "@/lib/engine/assumptions";
import {
  breakEvenTariff,
  compare,
  computeAll,
  computeTco,
  defaultInputs,
  emi,
  energyCostPerKm,
  financingCost,
  lakh,
  tornado,
} from "@/lib/engine/tco";

const inp = defaultInputs();
const cng = powertrain("CNG");
const erev = powertrain("EREV");
const base = computeTco(cng, inp, false);
const cand = computeTco(erev, inp, true);
const cmp = compare(base, cand, cng, erev);

describe("Round-1 headline reproduction (default assumptions)", () => {
  it("CNG baseline 5-year TCO ≈ ₹26.9 L", () => expect(lakh(base.total)).toBeCloseTo(26.9, 1));
  it("SARATHI-X6 5-year TCO ≈ ₹18.2 L", () => expect(lakh(cand.total)).toBeCloseTo(18.2, 1));
  it("saving is ₹8.7 L (not 8.8) and ≈32 %", () => {
    expect(lakh(cmp.tcoSaving)).toBeCloseTo(8.7, 1);
    expect(Math.round(cmp.tcoSavingPct * 100)).toBe(32);
  });
  it("operator saving ≈ ₹1.74–1.75 L / year", () => {
    expect(lakh(cmp.annualOperatorSaving)).toBeGreaterThan(1.7);
    expect(lakh(cmp.annualOperatorSaving)).toBeLessThan(1.76);
  });
  it("driver earnings +≈₹0.98 L / year from ≈ +7,000 paid km", () => {
    expect(lakh(cmp.driverAnnualDelta)).toBeCloseTo(0.98, 1);
    expect(cmp.paidKmDelta).toBeGreaterThan(6500);
    expect(cmp.paidKmDelta).toBeLessThan(7500);
  });
  it("paid share 65 % → 72 %", () => {
    expect(base.paidShare).toBe(0.65);
    expect(cand.paidShare).toBe(0.72);
  });
});

describe("TCO accounting invariants", () => {
  it("components sum to total for every powertrain", () => {
    for (const r of computeAll(ASSUMPTIONS.powertrains, inp)) {
      const sum = Object.values(r.breakdown).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(r.total, 6);
    }
  });
  it("residual value is subtracted, not added", () => {
    expect(base.breakdown.purchaseNet).toBeCloseTo(cng.price - cng.price * cng.residualPct, 6);
    const higherResidual = computeTco({ ...cng, residualPct: cng.residualPct + 0.1 }, inp, false);
    expect(higherResidual.total).toBeLessThan(base.total);
  });
  it("subsidy reduces TCO one-for-one (cash purchase)", () => {
    const s = computeTco(erev, { ...inp, subsidy: 100000 }, true);
    expect(cand.total - s.total).toBeCloseTo(100000, 6);
  });
  it("more queue minutes → fewer km and fewer paid km", () => {
    const slow = computeTco({ ...erev, queueMinPerDay: erev.queueMinPerDay + 30 }, inp, true);
    expect(slow.annualKm).toBeLessThan(cand.annualKm);
    expect(slow.annualPaidKm).toBeLessThan(cand.annualPaidKm);
  });
  it("operator profit = net revenue − driver pay − annual TCO", () => {
    expect(cand.operatorProfit).toBeCloseTo(cand.netRevenue - cand.driverPay - cand.total / inp.years, 6);
  });
  it("driver shifts split driver pay", () => {
    const two = computeTco(erev, { ...inp, driverShifts: 2 }, true);
    expect(two.driverAnnual).toBeCloseTo(cand.driverAnnual / 2, 6);
  });
});

describe("energy, financing and helpers", () => {
  it("BEV energy ₹/km < EREV < CNG", () => {
    expect(energyCostPerKm(powertrain("BEV"), inp)).toBeLessThan(energyCostPerKm(erev, inp));
    expect(energyCostPerKm(erev, inp)).toBeLessThan(energyCostPerKm(cng, inp));
  });
  it("EMI matches the closed form", () => {
    expect(emi(1000000, 0.12, 60)).toBeCloseTo(22244.45, 1);
    expect(emi(1200, 0, 12)).toBe(100);
  });
  it("financing cost is zero for cash purchase and positive with a loan", () => {
    expect(financingCost(1000000, inp)).toBe(0);
    const f = financingCost(1000000, { ...inp, downPaymentPct: 0.2, loanRate: 0.1, loanTenureYears: 5 });
    expect(f).toBeGreaterThan(200000);
    expect(f).toBeLessThan(250000);
  });
  it("break-even tariff makes TCO equal", () => {
    const t = breakEvenTariff(erev, cng, inp);
    expect(t).not.toBeNull();
    const at = computeTco(erev, { ...inp, depotTariff: t as number, publicDcTariff: t as number }, true);
    expect(at.total).toBeCloseTo(base.total, 0);
  });
  it("tornado is sorted by swing and brackets the base saving", () => {
    const bars = tornado(cng, erev, inp);
    const swings = bars.map((b) => Math.abs(b.high - b.low));
    expect([...swings].sort((a, b) => b - a)).toEqual(swings);
    for (const b of bars) {
      expect(Math.min(b.low, b.high)).toBeLessThanOrEqual(cmp.tcoSaving + 1);
      expect(Math.max(b.low, b.high)).toBeGreaterThanOrEqual(cmp.tcoSaving - 1);
    }
  });
  it("no battery replacement within 5 years for the 24 kWh LFP pack", () => {
    expect(cand.batteryCycles).toBeLessThan(inp.lfpCycleLife);
    expect(cand.breakdown.battery).toBe(0);
  });
});
