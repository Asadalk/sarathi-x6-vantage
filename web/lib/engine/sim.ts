/**
 * VANTAGE live fleet simulator — deterministic, seeded agent simulation.
 *
 * A stylised city (km coordinates), N SARATHI-X6 EREVs, 24 h in 5-min ticks.
 * Both policies see the *same* request stream (sampled once from the ground-truth
 * synthetic demand); only the decision logic differs:
 *
 *  NAIVE   — nearest-vehicle dispatch, charge whenever SOC < 30 % at the nearest hub,
 *            drive back empty after airport/intercity drops, EV until the pack is empty.
 *  VANTAGE — SOC/range-aware dispatch, demand-aware charging (defer in peaks, top up in
 *            troughs at the least-queued hub), airport rank & intercity back-haul matching,
 *            forecast-led repositioning, EV in city / CNG range-extender on highway.
 *
 * Everything here is pure TypeScript and synthetic. No randomness outside the seeded PRNG.
 */

export type Kind = "city" | "airport_out" | "airport_in" | "intercity";
export type Policy = "naive" | "vantage";
export type VState = "idle" | "pickup" | "trip" | "toCharger" | "queue" | "charging" | "reposition" | "returning" | "rank";

export interface ZoneDef {
  x: number;
  y: number;
}

export interface DemandData {
  zones: Record<string, ZoneDef>;
  forecast: Record<string, Partial<Record<Kind, number[]>>>;
  truth: Record<string, Partial<Record<Kind, number[]>>>;
}

export interface SimConfig {
  seed: number;
  vehicles: number;
  demandScale: number;
  ticks: number; // 288 = 24 h
  tickMin: number;
  batteryKWh: number;
  usableShare: number;
  kWhPerKm: number;
  cngTankKg: number;
  reKmPerKg: number;
  chargerKw: number;
  plugsPerHub: number;
  farePerKm: number;
  dcTariff: number;
  nightTariff: number;
  cngPrice: number;
  citySpeed: number; // km/h
  hwySpeed: number; // km/h
  maxWaitTicks: number;
  roadFactor: number;
  intercityKm: number;
  maxPickupKm: number;
  naiveBackhaulProb: number;
  naiveCruiseProb: number;
  vantageBackhaulProb: number;
}

export const DEFAULT_SIM: SimConfig = {
  seed: 2035,
  vehicles: 50,
  demandScale: 2.0,
  ticks: 288,
  tickMin: 5,
  batteryKWh: 24,
  usableShare: 0.9,
  kWhPerKm: 0.13,
  cngTankKg: 16,
  reKmPerKg: 21,
  chargerKw: 50,
  plugsPerHub: 3,
  farePerKm: 36,
  dcTariff: 13,
  nightTariff: 6,
  cngPrice: 85,
  citySpeed: 22,
  hwySpeed: 55,
  maxWaitTicks: 2,
  roadFactor: 1.3,
  intercityKm: 120,
  maxPickupKm: 6,
  naiveBackhaulProb: 0.3,
  naiveCruiseProb: 0.35,
  vantageBackhaulProb: 0.6,
};

export const HUBS: ZoneDef[] = [
  { x: 6.5, y: 9.5 }, // CBD west depot
  { x: 12, y: 5.5 }, // IT park depot
  { x: 5, y: 4 }, // south depot
  { x: 22, y: 9 }, // airport road hub
];

export const PEAK_HOURS = new Set([8, 9, 10, 17, 18, 19, 20]);
const isNight = (h: number) => h >= 23 || h < 5;

