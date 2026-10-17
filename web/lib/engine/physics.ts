import { ASSUMPTIONS, type AssumptionsFile } from "./assumptions";

/** Derived vehicle-level checks used by /vehicle and the sanity-check unit tests. */
export interface PhysicsCheck {
  usableKWh: number;
  evRangeKm: number;
  rangeExtenderKm: number;
  combinedRangeKm: number;
  dcEnergyKWh: number; // 10→80 %
  dcAvgPowerKw: number; // for a 20-minute session
  dcAvgCRate: number;
  dcPeakAllowedKw: number; // min(charger, pack C-rate)
  dcMinutesAtLimit: number; // minutes if held at the allowed peak
  evKmPerDay: number; // urban EV km needed per day
  chargesPerDay: number; // full-usable-window equivalents per day
  dcStopsPerShift: number; // DC top-ups needed beyond the overnight depot charge
}

export function physics(a: AssumptionsFile = ASSUMPTIONS, evShare = 0.7, kmPerDay = a.duty.kmPerDay.value): PhysicsCheck {
  const v = a.vehicle;
  const usableKWh = v.batteryKWh.value * v.usableShare.value;
  const evRangeKm = usableKWh / v.kWhPerKm.value;
  const rangeExtenderKm = v.cngTankKg.value * v.rangeExtenderKmPerKg.value;
  const dcEnergyKWh = v.batteryKWh.value * 0.7;
  const dcAvgPowerKw = dcEnergyKWh / (20 / 60);
  const dcPeakAllowedKw = Math.min(v.dcChargerKw.value, v.maxCRate.value * v.batteryKWh.value);
  const evKmPerDay = kmPerDay * evShare;
  const chargesPerDay = (evKmPerDay * v.kWhPerKm.value) / usableKWh;
  return {
    usableKWh,
    evRangeKm,
    rangeExtenderKm,
    combinedRangeKm: evRangeKm + rangeExtenderKm,
    dcEnergyKWh,
    dcAvgPowerKw,
    dcAvgCRate: dcAvgPowerKw / v.batteryKWh.value,
    dcPeakAllowedKw,
    dcMinutesAtLimit: (dcEnergyKWh / dcPeakAllowedKw) * 60,
    evKmPerDay,
    chargesPerDay,
    dcStopsPerShift: Math.max(0, Math.ceil(chargesPerDay - 1)),
  };
}
