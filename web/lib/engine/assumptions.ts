import raw from "@/public/data/assumptions.json";

/** One documented scalar assumption from model/assumptions.yaml. */
export interface Assumption {
  value: number;
  unit: string;
  src?: string[];
  why?: string;
  usedIn?: string[];
}

export type FuelType = "cng" | "biocng" | "petrol" | "none";
export type PowertrainId = "CNG" | "BIOCNG" | "HEV" | "PHEV" | "BEV" | "EREV";

export interface PowertrainSpec {
  id: PowertrainId;
  label: string;
  price: number;
  residualPct: number;
  evShare: number;
  fuel: FuelType;
  kmPerFuel: number;
  batteryKWh: number;
  maintPerKm: number;
  insurancePerYear: number;
  downtimeDays: number;
  queueMinPerDay: number;
  depotShare: number;
  rangeKm: number;
  refuelMinutes: number;
  infraCity: number;
  infraHighway: number;
  why: string;
}

export interface MarketSegmentSpec {
  id: string;
  label: string;
  revenueShare: number;
  avgTripKm: number;
  farePerKm: number;
  marginPct: number;
  why: string;
}

export interface AssumptionsFile {
  meta: { version: string; currency: string; horizonYear: number; tcoYears: number };
  duty: Record<"kmPerDay" | "scheduledDays" | "productiveKmPerHour" | "paidShareBaseline" | "paidShareVantage", Assumption>;
  revenue: Record<"farePerPaidKm" | "platformCommission" | "driverShareOfNet" | "downtimeCostPerDay", Assumption>;
  energy: Record<
    | "cngPrice"
    | "bioCngPrice"
    | "petrolPrice"
    | "depotTariff"
    | "publicDcTariff"
    | "chargingEfficiency"
    | "gridFactor2035"
    | "cngCo2PerKg"
    | "petrolCo2PerL"
    | "upstreamFossil"
    | "bioCngNetFactor",
    Assumption
  >;
  vehicle: Record<
    | "batteryKWh"
    | "usableShare"
    | "motorKw"
    | "dcChargerKw"
    | "maxCRate"
    | "dcAvgEfficiencyKw"
    | "cngTankKg"
    | "rangeExtenderKmPerKg"
    | "kWhPerKm"
    | "luggageL"
    | "luggageFoldedL"
    | "designLifeYears"
    | "lfpCycleLife"
    | "lfpPackPrice2025",
    Assumption
  >;
  powertrains: PowertrainSpec[];
  scoringWeights: Record<"costPerKm" | "uptime" | "infra" | "co2" | "upfront", number>;
  dutyMix: { cityShare: Assumption };
  market: {
    taxiMarket2026UsdBn: Assumption;
    cagr2026to2031: Assumption;
    cagr2031to2035: Assumption;
    rideHailingShare: Assumption;
    rideHailingShare2035: Assumption;
    usdInr: Assumption;
    segments: MarketSegmentSpec[];
  };
  presets: {
    conservative: {
      publicDcTariff: number;
      depotTariff: number;
      cngPrice: number;
      evShareEREV: number;
      residualEREV: number;
    };
  };
}

export const ASSUMPTIONS = raw as unknown as AssumptionsFile;

export function powertrain(id: PowertrainId, a: AssumptionsFile = ASSUMPTIONS): PowertrainSpec {
  const p = a.powertrains.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown powertrain ${id}`);
  return p;
}
