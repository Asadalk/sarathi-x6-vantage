import { describe, expect, it } from "vitest";
import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { physics } from "@/lib/engine/physics";

const p = physics();
const v = ASSUMPTIONS.vehicle;

describe("physics sanity checks (Round-1 specs)", () => {
  it("60 kW DC: 10→80 % of 24 kWh (16.8 kWh) in 20 min needs ~50 kW average", () => {
    expect(p.dcEnergyKWh).toBeCloseTo(16.8, 6);
    expect(p.dcAvgPowerKw).toBeCloseTo(50.4, 1);
  });
  it("average DC power ≤ charger rating and ≤ assumed pack C-rate limit", () => {
    expect(p.dcAvgPowerKw).toBeLessThanOrEqual(v.dcChargerKw.value);
    expect(p.dcAvgPowerKw).toBeLessThanOrEqual(v.maxCRate.value * v.batteryKWh.value);
    // ~2.1C average: aggressive for LFP, stated explicitly
    expect(p.dcAvgCRate).toBeGreaterThan(2);
    expect(p.dcAvgCRate).toBeLessThanOrEqual(v.maxCRate.value);
    expect(p.dcMinutesAtLimit).toBeLessThanOrEqual(20);
  });
  it("EV-only range = usable kWh ÷ kWh/km and is realistic for a compact MPV", () => {
    expect(p.evRangeKm).toBeCloseTo((24 * 0.9) / 0.13, 6);
    expect(p.evRangeKm).toBeGreaterThan(140);
    expect(p.evRangeKm).toBeLessThan(200);
  });
  it("combined range ≥ 500 km (EV + CNG tank × generator km/kg)", () => {
    expect(p.combinedRangeKm).toBeGreaterThanOrEqual(500);
    expect(p.rangeExtenderKm).toBeCloseTo(v.cngTankKg.value * v.rangeExtenderKmPerKg.value, 6);
  });
  it("70 % EV share at 210 km/day fits one overnight charge + ≤1 DC top-up", () => {
    expect(p.evKmPerDay).toBeCloseTo(147, 0);
    expect(p.chargesPerDay).toBeLessThan(2);
    expect(p.dcStopsPerShift).toBeLessThanOrEqual(1);
  });
  it("kWh/km is plausible (0.10–0.18) for a 6+1 compact MPV", () => {
    expect(v.kWhPerKm.value).toBeGreaterThanOrEqual(0.1);
    expect(v.kWhPerKm.value).toBeLessThanOrEqual(0.18);
  });
});