/** mulberry32 PRNG — tiny, fast, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(r: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

export interface Request {
  id: number;
  tick: number;
  kind: Kind;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  km: number;
  origin: string;
  dest: string;
}

const CITY_ZONES = ["CBD", "RES_N", "RES_S", "RES_E", "IT_PARK"];

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Sample the full day's request stream from the ground-truth rates (shared by both policies). */
export function generateRequests(d: DemandData, cfg: SimConfig): Request[] {
  const r = rng(cfg.seed);
  const out: Request[] = [];
  const ticksPerHour = 60 / cfg.tickMin;
  const jitter = (v: number, s: number) => v + (r() - 0.5) * 2 * s;
  let id = 0;
  for (let t = 0; t < cfg.ticks; t++) {
    const h = Math.floor(t / ticksPerHour) % 24;
    for (const z of Object.keys(d.truth)) {
      const kinds = d.truth[z];
      for (const k of Object.keys(kinds) as Kind[]) {
        const rate = (kinds[k]?.[h] ?? 0) * cfg.demandScale;
        const n = poisson(r, rate / ticksPerHour);
        for (let i = 0; i < n; i++) {
          const o = d.zones[z];
          const ox = jitter(o.x, z === "AIRPORT" ? 0.3 : 1.8);
          const oy = jitter(o.y, z === "AIRPORT" ? 0.3 : 1.8);
          let dest = "";
          if (k === "city") {
            // Morning flows to work zones, evening flows home.
            const work = h >= 6 && h < 12;
            const pool = work
              ? z.startsWith("RES")
                ? ["CBD", "IT_PARK", "CBD", "IT_PARK", "RES_E", "RES_N"]
                : CITY_ZONES
              : z === "CBD" || z === "IT_PARK"
                ? ["RES_N", "RES_S", "RES_E", "RES_N", "RES_S", "CBD"]
                : CITY_ZONES;
            dest = pool[Math.floor(r() * pool.length)];
            if (dest === z) dest = CITY_ZONES[(CITY_ZONES.indexOf(z) + 1 + Math.floor(r() * 4)) % CITY_ZONES.length];
          } else if (k === "airport_out") dest = "AIRPORT";
          else if (k === "airport_in") dest = CITY_ZONES[Math.floor(r() * CITY_ZONES.length)];
          else dest = "INTERCITY";
          let dx: number;
          let dy: number;
          let km: number;
          if (dest === "INTERCITY") {
            const hx = d.zones.HWY_EXIT;
            dx = hx.x + 6;
            dy = hx.y + 2;
            km = dist(ox, oy, hx.x, hx.y) * cfg.roadFactor + cfg.intercityKm;
          } else {
            const dz = d.zones[dest];
            dx = jitter(dz.x, dest === "AIRPORT" ? 0.3 : 1.8);
            dy = jitter(dz.y, dest === "AIRPORT" ? 0.3 : 1.8);
            km = Math.max(1.5, dist(ox, oy, dx, dy) * cfg.roadFactor);
          }
          out.push({ id: id++, tick: t, kind: k, ox, oy, dx, dy, km, origin: z, dest });
        }
      }
    }
  }
  return out;
}

export interface DecisionFacts {
  socPct: number;
  evRangeKm: number;
  cngKg: number;
  hour: number;
  peak: boolean;
  waitingNearby: number; // open requests within 6 km
  forecastNextHour: number; // forecast requests/h in nearest zone
  bestHubQueue: number;
  bestHubKm: number;
  tariffNow: number;
}

export interface Decision {
  tick: number;
  vehicle: number;
  question: string;
  answer: "YES" | "NO";
  rule: string; // short machine-readable code
  facts: DecisionFacts;
}

export interface TimelineEvent {
  tick: number;
  state: VState;
  note: string;
}

interface Vehicle {
  id: number;
  x: number;
  y: number;
  soc: number; // kWh
  cng: number; // kg
  state: VState;
  tx: number;
  ty: number;
  hwy: boolean; // current leg is highway (airport/intercity)
  req: Request | null;
  legKmLeft: number; // remaining km on the current leg (supports off-map intercity legs)
  hub: number;
  chargeTo: number;
  idleTicks: number;
  rankTicks: number;
  timeline: TimelineEvent[];
}

