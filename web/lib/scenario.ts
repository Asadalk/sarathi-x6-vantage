import { ASSUMPTIONS, type PowertrainId, type PowertrainSpec } from "./engine/assumptions";
import { defaultInputs, type TcoInputs, type VantageMode } from "./engine/tco";

export type Specs = Record<PowertrainId, PowertrainSpec>;

export interface Scenario {
  inputs: TcoInputs;
  specs: Specs;
  vantage: VantageMode;
}

export function defaultSpecs(): Specs {
  return Object.fromEntries(ASSUMPTIONS.powertrains.map((p) => [p.id, { ...p }])) as Specs;
}

export function defaultScenario(): Scenario {
  return { inputs: defaultInputs(), specs: defaultSpecs(), vantage: "sarathi-only" };
}

/** Conservative preset: pricier charging, cheaper CNG, lower EV share and residual for SARATHI. */
export function conservativeScenario(): Scenario {
  const c = ASSUMPTIONS.presets.conservative;
  const s = defaultScenario();
  s.inputs = { ...s.inputs, publicDcTariff: c.publicDcTariff, depotTariff: c.depotTariff, cngPrice: c.cngPrice };
  s.specs.EREV = { ...s.specs.EREV, evShare: c.evShareEREV, residualPct: c.residualEREV };
  return s;
}

/** Financed preset: Round-1 economics with 20 % down payment at 10 % for 5 years. */
export function financedScenario(): Scenario {
  const s = defaultScenario();
  s.inputs = { ...s.inputs, downPaymentPct: 0.2, loanRate: 0.1, loanTenureYears: 5 };
  return s;
}

const SPEC_KEYS: (keyof PowertrainSpec)[] = ["price", "residualPct", "evShare", "kmPerFuel", "maintPerKm", "insurancePerYear", "downtimeDays", "queueMinPerDay", "depotShare"];

/** Encode only values that differ from the defaults, so shared URLs stay short. */
export function encodeScenario(s: Scenario): string {
  const d = defaultScenario();
  const q = new URLSearchParams();
  for (const k of Object.keys(s.inputs) as (keyof TcoInputs)[]) {
    if (s.inputs[k] !== d.inputs[k]) q.set(k, String(+s.inputs[k].toFixed(4)));
  }
  for (const id of Object.keys(s.specs) as PowertrainId[]) {
    for (const k of SPEC_KEYS) {
      const v = s.specs[id][k];
      if (typeof v === "number" && v !== d.specs[id][k]) q.set(`${id}.${k}`, String(+v.toFixed(4)));
    }
  }
  if (s.vantage !== d.vantage) q.set("vantage", s.vantage);
  return q.toString();
}

export function decodeScenario(qs: string): Scenario {
  const s = defaultScenario();
  const q = new URLSearchParams(qs);
  q.forEach((raw, key) => {
    if (key === "vantage") {
      if (raw === "all" || raw === "none" || raw === "sarathi-only") s.vantage = raw;
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    if (key.includes(".")) {
      const [id, k] = key.split(".") as [PowertrainId, keyof PowertrainSpec];
      if (s.specs[id] && SPEC_KEYS.includes(k)) (s.specs[id] as unknown as Record<string, number>)[k] = v;
    } else if (key in s.inputs) {
      (s.inputs as unknown as Record<string, number>)[key] = v;
    }
  });
  return s;
}
