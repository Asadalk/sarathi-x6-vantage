import type { Metadata } from "next";
import type { ReactNode } from "react";
import DataFlow from "@/components/DataFlow";
import { COLORS, Card, PageHeader, Tag } from "@/components/ui";
import { powertrain } from "@/lib/engine/assumptions";
import { computeTco, defaultInputs } from "@/lib/engine/tco";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Driver & Rider Apps" };

function Phone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-[260px] shrink-0">
      <div className="rounded-[38px] border-[10px] border-navy bg-surface shadow-xl dark:border-[#0a0f2e] overflow-hidden">
        <div className="h-6 bg-navy dark:bg-[#0a0f2e] flex justify-center">
          <div className="w-20 h-4 rounded-b-xl bg-black/40" />
        </div>
        <div className="h-[470px] p-3 text-[13px] space-y-2.5 bg-bg">{children}</div>
      </div>
      <div className="mt-2 text-center text-sm font-semibold text-ink">{title}</div>
    </div>
  );
}

const Tile = ({ children, className = "bg-surface border-line" }: { children: ReactNode; className?: string }) => <div className={`rounded-2xl border p-3 ${className}`}>{children}</div>;

export default function Page() {
  const inp = defaultInputs();
  const r = computeTco(powertrain("EREV"), inp, true);
  const daily = r.driverAnnual / r.operatingDays;
  const target = Math.round((daily * 1.05) / 50) * 50;
  const soFar = Math.round((daily * 0.62) / 10) * 10;

  return (
    <>
      <PageHeader
        step="6"
        deliverable="Deliverable 6 · Driver & rider apps, safety, the data that connects them"
        title="One data loop connects vehicle, fleet, driver, rider and service"
        lead="The apps are where VANTAGE's decisions reach people. The driver sees one best next action with a reason, not a dashboard. The rider chooses a seat mode and gets safety tools by default. Driver earnings figures below come from the TCO engine (Round-1 preset); the screens are mock-ups."
      />

      <div className="grid md:grid-cols-3 gap-6 justify-items-center">
        <Phone title="Driver · today">
          <Tile>
            <div className="text-xs text-muted">Today&apos;s earnings</div>
            <div className="text-2xl font-bold text-ink num">{inr(soFar)}</div>
            <div className="mt-1.5 h-2 rounded bg-surface-2">
              <div className="h-2 rounded bg-mgreen" style={{ width: `${Math.round((soFar / target) * 100)}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted num">
              target {inr(target)} · avg day {inr(daily)}
            </div>
          </Tile>
          <Tile className="bg-navy text-white border-navy dark:bg-mblue">
            <div className="text-[11px] uppercase tracking-wider text-cyan font-semibold">Best next action</div>
            <div className="font-bold text-base">Stay near IT Park</div>
            <div className="text-xs opacity-90">Evening peak in 25 min · 2 paid trips likely · don&apos;t charge now, the range-extender has 16 kg</div>
          </Tile>
          <Tile>
            <div className="flex justify-between">
              <span className="text-muted text-xs">Battery</span>
              <span className="font-semibold text-ink">38% · 62 km</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted text-xs">Charge slot</span>
              <span className="font-semibold text-ink">21:40 · Hub 2 · no queue</span>
            </div>
          </Tile>
          <Tile>
            <div className="flex justify-between items-center">
              <span className="text-muted text-xs">Safety score (7 days)</span>
              <span className="font-bold text-mgreen text-lg">92</span>
            </div>
            <div className="text-[11px] text-muted">Smooth braking ✓ · 1 fatigue break due in 50 min</div>
          </Tile>
        </Phone>

        <Phone title="Rider · book">
          <Tile>
            <div className="text-xs text-muted">Pickup → Drop</div>
            <div className="font-semibold text-ink">Koramangala → Airport T2</div>
          </Tile>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
            {[
              ["Solo", "₹", false],
              ["Shared", "₹/seat", false],
              ["Airport + bags", "₹₹", true],
            ].map(([a, b, on]) => (
              <div key={String(a)} className={`rounded-xl p-2 border ${on ? "border-mblue bg-mblue/10 font-semibold text-ink" : "border-line text-muted bg-surface"}`}>
                <div>{a}</div>
                <div className="text-[10px]">{b}</div>
              </div>
            ))}
          </div>
          <Tile>
            <div className="text-xs text-muted">Matched car</div>
            <div className="font-semibold text-ink">SARATHI-X6 · row 3 folded · 800 L</div>
            <div className="text-[11px] text-muted">ETA 4 min · EV mode in city, range-extender on the expressway</div>
          </Tile>
          <Tile>
            <div className="text-xs text-muted">Fare (illustrative)</div>
            <div className="text-xl font-bold text-ink">₹1,140</div>
            <div className="text-[11px] text-muted">upfront price · no surge on airport mode</div>
          </Tile>
          <button type="button" className="w-full rounded-2xl bg-mblue py-2.5 font-semibold text-white">
            Confirm ride
          </button>
        </Phone>

        <Phone title="Rider · on trip">
          <Tile className="bg-surface border-line h-32 relative overflow-hidden">
            <svg viewBox="0 0 200 100" className="absolute inset-0 w-full h-full" aria-hidden>
              <rect width="200" height="100" fill="var(--surface-2)" />
              <path d="M10 85 C 60 70, 80 40, 130 35 S 185 15, 192 10" stroke={COLORS.blue} strokeWidth="4" fill="none" />
              <circle cx="92" cy="45" r="6" fill={COLORS.red} />
            </svg>
          </Tile>
          <Tile>
            <div className="flex justify-between">
              <span className="text-muted text-xs">Arriving</span>
              <span className="font-semibold text-ink">18 min</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted text-xs">Driver</span>
              <span className="font-semibold text-ink">Verified · 4.9★</span>
            </div>
          </Tile>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-2xl bg-mred py-3 font-bold text-white">
              SOS
            </button>
            <button type="button" className="rounded-2xl border border-line bg-surface py-3 font-semibold text-ink">
              Share trip
            </button>
          </div>
          <Tile>
            <div className="text-[11px] text-muted leading-relaxed">
              Women-safety mode: live trip share with 2 contacts, route-deviation alert, in-cabin camera recording kept on the vehicle for 72 h and released only on SOS or complaint.
            </div>
          </Tile>
        </Phone>
      </div>

      <div className="mt-8 space-y-4">
        <Card title="The data that connects them" sub="Every arrow is a real-time feed; the dashed loop is how the forecast and health models improve">
          <DataFlow className="w-full h-auto" />
        </Card>
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Operational value, not features">
            <ul className="text-sm text-ink space-y-1.5">
              <li>
                <strong>Dispatch + charging:</strong> 62% → 72% paid km in the simulator (10-seed mean).
              </li>
              <li>
                <strong>Predictive maintenance:</strong> 3 unplanned days become 1 planned day per caught fault.
              </li>
              <li>
                <strong>Battery management:</strong> limits DC sessions for cars whose packs are fading fast, which protects residual value.
              </li>
              <li>
                <strong>Driver app:</strong> one action with a reason, so drivers trust the system and follow it.
              </li>
            </ul>
          </Card>
          <Card title="Data governance (DPDP Act 2023)">
            <ul className="text-sm text-ink space-y-1.5">
              <li>Consent-based collection with a clear purpose for driver and rider data; withdrawable in-app.</li>
              <li>Data minimisation: trip GPS kept at fleet level, rider identity separated from telematics.</li>
              <li>Cabin video stays on the vehicle and is released only on SOS or complaint.</li>
              <li>Data stored in India; pack data shared with the OEM only in anonymised form.</li>
            </ul>
          </Card>
          <Card title="Bounded AI">
            <p className="text-sm text-ink leading-relaxed">
              Decisions come from deterministic, unit-tested code. The language model only <em>explains</em> a decision from the facts the engine passes it, and a server check rejects any explanation containing a number that isn&apos;t in those facts. With no API key configured, templates are used and the app still works.
            </p>
            <div className="mt-2">
              <Tag kind="target" />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
