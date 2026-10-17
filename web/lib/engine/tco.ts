import { ASSUMPTIONS, type AssumptionsFile, type PowertrainId, type PowertrainSpec } from "./assumptions";

/** Global (powertrain-independent) inputs of the TCO + earnings model. */
export interface TcoInputs {
  years: number;
  kmPerDay: number;
  scheduledDays: number;
  productiveKmPerHour: number;
  paidShareBaseline: number;
  paidShareVantage: number;
  farePerPaidKm: number;
  platformCommission: number;
  driverShareOfNet: number;
  driverShifts: number;
  downtimeCostPerDay: number;
  cngPrice: number;
  bioCngPrice: number;
  petrolPrice: number;
  depotTariff: number;
  publicDcTariff: number;
  chargingEfficiency: number;
  kWhPerKm: number;
  subsidy: number;
  downPaymentPct: number;
  loanRate: number;
  loanTenureYears: number;
  batteryPackCostPerKWh: number;
  lfpCycleLife: number;
  usableShare: number;
}

export function defaultInputs(a: AssumptionsFile = ASSUMPTIONS): TcoInputs {
  return {
    years: a.meta.tcoYears,
    kmPerDay: a.duty.kmPerDay.value,
    scheduledDays: a.duty.scheduledDays.value,
    productiveKmPerHour: a.duty.productiveKmPerHour.value,
    paidShareBaseline: a.duty.paidShareBaseline.value,
    paidShareVantage: a.duty.paidShareVantage.value,
    farePerPaidKm: a.revenue.farePerPaidKm.value,
    platformCommission: a.revenue.platformCommission.value,
    driverShareOfNet: a.revenue.driverShareOfNet.value,
    driverShifts: 1,
    downtimeCostPerDay: a.revenue.downtimeCostPerDay.value,
    cngPrice: a.energy.cngPrice.value,
    bioCngPrice: a.energy.bioCngPrice.value,
    petrolPrice: a.energy.petrolPrice.value,
    depotTariff: a.energy.depotTariff.value,
    publicDcTariff: a.energy.publicDcTariff.value,
    chargingEfficiency: a.energy.chargingEfficiency.value,
    kWhPerKm: a.vehicle.kWhPerKm.value,
    subsidy: 0,
    // Round-1 basis: cash purchase (no financing). Users can switch financing on in /tco.
    downPaymentPct: 1,
    loanRate: 0.1,
    loanTenureYears: 5,
    batteryPackCostPerKWh: 6000,
    lfpCycleLife: a.vehicle.lfpCycleLife.value,
    usableShare: a.vehicle.usableShare.value,
  };
}

export interface TcoBreakdown {
  purchaseNet: number; // price − subsidy − residual
  financing: number;
  energy: number;
  maintenance: number;
  insurance: number;
  battery: number;
  downtime: number;
}

export interface TcoResult {
  id: PowertrainId;
  label: string;
  vantage: boolean;
  dailyKm: number;
  operatingDays: number;
  annualKm: number;
  totalKm: number;
  paidShare: number;
  annualPaidKm: number;
  energyPerKm: number;
  residual: number;
  breakdown: TcoBreakdown;
  total: number;
  costPerKm: number;
  costPerPaidKm: number;
  /** Per year, per vehicle. */
  netRevenue: number;
  driverPay: number;
  operatorProfit: number;
  /** Per driver. */
  driverAnnual: number;
  driverMonthly: number;
  batteryCycles: number;
}

/** Monthly EMI for a loan (standard amortisation). */
export function emi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Interest paid within the TCO horizon. */
export function financingCost(price: number, inp: TcoInputs): number {
  const loan = price * (1 - inp.downPaymentPct);
  if (loan <= 0) return 0;
  const months = Math.round(inp.loanTenureYears * 12);
  const pay = emi(loan, inp.loanRate, months);
  const paidMonths = Math.min(months, Math.round(inp.years * 12));
  // Interest = payments made − principal repaid within horizon.
  let balance = loan;
  let interest = 0;
  const r = inp.loanRate / 12;
  for (let m = 0; m < paidMonths; m++) {
    const i = balance * r;
    interest += i;
    balance -= pay - i;
  }
  return interest;
}

export function fuelPrice(pt: PowertrainSpec, inp: TcoInputs): number {
  switch (pt.fuel) {
    case "cng":
      return inp.cngPrice;
    case "biocng":
      return inp.bioCngPrice;
    case "petrol":
      return inp.petrolPrice;
    default:
      return 0;
  }
}