export interface Metrics {
  totalKm: number;
  paidKm: number;
  deadKm: number; // pickup + reposition + empty return
  chargeKm: number; // detour to/from chargers
  paidShare: number;
  tripsServed: number;
  unmet: number;
  requests: number;
  chargingMinPeak: number;
  chargingMinTotal: number;
  revenue: number;
  energyCost: number;
  kWhCharged: number;
  cngKgUsed: number;
  evKmShare: number;
  urbanEvShare: number; // EV share of non-highway km
  netPerVehicleHour: number; // (revenue − energy) / vehicle-hours
}

export interface Frame {
  // Flat arrays: per vehicle [x, y, stateCode, socPct]
  v: Float32Array;
  waiting: number;
  /** Cumulative to this tick: [paidKm, totalKm, served, unmet, revenue, energyCost, chargingMinPeak, deadKm + chargeKm]. */
  cum: Float64Array;
}

export const CUM = { paidKm: 0, totalKm: 1, served: 2, unmet: 3, revenue: 4, energyCost: 5, chargingMinPeak: 6, nonPaidKm: 7 } as const;

export interface SimResult {
  policy: Policy;
  metrics: Metrics;
  hourly: { hour: number; paidKm: number; deadKm: number; served: number; unmet: number; charging: number }[];
  frames: Frame[];
  decisions: Decision[];
  timelines: TimelineEvent[][];
}

export const STATE_CODES: VState[] = ["idle", "pickup", "trip", "toCharger", "queue", "charging", "reposition", "returning", "rank"];

