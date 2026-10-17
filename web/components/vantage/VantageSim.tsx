"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import demandRaw from "@/public/data/demand.json";
import { COLORS, Card, Note, Tag } from "@/components/ui";
import { CUM, DEFAULT_SIM, HUBS, STATE_CODES, explainDecision, generateRequests, runSim, type Decision, type DemandData, type SimResult, type VState } from "@/lib/engine/sim";
import { inr } from "@/lib/format";

const demand = demandRaw as unknown as DemandData;

const STATE_COLORS: Record<VState, string> = {
  idle: "#8792B5",
  pickup: COLORS.amber,
  trip: COLORS.green,
  toCharger: COLORS.cyan,
  queue: COLORS.red,
  charging: COLORS.blue,
  reposition: "#B48CE0",
  returning: "#C9A227",
  rank: "#F06EAA",
};
const STATE_LABEL: Record<VState, string> = {
  idle: "Idle",
  pickup: "To pickup (dead km)",
  trip: "Paid trip",
  toCharger: "To charger",
  queue: "Charger queue",
  charging: "Charging",
  reposition: "Cruise / reposition",
  returning: "Empty return",
  rank: "Airport rank",
};

const W = 34;
const H = 18.5;

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : d;
  };
  const mobile = window.innerWidth < 640;
  return {
    seed: num("seed", DEFAULT_SIM.seed),
    vehicles: Math.min(num("n", mobile ? 30 : DEFAULT_SIM.vehicles), mobile ? 30 : 80),
    tick: num("t", -1),
    vehicle: num("v", -1),
    autoplay: q.get("play") !== "0",
  };
}