/** Blended grid tariff seen by this powertrain (₹/kWh at the meter). */
export function blendedTariff(pt: PowertrainSpec, inp: TcoInputs): number {
  return pt.depotShare * inp.depotTariff + (1 - pt.depotShare) * inp.publicDcTariff;
}

/** ₹ per km of energy, blending electric and fuel km. */
export function energyCostPerKm(pt: PowertrainSpec, inp: TcoInputs): number {
  const ev = pt.evShare > 0 ? (inp.kWhPerKm / inp.chargingEfficiency) * blendedTariff(pt, inp) : 0;
  const fuel = pt.evShare < 1 && pt.kmPerFuel > 0 ? fuelPrice(pt, inp) / pt.kmPerFuel : 0;
  return pt.evShare * ev + (1 - pt.evShare) * fuel;
}

export function computeTco(pt: PowertrainSpec, inp: TcoInputs, vantage: boolean): TcoResult {
  const dailyKm = Math.max(0, inp.kmPerDay - (pt.queueMinPerDay / 60) * inp.productiveKmPerHour);
  const operatingDays = Math.max(0, inp.scheduledDays - pt.downtimeDays);
  const annualKm = dailyKm * operatingDays;
  const totalKm = annualKm * inp.years;
  const energyPerKm = energyCostPerKm(pt, inp);

  const residual = pt.price * pt.residualPct;
  // Battery: replace only if cycles in the horizon exceed rated cycle life.
  const usableKWh = pt.batteryKWh * inp.usableShare;
  const evKm = totalKm * pt.evShare;
  const batteryCycles = usableKWh > 0 ? (evKm * inp.kWhPerKm) / usableKWh : 0;
  const replacements = usableKWh > 0 ? Math.floor(batteryCycles / inp.lfpCycleLife) : 0;

  const breakdown: TcoBreakdown = {
    purchaseNet: pt.price - inp.subsidy - residual,
    financing: financingCost(pt.price - inp.subsidy, inp),
    energy: totalKm * energyPerKm,
    maintenance: totalKm * pt.maintPerKm,
    insurance: pt.insurancePerYear * inp.years,
    battery: replacements * pt.batteryKWh * inp.batteryPackCostPerKWh,
    downtime: pt.downtimeDays * inp.downtimeCostPerDay * inp.years,
  };
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  const paidShare = vantage ? inp.paidShareVantage : inp.paidShareBaseline;
  const annualPaidKm = annualKm * paidShare;
  const netRevenue = annualPaidKm * inp.farePerPaidKm * (1 - inp.platformCommission);
  const driverPay = netRevenue * inp.driverShareOfNet;
  const operatorProfit = netRevenue - driverPay - total / inp.years;
  const driverAnnual = driverPay / Math.max(1, inp.driverShifts);

  return {
    id: pt.id,
    label: pt.label,
    vantage,
    dailyKm,
    operatingDays,
    annualKm,
    totalKm,
    paidShare,
    annualPaidKm,
    energyPerKm,
    residual,
    breakdown,
    total,
    costPerKm: totalKm > 0 ? total / totalKm : 0,
    costPerPaidKm: totalKm > 0 ? total / (totalKm * paidShare) : 0,
    netRevenue,
    driverPay,
    operatorProfit,
    driverAnnual,
    driverMonthly: driverAnnual / 12,
    batteryCycles,
  };
}

export type VantageMode = "sarathi-only" | "all" | "none";

export function vantageFor(id: PowertrainId, mode: VantageMode): boolean {
  if (mode === "all") return true;
  if (mode === "none") return false;
  return id === "EREV";
}

export function computeAll(
  pts: PowertrainSpec[],
  inp: TcoInputs,
  mode: VantageMode = "sarathi-only",
): TcoResult[] {
  return pts.map((p) => computeTco(p, inp, vantageFor(p.id, mode)));
}

export interface Comparison {
  baseline: TcoResult;
  candidate: TcoResult;
  tcoSaving: number;
  tcoSavingPct: number;
  annualOperatorSaving: number; // TCO saving per year (cost view)
  operatorProfitDelta: number; // per year incl. revenue uplift
  driverAnnualDelta: number;
  paidKmDelta: number;
  upfrontPremium: number;
  paybackYears: number; // upfront premium / annual operating cash advantage
}

