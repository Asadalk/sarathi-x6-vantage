import type { Metadata } from "next";
import { Card, PageHeader, Tag } from "@/components/ui";
import sourcesRaw from "@/public/data/sources.json";
import { ASSUMPTIONS, type Assumption } from "@/lib/engine/assumptions";

export const metadata: Metadata = { title: "Assumptions" };

interface Source {
  figure: string;
  notes: string;
  publisher: string;
  url: string | null;
  accessed: string;
}
const SOURCES = sourcesRaw as Record<string, Source>;

const PAGE_LINKS: Record<string, string> = {
  tco: "/tco",
  vantage: "/vantage",
  market: "/market",
  powertrain: "/powertrain",
  vehicle: "/vehicle",
  health: "/health",
  apps: "/apps",
};

const SECTIONS: { key: "duty" | "revenue" | "energy" | "vehicle"; title: string }[] = [
  { key: "duty", title: "Duty cycle" },
  { key: "revenue", title: "Revenue & driver model" },
  { key: "energy", title: "Energy prices & emissions" },
  { key: "vehicle", title: "Vehicle specification" },
];

function fmtValue(a: Assumption) {
  if (a.unit === "share") return `${+(a.value * 100).toFixed(2)}%`;
  return `${a.value.toLocaleString("en-IN")} ${a.unit}`;
}

function Row({ name, a }: { name: string; a: Assumption }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="py-2 pr-3 font-mono text-xs text-ink whitespace-nowrap">{name}</td>
      <td className="py-2 pr-3 num font-semibold whitespace-nowrap">{fmtValue(a)}</td>
      <td className="py-2 pr-3 text-muted text-xs leading-relaxed min-w-[16rem]">
        {a.src?.length ? (
          <span className="mr-1">
            {a.src.map((s) => (
              <a key={s} href={`#${s}`} className="mr-1 rounded bg-mgreen/15 px-1.5 py-0.5 text-[11px] font-semibold text-mgreen">
                {s}
              </a>
            ))}
          </span>
        ) : (
          <span className="mr-1 rounded bg-amber/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#a85a0c] dark:text-amber">assumption</span>
        )}
        {a.why}
      </td>
      <td className="py-2 text-xs whitespace-nowrap">
        {(a.usedIn ?? []).map((u) =>
          PAGE_LINKS[u] ? (
            <a key={u} href={PAGE_LINKS[u]} className="mr-1.5 text-accent underline">
              {u}
            </a>
          ) : (
            <span key={u} className="mr-1.5 text-muted">
              {u}
            </span>
          ),
        )}
      </td>
    </tr>
  );
}

export default function Page() {
  const a = ASSUMPTIONS;
  return (
    <>
      <PageHeader
        title="Every number, its unit, and where it comes from"
        lead={
          <>
            This page is generated from <code className="text-ink">model/assumptions.yaml</code>, the single source of truth that both the TypeScript engine and the Python model read (a CI test fails if they drift). Green tags link to a fetched public source. Amber tags are team assumptions, each with a one-line rationale. Money is in real 2026 rupees, used as 2035 planning values.
          </>
        }
      />
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.key} title={s.title}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-line">
                    <th className="py-2 pr-3 font-medium">Key</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 pr-3 font-medium">Source / rationale</th>
                    <th className="py-2 font-medium">Used in</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(a[s.key]).map(([k, v]) => (
                    <Row key={k} name={k} a={v as Assumption} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

        <Card title="Per-powertrain parameters" tag="illustrative">
          <div className="overflow-x-auto">
            <table className="w-full text-xs num">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  {["Powertrain", "Price", "Residual", "EV km", "Fuel km/unit", "Battery", "Maint ₹/km", "Insurance/yr", "Downtime d", "Queue min/d", "Depot share", "Rationale"].map((h) => (
                    <th key={h} className="py-2 pr-3 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.powertrains.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-3 font-semibold text-ink whitespace-nowrap">{p.label}</td>
                    <td className="py-2 pr-3">₹{(p.price / 1e5).toFixed(2)} L</td>
                    <td className="py-2 pr-3">{Math.round(p.residualPct * 100)}%</td>
                    <td className="py-2 pr-3">{Math.round(p.evShare * 100)}%</td>
                    <td className="py-2 pr-3">{p.kmPerFuel || "—"}</td>
                    <td className="py-2 pr-3">{p.batteryKWh ? `${p.batteryKWh} kWh` : "—"}</td>
                    <td className="py-2 pr-3">{p.maintPerKm.toFixed(2)}</td>
                    <td className="py-2 pr-3">₹{p.insurancePerYear.toLocaleString("en-IN")}</td>
                    <td className="py-2 pr-3">{p.downtimeDays}</td>
                    <td className="py-2 pr-3">
                      {p.queueMinPerDay} ({p.queueMinCityOnly} city-only)
                    </td>
                    <td className="py-2 pr-3">{Math.round(p.depotShare * 100)}%</td>
                    <td className="py-2 text-muted min-w-[18rem] font-sans">{p.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card title="Market sizing inputs">
            <table className="w-full text-sm">
              <tbody>
                {(["taxiMarket2026UsdBn", "cagr2026to2031", "cagr2031to2035", "rideHailingShare", "rideHailingShare2035", "usdInr"] as const).map((k) => (
                  <Row key={k} name={k} a={a.market[k]} />
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-muted">
              Segment splits (assumptions):{" "}
              {a.market.segments.map((s) => `${s.label} ${Math.round(s.revenueShare * 100)}% @ ₹${s.farePerKm}/km, ${Math.round(s.marginPct * 100)}% margin`).join(" · ")}
            </div>
          </Card>
          <Card title="Scoring & presets">
            <div className="text-sm text-muted space-y-2">
              <p>
                Powertrain weights:{" "}
                {Object.entries(a.scoringWeights)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
                . Fleet duty mix: {Math.round(a.dutyMix.cityShare.value * 100)}% city km.
              </p>
              <p>
                Body-style scores (1–5) are a team assessment:{" "}
                {a.bodyStyles.options.map((o) => o.label).join(", ")}; re-weight them on{" "}
                <a href="/vehicle" className="underline text-accent">
                  /vehicle
                </a>
                .
              </p>
              <p>
                Conservative preset: public DC ₹{a.presets.conservative.publicDcTariff}/kWh, depot ₹{a.presets.conservative.depotTariff}/kWh, CNG ₹{a.presets.conservative.cngPrice}/kg, SARATHI EV share {Math.round(a.presets.conservative.evShareEREV * 100)}%, residual{" "}
                {Math.round(a.presets.conservative.residualEREV * 100)}%.
              </p>
              <p>
                <Tag kind="synthetic" /> Fleet simulator demand, telematics and maintenance data are synthetic (seeded, generated in <code>model/</code>).
              </p>
            </div>
          </Card>
        </div>

        <Card title="Sources (fetched 2026-10-18)" tag="sourced">
          <ul className="space-y-2 text-sm">
            {Object.entries(SOURCES).map(([id, s]) => (
              <li key={id} id={id} className="scroll-mt-20">
                <span className="mr-2 rounded bg-mgreen/15 px-1.5 py-0.5 text-[11px] font-semibold text-mgreen">{id}</span>
                <span className="text-ink">{s.figure}</span> <span className="text-muted">· {s.publisher}</span>{" "}
                {s.url && (
                  <a href={s.url} className="text-accent underline break-all" target="_blank" rel="noreferrer">
                    link
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