export function runSim(policy: Policy, demand: DemandData, cfg: SimConfig = DEFAULT_SIM, requests?: Request[], keepFrames = true): SimResult {
  const reqs = requests ?? generateRequests(demand, cfg);
  const r = rng(cfg.seed * 7 + 1);
  const ticksPerHour = 60 / cfg.tickMin;
  const usable = cfg.batteryKWh * cfg.usableShare;
  const minSoc = cfg.batteryKWh * 0.08; // pack floor (≈ 0 % usable displayed)
  const zones = demand.zones;
  const cityKeys = Object.keys(zones).filter((z) => z !== "AIRPORT" && z !== "HWY_EXIT");

  const vehicles: Vehicle[] = [];
  for (let i = 0; i < cfg.vehicles; i++) {
    const z = zones[cityKeys[i % cityKeys.length]];
    vehicles.push({
      id: i,
      x: z.x + (r() - 0.5) * 4,
      y: z.y + (r() - 0.5) * 4,
      soc: minSoc + usable * (0.55 + r() * 0.45),
      cng: cfg.cngTankKg,
      state: "idle",
      tx: 0,
      ty: 0,
      hwy: false,
      req: null,
      legKmLeft: 0,
      hub: -1,
      chargeTo: 0,
      idleTicks: 0,
      rankTicks: 0,
      timeline: [],
    });
  }
  const hubQueue: number[][] = HUBS.map(() => []);
  const hubPlugs: number[] = HUBS.map(() => 0);

  const m: Metrics = {
    totalKm: 0, paidKm: 0, deadKm: 0, chargeKm: 0, paidShare: 0, tripsServed: 0, unmet: 0, requests: reqs.length,
    chargingMinPeak: 0, chargingMinTotal: 0, revenue: 0, energyCost: 0, kWhCharged: 0, cngKgUsed: 0, evKmShare: 0, urbanEvShare: 0, netPerVehicleHour: 0,
  };
  let evKm = 0;
  let cityKm = 0;
  let cityEvKm = 0;
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, paidKm: 0, deadKm: 0, served: 0, unmet: 0, charging: 0 }));
  const frames: Frame[] = [];
  const decisions: Decision[] = [];
  const open: Request[] = [];
  let reqIdx = 0;

  const socPct = (v: Vehicle) => Math.max(0, ((v.soc - minSoc) / usable) * 100);
  const evRange = (v: Vehicle) => Math.max(0, (v.soc - minSoc) / cfg.kWhPerKm);
  const reRange = (v: Vehicle) => v.cng * cfg.reKmPerKg;
  const log = (v: Vehicle, t: number, note: string) => {
    v.timeline.push({ tick: t, state: v.state, note });
    if (v.timeline.length > 80) v.timeline.shift();
  };
  const nearestZone = (x: number, y: number) => {
    let best = cityKeys[0];
    let bd = Infinity;
    for (const z of Object.keys(zones)) {
      const dd = dist(x, y, zones[z].x, zones[z].y);
      if (dd < bd) {
        bd = dd;
        best = z;
      }
    }
    return best;
  };
  const forecastAt = (z: string, h: number) => {
    const f = demand.forecast[z];
    if (!f) return 0;
    return Object.values(f).reduce((s, arr) => s + (arr?.[h % 24] ?? 0), 0) * cfg.demandScale;
  };
  const hubLoad = (i: number) => hubQueue[i].length + hubPlugs[i];
  const tariff = (h: number) => (isNight(h) ? cfg.nightTariff : cfg.dcTariff);

  /** Move vehicle toward target; returns km driven. Handles energy draw (EV vs range-extender). */
  const drive = (v: Vehicle, maxKm: number, useCngIfHwy: boolean): number => {
    const km = Math.min(maxKm, v.legKmLeft);
    if (km <= 0) return 0;
    // Position update along straight line (cosmetic; distance accounting uses legKmLeft).
    const d0 = dist(v.x, v.y, v.tx, v.ty);
    const frac = v.legKmLeft > 0 ? km / v.legKmLeft : 1;
    v.x += (v.tx - v.x) * Math.min(1, frac);
    v.y += (v.ty - v.y) * Math.min(1, frac);
    if (d0 === 0) {
      v.x = v.tx;
      v.y = v.ty;
    }
    v.legKmLeft -= km;
    // Energy: VANTAGE runs the range-extender on highway legs to save SOC for the city.
    // VANTAGE: on highway legs, switch to the range-extender once SOC < 35 % so the pack is saved for city km.
    const wantCng = (useCngIfHwy && v.hwy && socPct(v) < 35) || v.soc - km * cfg.kWhPerKm < minSoc;
    if (wantCng && v.cng > 0) {
      const kg = km / cfg.reKmPerKg;
      v.cng = Math.max(0, v.cng - kg);
      m.cngKgUsed += kg;
      m.energyCost += kg * cfg.cngPrice;
    } else {
      v.soc = Math.max(minSoc, v.soc - km * cfg.kWhPerKm);
      evKm += km;
      if (!v.hwy) cityEvKm += km;
    }
    if (!v.hwy) cityKm += km;
    m.totalKm += km;
    return km;
  };

  const startLeg = (v: Vehicle, tx: number, ty: number, km: number, state: VState, hwy: boolean) => {
    v.tx = tx;
    v.ty = ty;
    v.legKmLeft = km;
    v.state = state;
    v.hwy = hwy;
  };

  const sendToHub = (v: Vehicle, t: number, chooseByQueue: boolean, target: number, note: string) => {
    let best = 0;
    let bestScore = Infinity;
    HUBS.forEach((hb, i) => {
      const d = dist(v.x, v.y, hb.x, hb.y);
      const score = chooseByQueue ? d + hubLoad(i) * 3.0 : d;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    v.hub = best;
    v.chargeTo = target;
    startLeg(v, HUBS[best].x, HUBS[best].y, dist(v.x, v.y, HUBS[best].x, HUBS[best].y) * cfg.roadFactor, "toCharger", false);
    log(v, t, note);
  };

  const facts = (v: Vehicle, t: number): DecisionFacts => {
    const h = Math.floor(t / ticksPerHour) % 24;
    let bq = Infinity;
    let bk = Infinity;
    HUBS.forEach((hb, i) => {
      const d = dist(v.x, v.y, hb.x, hb.y) * cfg.roadFactor;
      if (d + hubLoad(i) * 3 < bk + bq * 3) {
        bk = d;
        bq = hubLoad(i);
      }
    });
    return {
      socPct: Math.round(socPct(v)),
      evRangeKm: Math.round(evRange(v)),
      cngKg: Math.round(v.cng * 10) / 10,
      hour: h,
      peak: PEAK_HOURS.has(h),
      waitingNearby: open.filter((q) => dist(q.ox, q.oy, v.x, v.y) < 6).length,
      forecastNextHour: Math.round(forecastAt(nearestZone(v.x, v.y), h + 1)),
      bestHubQueue: bq,
      bestHubKm: Math.round(bk * 10) / 10,
      tariffNow: tariff(h),
    };
  };

  const record = (v: Vehicle, t: number, answer: "YES" | "NO", rule: string) => {
    decisions.push({ tick: t, vehicle: v.id, question: "Charge now?", answer, rule, facts: facts(v, t) });
  };

  for (let t = 0; t < cfg.ticks; t++) {
    const h = Math.floor(t / ticksPerHour) % 24;
    const cityStep = (cfg.citySpeed * cfg.tickMin) / 60;
    const hwyStep = (cfg.hwySpeed * cfg.tickMin) / 60;

    // 1. New requests arrive.
    while (reqIdx < reqs.length && reqs[reqIdx].tick <= t) open.push(reqs[reqIdx++]);

    // 2. Charging decisions for idle vehicles.
    for (const v of vehicles) {
      if (v.state !== "idle" && v.state !== "rank") continue;
      const pct = socPct(v);
      if (policy === "naive") {
        if (pct < 30) {
          record(v, t, "YES", "naive_soc_below_30");
          sendToHub(v, t, false, 0.8, "SOC < 30 % → nearest charger");
        }
      } else {
        const f = facts(v, t);
        const demandHot = f.peak || f.waitingNearby >= 2 || f.forecastNextHour >= 18;
        if (pct < 12) {
          record(v, t, "YES", "vantage_critical_soc");
          sendToHub(v, t, true, 0.8, "SOC critical → least-queued hub");
        } else if (pct < 35 && demandHot && v.cng > 2) {
          // Defer: range-extender covers the gap; earn now, charge after the peak.
          if (v.idleTicks % 6 === 0) record(v, t, "NO", f.waitingNearby >= 2 ? "vantage_defer_trips_waiting" : "vantage_defer_peak");
        } else if (pct < 35) {
          record(v, t, "YES", "vantage_trough_charge");
          sendToHub(v, t, true, 0.85, "Demand trough → charge now at least-queued hub");
        } else if (pct < 75 && isNight(h) && f.forecastNextHour < 10) {
          record(v, t, "YES", "vantage_night_topup");
          sendToHub(v, t, true, 1.0, "Night tariff ₹" + cfg.nightTariff + "/kWh → top up to 100 %");
        }
      }
    }

    // 3. Dispatch open requests (FIFO).
    const free = () => vehicles.filter((v) => v.state === "idle" || v.state === "rank" || v.state === "returning" || v.state === "reposition");
    let candidates = free();
    for (let qi = 0; qi < open.length && candidates.length > 0; qi++) {
      const q = open[qi];
      const longTrip = q.kind !== "city";
      let best: Vehicle | null = null;
      let bestScore = Infinity;
      for (const v of candidates) {
        const pick = dist(v.x, v.y, q.ox, q.oy) * cfg.roadFactor;
        if (pick > (q.origin === "AIRPORT" ? cfg.maxPickupKm * 2 : cfg.maxPickupKm)) continue;
        const need = pick + q.km;
        const range = evRange(v) + reRange(v);
        if (range < need + 5) continue; // nobody accepts a trip they cannot finish
        let score = pick;
        if (policy === "vantage") {
          // SOC-aware: long trips → high-SOC / range-extender-ready cars; short trips → low-SOC cars.
          if (longTrip) score += (100 - socPct(v)) * 0.03 - Math.min(v.cng, 10) * 0.05;
          else score += socPct(v) * 0.012;
          if (v.state === "rank" && q.origin === "AIRPORT") score -= 2;
        }
        if (score < bestScore) {
          bestScore = score;
          best = v;
        }
      }
      if (best) {
        const v = best;
        v.req = q;
        const pick = dist(v.x, v.y, q.ox, q.oy) * cfg.roadFactor;
        startLeg(v, q.ox, q.oy, pick, "pickup", false);
        log(v, t, `Assigned ${q.kind.replace("_", " ")} trip #${q.id} (${q.km.toFixed(0)} km), pickup ${pick.toFixed(1)} km`);
        open.splice(qi, 1);
        qi--;
        candidates = candidates.filter((c) => c !== v);
      }
    }
    // Expire stale requests.
    for (let qi = open.length - 1; qi >= 0; qi--) {
      if (t - open[qi].tick >= (open[qi].origin === "AIRPORT" ? cfg.maxWaitTicks * 2 : cfg.maxWaitTicks)) {
        m.unmet++;
        hourly[Math.floor(open[qi].tick / ticksPerHour) % 24].unmet++;
        open.splice(qi, 1);
      }
    }

    // 4. Advance vehicles.
    for (const v of vehicles) {
      const step = v.hwy ? hwyStep : cityStep;
      switch (v.state) {
        case "pickup": {
          const km = drive(v, step, policy === "vantage");
          m.deadKm += km;
          hourly[h].deadKm += km;
          if (v.legKmLeft <= 1e-6 && v.req) {
            const q = v.req;
            startLeg(v, q.dx, q.dy, q.km, "trip", q.kind !== "city");
            log(v, t, `Passenger on board → ${q.dest}`);
          }
          break;
        }
        case "trip": {
          const km = drive(v, step, policy === "vantage");
          m.paidKm += km;
          hourly[h].paidKm += km;
          m.revenue += km * cfg.farePerKm;
          if (v.legKmLeft <= 1e-6 && v.req) {
            const q = v.req;
            m.tripsServed++;
            hourly[h].served++;
            v.req = null;
            log(v, t, `Dropped at ${q.dest}`);
            if (q.dest === "INTERCITY") {
              // Return leg from the other city.
              const backhaul = r() < (policy === "vantage" ? cfg.vantageBackhaulProb : cfg.naiveBackhaulProb);
              const back = cfg.intercityKm + 4;
              const cz = zones.CBD;
              if (backhaul) {
                const synthetic: Request = { ...q, id: -q.id - 1, kind: "intercity", ox: v.x, oy: v.y, dx: cz.x, dy: cz.y, km: back, origin: "INTERCITY", dest: "CBD" };
                v.req = synthetic;
                startLeg(v, cz.x, cz.y, back, "trip", true);
                log(v, t, policy === "vantage" ? "VANTAGE matched an intercity back-haul fare" : "Found a return fare");
              } else {
                startLeg(v, cz.x, cz.y, back, "returning", true);
                log(v, t, "Empty return from intercity");
              }
            } else if (q.dest === "AIRPORT") {
              const ranked = vehicles.filter((o) => o.state === "rank").length;
              const arrivals = (forecastAt("AIRPORT", h) + forecastAt("AIRPORT", h + 1)) * 0.25;
              if (policy === "vantage" && ranked < arrivals) {
                v.state = "rank";
                v.rankTicks = 0;
                log(v, t, "Joined airport rank (arrival wave forecast)");
              } else {
                const cz = zones.CBD;
                startLeg(v, cz.x, cz.y, dist(v.x, v.y, cz.x, cz.y) * cfg.roadFactor, "returning", true);
                log(v, t, "Empty return to city");
              }
            } else {
              v.state = "idle";
              v.idleTicks = 0;
            }
          }
          break;
        }
        case "returning":
        case "reposition": {
          const km = drive(v, step, policy === "vantage");
          m.deadKm += km;
          hourly[h].deadKm += km;
          if (v.legKmLeft <= 1e-6) {
            v.state = "idle";
            v.idleTicks = 0;
          }
          break;
        }
        case "toCharger": {
          const km = drive(v, cityStep, false);
          m.chargeKm += km;
          hourly[h].deadKm += km;
          if (v.legKmLeft <= 1e-6) {
            if (hubPlugs[v.hub] < cfg.plugsPerHub) {
              hubPlugs[v.hub]++;
              v.state = "charging";
              log(v, t, "Plugged in");
            } else {
              hubQueue[v.hub].push(v.id);
              v.state = "queue";
              log(v, t, `Queued at hub ${v.hub + 1}`);
            }
          }
          break;
        }
        case "queue": {
          m.chargingMinTotal += cfg.tickMin;
          if (PEAK_HOURS.has(h)) m.chargingMinPeak += cfg.tickMin;
          hourly[h].charging++;
          break;
        }
        case "charging": {
          const target = minSoc + usable * v.chargeTo;
          // LFP taper above 80 %: half power.
          const kw = socPct(v) > 80 ? cfg.chargerKw / 2 : cfg.chargerKw;
          const add = Math.min((kw * cfg.tickMin) / 60, target - v.soc);
          v.soc += Math.max(0, add);
          m.kWhCharged += Math.max(0, add);
          m.energyCost += (Math.max(0, add) / 0.92) * tariff(h);
          m.chargingMinTotal += cfg.tickMin;
          if (PEAK_HOURS.has(h)) m.chargingMinPeak += cfg.tickMin;
          hourly[h].charging++;
          if (v.soc >= target - 1e-6) {
            hubPlugs[v.hub]--;
            const nextId = hubQueue[v.hub].shift();
            if (nextId !== undefined) {
              hubPlugs[v.hub]++;
              const nv = vehicles[nextId];
              nv.state = "charging";
              log(nv, t, "Plugged in after queue");
            }
            v.state = "idle";
            v.idleTicks = 0;
            v.hub = -1;
            log(v, t, `Charged to ${Math.round(socPct(v))} %`);
            // VANTAGE refills the range-extender opportunistically at hubs co-located with CNG.
            if (policy === "vantage" && v.cng < cfg.cngTankKg * 0.5) v.cng = cfg.cngTankKg;
          }
          break;
        }
        case "rank": {
          v.rankTicks++;
          const f = forecastAt("AIRPORT", h) + forecastAt("AIRPORT", h + 1);
          if (v.rankTicks > 9 && f < 8) {
            const cz = zones.CBD;
            startLeg(v, cz.x, cz.y, dist(v.x, v.y, cz.x, cz.y) * cfg.roadFactor, "returning", true);
            log(v, t, "No arrival wave forecast → return to city");
          }
          break;
        }
        case "idle": {
          v.idleTicks++;
          if (policy === "naive" && v.idleTicks >= 2 && r() < cfg.naiveCruiseProb) {
            // Without guidance, drivers cruise looking for fares (dead km).
            const ang = r() * Math.PI * 2;
            const tx = Math.min(17, Math.max(1, v.x + Math.cos(ang) * 1.5));
            const ty = Math.min(16, Math.max(1, v.y + Math.sin(ang) * 1.5));
            startLeg(v, tx, ty, dist(v.x, v.y, tx, ty) * cfg.roadFactor, "reposition", false);
            if (v.idleTicks === 2) log(v, t, "Cruising for fares");
            break;
          }
          // Range-extender refuel when low (both policies; CNG stations are common in city).
          if (v.cng < 2) {
            v.cng = cfg.cngTankKg;
            log(v, t, "CNG refill");
          }
          if (policy === "vantage" && v.idleTicks % 4 === 3) {
            // Supply-aware repositioning: go where forecast demand per idle car is highest.
            const ratio = (z: string) => {
              const zz = zones[z];
              const supply = vehicles.filter((o) => (o.state === "idle" || o.state === "reposition") && dist(o.x, o.y, zz.x, zz.y) < 3.5).length;
              return forecastAt(z, h + 1) / (supply + 1);
            };
            const here = nearestZone(v.x, v.y);
            const hereRatio = cityKeys.includes(here) ? ratio(here) : 0;
            let bestZ = here;
            let bestScore = hereRatio * 1.5 + 0.6;
            for (const z of cityKeys) {
              const dd = dist(v.x, v.y, zones[z].x, zones[z].y);
              if (dd > 7 || z === here) continue;
              const sc = ratio(z) - dd * 0.08;
              if (sc > bestScore) {
                bestScore = sc;
                bestZ = z;
              }
            }
            if (bestZ !== here) {
              const zz = zones[bestZ];
              const tx = zz.x + (r() - 0.5) * 3;
              const ty = zz.y + (r() - 0.5) * 3;
              startLeg(v, tx, ty, dist(v.x, v.y, tx, ty) * cfg.roadFactor, "reposition", false);
              log(v, t, `Reposition to ${bestZ} (forecast demand per idle car highest)`);
            }
          }
          break;
        }
      }
    }

    if (keepFrames) {
      const arr = new Float32Array(vehicles.length * 4);
      vehicles.forEach((v, i) => {
        arr[i * 4] = v.x;
        arr[i * 4 + 1] = v.y;
        arr[i * 4 + 2] = STATE_CODES.indexOf(v.state);
        arr[i * 4 + 3] = socPct(v);
      });
      const cum = Float64Array.from([m.paidKm, m.totalKm, m.tripsServed, m.unmet, m.revenue, m.energyCost, m.chargingMinPeak, m.deadKm + m.chargeKm]);
      frames.push({ v: arr, waiting: open.length, cum });
    }
  }

  m.paidShare = m.totalKm > 0 ? m.paidKm / m.totalKm : 0;
  m.evKmShare = m.totalKm > 0 ? evKm / m.totalKm : 0;
  m.urbanEvShare = cityKm > 0 ? cityEvKm / cityKm : 0;
  m.netPerVehicleHour = (m.revenue - m.energyCost) / (cfg.vehicles * (cfg.ticks * cfg.tickMin) / 60);
  return { policy, metrics: m, hourly, frames, decisions, timelines: vehicles.map((v) => v.timeline) };
}

/** Template (no-LLM) explanation built strictly from the decision facts. */
export function explainDecision(d: Decision): string {
  const f = d.facts;
  const hh = `${String(f.hour).padStart(2, "0")}:00`;
  switch (d.rule) {
    case "vantage_defer_trips_waiting":
      return `Don't charge now. At ${hh} there are ${f.waitingNearby} paid trips waiting within 6 km and SOC is ${f.socPct}% (${f.evRangeKm} km EV range) with ${f.cngKg} kg CNG on board, so the range-extender covers the gap. Charge after the peak, when the best hub queue (${f.bestHubQueue}) and demand both fall.`;
    case "vantage_defer_peak":
      return `Don't charge now. ${hh} is a peak hour (forecast ${f.forecastNextHour} requests next hour nearby). SOC ${f.socPct}% plus ${f.cngKg} kg CNG is enough to keep earning; charging is deferred to the next demand trough.`;
    case "vantage_critical_soc":
      return `Charge now. SOC is ${f.socPct}% (${f.evRangeKm} km EV range). The least-queued hub is ${f.bestHubKm} km away with ${f.bestHubQueue} vehicle(s) ahead.`;
    case "vantage_trough_charge":
      return `Charge now. SOC ${f.socPct}% and demand is soft (${f.waitingNearby} trips waiting, ${f.forecastNextHour} forecast next hour), so charging costs few paid trips. Hub ${f.bestHubKm} km away, queue ${f.bestHubQueue}, tariff ₹${f.tariffNow}/kWh.`;
    case "vantage_night_topup":
      return `Charge now. Night tariff is ₹${f.tariffNow}/kWh and forecast demand is low (${f.forecastNextHour}/h), so topping up from ${f.socPct}% to full is cheap and ready for the morning peak.`;
    case "naive_soc_below_30":
      return `Charge now (fixed rule). SOC ${f.socPct}% is below 30%, so the car goes to the nearest charger — even though ${f.waitingNearby} trip${f.waitingNearby === 1 ? " is" : "s are"} waiting nearby and it is ${f.peak ? "a peak hour" : "off-peak"}.`;
    default:
      return `${d.answer === "YES" ? "Charge now" : "Don't charge now"} (SOC ${f.socPct}%).`;
  }
}