export function compare(baseline: TcoResult, candidate: TcoResult, basePt: PowertrainSpec, candPt: PowertrainSpec): Comparison {
  const tcoSaving = baseline.total - candidate.total;
  const upfrontPremium = candPt.price - basePt.price;
  const years = baseline.totalKm > 0 ? baseline.totalKm / baseline.annualKm : 1;
  // Annual operating cash advantage = profit delta excluding the purchase/residual and financing components.
  const opCash = (r: TcoResult) => r.netRevenue - r.driverPay - (r.total - r.breakdown.purchaseNet - r.breakdown.financing) / years;
  const cashDelta = opCash(candidate) - opCash(baseline);
  return {
    baseline,
    candidate,
    tcoSaving,
    tcoSavingPct: baseline.total > 0 ? tcoSaving / baseline.total : 0,
    annualOperatorSaving: tcoSaving / years,
    operatorProfitDelta: candidate.operatorProfit - baseline.operatorProfit,
    driverAnnualDelta: candidate.driverAnnual - baseline.driverAnnual,
    paidKmDelta: candidate.annualPaidKm - baseline.annualPaidKm,
    upfrontPremium,
    paybackYears: upfrontPremium <= 0 ? 0 : cashDelta > 0 ? upfrontPremium / cashDelta : Infinity,
  };
}

/**
 * Blended electricity tariff (₹/kWh) at which the candidate's TCO equals the baseline's.
 * TCO is linear in tariff, so solve directly.
 */
export function breakEvenTariff(candPt: PowertrainSpec, basePt: PowertrainSpec, inp: TcoInputs): number | null {
  const baseTotal = computeTco(basePt, inp, false).total;
  const at = (t: number) => computeTco(candPt, { ...inp, depotTariff: t, publicDcTariff: t }, true).total;
  const t0 = at(0);
  const t1 = at(10);
  const slope = (t1 - t0) / 10;
  if (slope <= 0) return null;
  return (baseTotal - t0) / slope;
}

export interface TornadoBar {
  key: string;
  label: string;
  low: number; // saving when input −20%
  high: number; // saving when input +20%
}

type Tweak = { key: string; label: string; apply: (inp: TcoInputs, cand: PowertrainSpec, f: number) => [TcoInputs, PowertrainSpec] };

const TWEAKS: Tweak[] = [
  { key: "kmPerDay", label: "km per day", apply: (i, c, f) => [{ ...i, kmPerDay: i.kmPerDay * f }, c] },
  { key: "cngPrice", label: "CNG ₹/kg", apply: (i, c, f) => [{ ...i, cngPrice: i.cngPrice * f }, c] },
  { key: "depotTariff", label: "Depot ₹/kWh", apply: (i, c, f) => [{ ...i, depotTariff: i.depotTariff * f }, c] },
  { key: "publicDcTariff", label: "Public DC ₹/kWh", apply: (i, c, f) => [{ ...i, publicDcTariff: i.publicDcTariff * f }, c] },
  { key: "price", label: "SARATHI price", apply: (i, c, f) => [i, { ...c, price: c.price * f }] },
  { key: "evShare", label: "EV share of km", apply: (i, c, f) => [i, { ...c, evShare: Math.min(1, c.evShare * f) }] },
  { key: "residual", label: "SARATHI residual %", apply: (i, c, f) => [i, { ...c, residualPct: c.residualPct * f }] },
  { key: "maint", label: "SARATHI maint ₹/km", apply: (i, c, f) => [i, { ...c, maintPerKm: c.maintPerKm * f }] },
];

/** ±20% one-at-a-time sensitivity of the 5-year TCO saving (baseline − candidate). */
export function tornado(basePt: PowertrainSpec, candPt: PowertrainSpec, inp: TcoInputs, delta = 0.2): TornadoBar[] {
  const saving = (i: TcoInputs, c: PowertrainSpec) => computeTco(basePt, i, false).total - computeTco(c, i, true).total;
  return TWEAKS.map((t) => {
    const [il, cl] = t.apply(inp, candPt, 1 - delta);
    const [ih, ch] = t.apply(inp, candPt, 1 + delta);
    return { key: t.key, label: t.label, low: saving(il, cl), high: saving(ih, ch) };
  }).sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
}

export const lakh = (v: number) => v / 1e5;
