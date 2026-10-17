import { ASSUMPTIONS, type AssumptionsFile } from "./assumptions";

export interface MarketInputs {
  cagr1: number; // 2026→2031
  cagr2: number; // 2031→2035
  rideHailingShare2035: number;
  fareMultiplier: number; // scales ₹/km yields (and therefore lowers km for a fixed ₹ pool)
}

export function defaultMarketInputs(a: AssumptionsFile = ASSUMPTIONS): MarketInputs {
  return {
    cagr1: a.market.cagr2026to2031.value,
    cagr2: a.market.cagr2031to2035.value,
    rideHailingShare2035: a.market.rideHailingShare2035.value,
    fareMultiplier: 1,
  };
}

export interface SegmentResult {
  id: string;
  label: string;
  revenueCr: number; // ₹ crore / yr
  paidKmBn: number; // billion paid km / yr
  tripsPerDayLakh: number;
  avgTripKm: number;
  farePerKm: number;
  marginPct: number;
  marginCr: number;
  pool: "volume" | "yield";
}

export interface MarketResult {
  taxiMarket2035UsdBn: number;
  rideHailing2035Cr: number;
  segments: SegmentResult[];
  volumeShareOfKm: number; // share of paid km in volume pools
  yieldShareOfMargin: number; // share of margin ₹ in yield pools
}

export function computeMarket(inp: MarketInputs, a: AssumptionsFile = ASSUMPTIONS): MarketResult {
  const m = a.market;
  const usd2035 = m.taxiMarket2026UsdBn.value * Math.pow(1 + inp.cagr1, 5) * Math.pow(1 + inp.cagr2, 4);
  const rhCr = (usd2035 * 1e9 * m.usdInr.value * inp.rideHailingShare2035) / 1e7;
  const avgMargin = m.segments.reduce((s, x) => s + x.marginPct * x.revenueShare, 0);
  const segments: SegmentResult[] = m.segments.map((s) => {
    const revenueCr = rhCr * s.revenueShare;
    const fare = s.farePerKm * inp.fareMultiplier;
    const paidKm = (revenueCr * 1e7) / fare;
    return {
      id: s.id,
      label: s.label,
      revenueCr,
      paidKmBn: paidKm / 1e9,
      tripsPerDayLakh: paidKm / s.avgTripKm / 365 / 1e5,
      avgTripKm: s.avgTripKm,
      farePerKm: fare,
      marginPct: s.marginPct,
      marginCr: revenueCr * s.marginPct,
      pool: s.marginPct >= avgMargin ? "yield" : "volume",
    };
  });
  const totKm = segments.reduce((s, x) => s + x.paidKmBn, 0);
  const totMargin = segments.reduce((s, x) => s + x.marginCr, 0);
  return {
    taxiMarket2035UsdBn: usd2035,
    rideHailing2035Cr: rhCr,
    segments,
    volumeShareOfKm: segments.filter((x) => x.pool === "volume").reduce((s, x) => s + x.paidKmBn, 0) / totKm,
    yieldShareOfMargin: segments.filter((x) => x.pool === "yield").reduce((s, x) => s + x.marginCr, 0) / totMargin,
  };
}