function hhmm(tick: number) {
  const m = tick * DEFAULT_SIM.tickMin;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function MapCanvas({ res, tick, selected, onSelect, title, accent }: { res: SimResult; tick: number; selected: number; onSelect: (id: number) => void; title: string; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = (w * H) / W;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = w / W;
    const sy = h / H;
    const P = (x: number, y: number): [number, number] => [x * sx, h - y * sy];
    const dark = document.documentElement.dataset.theme === "dark";
    ctx.fillStyle = dark ? "#10184a" : "#f7f9fd";
    ctx.fillRect(0, 0, w, h);
    // city boundary
    ctx.strokeStyle = dark ? "#2a3470" : "#dfe5f2";
    ctx.lineWidth = 1;
    const [cx0, cy0] = P(0.5, 17);
    ctx.strokeRect(cx0, cy0, 17.5 * sx, 16.5 * sy);
    // roads to airport and highway
    ctx.strokeStyle = dark ? "#3a4690" : "#c9d3ef";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(...P(14, 9));
    ctx.lineTo(...P(30, 9));
    ctx.moveTo(...P(16, 15.5));
    ctx.lineTo(...P(24, 18));
    ctx.stroke();
    // zones
    for (const [name, z] of Object.entries(demand.zones)) {
      const [x, y] = P(z.x, z.y);
      ctx.fillStyle = name === "AIRPORT" ? "rgba(215,38,46,0.10)" : name === "HWY_EXIT" ? "rgba(242,140,40,0.12)" : "rgba(30,79,168,0.08)";
      ctx.beginPath();
      ctx.arc(x, y, (name === "AIRPORT" ? 1.6 : 2.2) * sx, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark ? "#a3acd0" : "#56607f";
      ctx.font = `600 ${Math.max(9, sx * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(name.replace("_", " "), x, y - 2.4 * sy);
    }
    // charging hubs
    HUBS.forEach((hb, i) => {
      const [x, y] = P(hb.x, hb.y);
      ctx.fillStyle = COLORS.blue;
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), x, y + 3);
    });
    // vehicles
    const f = res.frames[Math.min(tick, res.frames.length - 1)];
    const n = f.v.length / 4;
    for (let i = 0; i < n; i++) {
      const [x, y] = P(Math.min(W - 0.3, f.v[i * 4]), Math.min(H - 0.3, f.v[i * 4 + 1]));
      const st = STATE_CODES[f.v[i * 4 + 2]] ?? "idle";
      ctx.fillStyle = STATE_COLORS[st];
      ctx.beginPath();
      ctx.arc(x, y, i === selected ? 6 : 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (i === selected) {
        ctx.strokeStyle = dark ? "#fff" : "#121a3f";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [res, tick, selected]);

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = H - ((e.clientY - rect.top) / rect.height) * H;
    const f = res.frames[Math.min(tick, res.frames.length - 1)];
    let best = -1;
    let bd = 1.5;
    for (let i = 0; i < f.v.length / 4; i++) {
      const d = Math.hypot(f.v[i * 4] - mx, f.v[i * 4 + 1] - my);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) onSelect(best);
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-sm font-bold" style={{ color: accent }}>
          {title}
        </div>
        <div className="text-xs text-muted num">{res.frames[Math.min(tick, res.frames.length - 1)].waiting} waiting</div>
      </div>
      <canvas ref={ref} onClick={click} className="w-full rounded-xl border border-line cursor-crosshair" aria-label={`${title} fleet map; click a vehicle to inspect it`} />
    </div>
  );
}

export default function VantageSim() {
  const [params] = useState(readParams);
  const [seed, setSeed] = useState(params.seed);
  const [nVeh, setNVeh] = useState(params.vehicles);
  const cfg = useMemo(() => ({ ...DEFAULT_SIM, seed, vehicles: nVeh }), [seed, nVeh]);
  const { naive, vant } = useMemo(() => {
    const reqs = generateRequests(demand, cfg);
    return { naive: runSim("naive", demand, cfg, reqs), vant: runSim("vantage", demand, cfg, reqs) };
  }, [cfg]);

  // Default showcase: the first "don't charge now" decision of the VANTAGE fleet.
  const showcase = useMemo(() => vant.decisions.find((d) => d.answer === "NO" && d.rule === "vantage_defer_trips_waiting") ?? vant.decisions.find((d) => d.answer === "NO"), [vant]);
  const [tick, setTick] = useState(() => (params.tick >= 0 ? params.tick : 0));
  const [playing, setPlaying] = useState(params.autoplay && params.tick < 0);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState<number>(() => (params.vehicle >= 0 ? params.vehicle : (showcase?.vehicle ?? 0)));
  const [ai, setAi] = useState<{ key: string; text: string; source: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const last = cfg.ticks - 1;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t >= last) {
          setPlaying(false);
          return last;
        }
        return Math.min(last, t + speed);
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [playing, speed, last]);

  const resetTo = useCallback((s: number, n: number) => {
    setSeed(s);
    setNVeh(n);
    setTick(0);
    setPlaying(true);
    setAi(null);
  }, []);

  const metric = (r: SimResult) => {
    const c = r.frames[Math.min(tick, r.frames.length - 1)].cum;
    const hours = ((tick + 1) * cfg.tickMin) / 60;
    return {
      paidShare: c[CUM.totalKm] > 0 ? c[CUM.paidKm] / c[CUM.totalKm] : 0,
      deadKm: c[CUM.nonPaidKm],
      served: c[CUM.served],
      unmet: c[CUM.unmet],
      peakChg: c[CUM.chargingMinPeak],
      revenue: c[CUM.revenue],
      energy: c[CUM.energyCost],
      perHour: (c[CUM.revenue] - c[CUM.energyCost]) / (cfg.vehicles * hours),
    };
  };
  const mn = metric(naive);
  const mv = metric(vant);

  const vDecisions = vant.decisions.filter((d) => d.vehicle === selected && d.tick <= tick);
  const nDecisions = naive.decisions.filter((d) => d.vehicle === selected && d.tick <= tick);
  const card: Decision | undefined = vDecisions.filter((d) => d.answer === "NO").at(-1) ?? vDecisions.at(-1) ?? (showcase && showcase.vehicle === selected && tick >= showcase.tick ? showcase : undefined);
  const timeline = vant.timelines[selected]?.filter((e) => e.tick <= tick).slice(-8).reverse() ?? [];
  const cardKey = card ? `${seed}-${card.vehicle}-${card.tick}` : "";

  const askAi = async (d: Decision) => {
    setAiBusy(true);
    try {
      const res = await fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: d }) });
      const j = (await res.json()) as { text?: string; source?: string };
      setAi({ key: cardKey, text: j.text ?? explainDecision(d), source: j.source ?? "template" });
    } catch {
      setAi({ key: cardKey, text: explainDecision(d), source: "template" });
    } finally {
      setAiBusy(false);
    }
  };

  const rows: [string, string, string, string][] = [
    ["Paid-km share", `${(mn.paidShare * 100).toFixed(1)}%`, `${(mv.paidShare * 100).toFixed(1)}%`, `${((mv.paidShare - mn.paidShare) * 100).toFixed(1)} pts`],
    ["Dead + charge-detour km", Math.round(mn.deadKm).toLocaleString("en-IN"), Math.round(mv.deadKm).toLocaleString("en-IN"), `${Math.round(mv.deadKm - mn.deadKm).toLocaleString("en-IN")}`],
    ["Trips served", String(mn.served), String(mv.served), `${mv.served - mn.served >= 0 ? "+" : ""}${mv.served - mn.served}`],
    ["Unmet requests", String(mn.unmet), String(mv.unmet), `${mv.unmet - mn.unmet}`],
    ["Charging minutes in peak", String(mn.peakChg), String(mv.peakChg), `${mv.peakChg - mn.peakChg}`],
    ["Revenue", inr(mn.revenue), inr(mv.revenue), inr(mv.revenue - mn.revenue)],
    ["Energy cost", inr(mn.energy), inr(mv.energy), inr(mv.energy - mn.energy)],
    ["Net ₹ per vehicle-hour", inr(mn.perHour), inr(mv.perHour), `${mn.perHour > 0 ? (((mv.perHour - mn.perHour) / mn.perHour) * 100).toFixed(0) : "0"}%`],
  ];

  const hourly = naive.hourly.map((h, i) => ({
    hour: `${String(h.hour).padStart(2, "0")}`,
    naivePaid: Math.round(h.paidKm),
    naiveDead: Math.round(h.deadKm),
    vPaid: Math.round(vant.hourly[i].paidKm),
    vDead: Math.round(vant.hourly[i].deadKm),
  }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (tick >= last ? (setTick(0), setPlaying(true)) : setPlaying((p) => !p))} className="rounded-lg bg-mblue px-4 py-2 text-sm font-semibold text-white min-w-20">
          {playing ? "Pause" : tick >= last ? "Replay" : "Play"}
        </button>
        <div className="flex items-center gap-1 text-sm">
          {[1, 4, 12].map((s) => (
            <button key={s} type="button" onClick={() => setSpeed(s)} className={`rounded-md px-2 py-1 ${speed === s ? "bg-surface-2 font-semibold text-ink" : "text-muted"}`}>
              {s}×
            </button>
          ))}
        </div>
        <div className="font-mono text-lg font-bold text-ink num">{hhmm(tick)}</div>
        <input type="range" min={0} max={last} value={tick} onChange={(e) => (setPlaying(false), setTick(Number(e.target.value)))} className="flex-1 min-w-40" aria-label="Simulation time" />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Seed
          <input type="number" value={seed} onChange={(e) => resetTo(Number(e.target.value) || 1, nVeh)} className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-ink" />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Cars
          <select value={nVeh} onChange={(e) => resetTo(seed, Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">
            {[20, 30, 50, 80].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => resetTo(DEFAULT_SIM.seed, params.vehicles)} className="text-sm text-accent underline">
          Reset
        </button>
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card tag="synthetic" title="Same city, same requests, two policies" sub="Click any car to inspect it. Dots show state: paid trips are green, dead km amber/violet, charging blue, queues red.">
            <div className="grid md:grid-cols-2 gap-3">
              <MapCanvas res={naive} tick={tick} selected={selected} onSelect={setSelected} title="Naive fleet" accent={COLORS.slate} />
              <MapCanvas res={vant} tick={tick} selected={selected} onSelect={setSelected} title="VANTAGE fleet" accent={COLORS.red} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
              {(Object.keys(STATE_COLORS) as VState[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-full" style={{ background: STATE_COLORS[s] }} />
                  {STATE_LABEL[s]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5" style={{ background: COLORS.blue }} />
                Charging hub
              </span>
            </div>
          </Card>

          <Card title={`Live metrics at ${hhmm(tick)}`} sub={`${cfg.vehicles} SARATHI-X6 cars · seed ${seed} · cumulative since 00:00`} tag="synthetic">
            <div className="overflow-x-auto">
              <table className="w-full text-sm num">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-line">
                    <th className="py-2 pr-2 font-medium">Metric</th>
                    <th className="py-2 px-2 font-medium text-right">Naive</th>
                    <th className="py-2 px-2 font-medium text-right">VANTAGE</th>
                    <th className="py-2 pl-2 font-medium text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, a, b, d], i) => (
                    <tr key={k} className={`border-b border-line/60 ${i === 0 ? "text-base" : ""}`}>
                      <td className="py-1.5 pr-2 text-ink">{k}</td>
                      <td className="py-1.5 px-2 text-right">{a}</td>
                      <td className="py-1.5 px-2 text-right font-semibold">{b}</td>
                      <td className="py-1.5 pl-2 text-right text-muted">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              Full day, this seed: {(naive.metrics.paidShare * 100).toFixed(1)}% → {(vant.metrics.paidShare * 100).toFixed(1)}% paid km. Across 10 seeds the mean is about 62% → 72%, and VANTAGE wins by at least 5 points in every seed (unit-tested). VANTAGE spends a little more on energy per km (it defers charging and uses the CNG range-extender in peaks) in exchange for more paid trips and higher net ₹ per vehicle-hour.
            </Note>
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <Card title={`Car #${selected} · decision card`} tag="synthetic">
            {card ? (
              <div>
                <div className={`rounded-xl px-4 py-3 text-white ${card.answer === "NO" ? "bg-navy dark:bg-mblue" : "bg-mgreen"}`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan">
                    {hhmm(card.tick)} · {card.question}
                  </div>
                  <div className="text-xl font-bold">{card.answer === "NO" ? "“DON’T CHARGE NOW”" : "“CHARGE NOW”"}</div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs num">
                  {[
                    ["SOC", `${card.facts.socPct}%`],
                    ["EV range", `${card.facts.evRangeKm} km`],
                    ["CNG on board", `${card.facts.cngKg} kg`],
                    ["Trips waiting ≤6 km", String(card.facts.waitingNearby)],
                    ["Forecast next hour", `${card.facts.forecastNextHour} req/h`],
                    ["Peak hour", card.facts.peak ? "yes" : "no"],
                    ["Best hub", `${card.facts.bestHubKm} km · queue ${card.facts.bestHubQueue}`],
                    ["Tariff now", `₹${card.facts.tariffNow}/kWh`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-line/60 py-0.5">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-semibold text-ink text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm leading-relaxed text-ink">{ai && ai.key === cardKey ? ai.text : explainDecision(card)}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">
                    {ai && ai.key === cardKey ? (ai.source === "llm" ? "Explained by Claude using only the facts above" : "Template explanation (no AI key configured)") : "Deterministic template explanation"}
                  </span>
                  <button type="button" disabled={aiBusy} onClick={() => askAi(card)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-accent hover:bg-surface-2 disabled:opacity-50">
                    {aiBusy ? "Asking…" : "Explain with AI"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">No charging decision for this car yet. Play forward, or pick another car.</p>
            )}
            {nDecisions.length > 0 && (
              <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                <strong className="text-ink">Same car in the naive fleet:</strong> {explainDecision(nDecisions[nDecisions.length - 1])}
              </p>
            )}
            <Note>The engine makes every decision. The AI only rewords the facts, and a server check rejects any number that isn&apos;t in them.</Note>
          </Card>

          <Card title={`Car #${selected} · VANTAGE timeline`}>
            <ol className="space-y-1.5 text-xs">
              {timeline.length === 0 && <li className="text-muted">Nothing yet.</li>}
              {timeline.map((e, i) => (
                <li key={`${e.tick}-${i}`} className="flex gap-2">
                  <span className="font-mono text-muted shrink-0">{hhmm(e.tick)}</span>
                  <span className="size-2 mt-1 rounded-full shrink-0" style={{ background: STATE_COLORS[e.state] }} />
                  <span className="text-ink">{e.note}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Card title="Paid vs dead km by hour (full day)" sub="Fleet totals; dead includes pickup, cruising, repositioning, empty returns and charger detours" tag="synthetic">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="hour" fontSize={11} label={{ value: "Hour of day", position: "insideBottom", offset: -2, fontSize: 11 }} height={34} />
              <YAxis fontSize={11} width={44} label={{ value: "km", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="naivePaid" name="Naive paid" stackId="n" fill="#8792B5" isAnimationActive={false} />
              <Bar dataKey="naiveDead" name="Naive dead" stackId="n" fill="#C9CFE3" isAnimationActive={false} />
              <Bar dataKey="vPaid" name="VANTAGE paid" stackId="v" fill={COLORS.red} isAnimationActive={false} />
              <Bar dataKey="vDead" name="VANTAGE dead" stackId="v" fill="#F2B3B6" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Note>
          <Tag kind="synthetic" /> Demand comes from a Poisson gradient-boosting model trained on 53 days of synthetic request logs (test MAE {(demandRaw as { testMAE: number }).testMAE} vs {(demandRaw as { baselineMAE: number }).baselineMAE} for a flat baseline). VANTAGE plans against that forecast, while actual requests are sampled from the hidden ground truth, so the forecast is useful but not perfect.
        </Note>
      </Card>
    </div>
  );
}
