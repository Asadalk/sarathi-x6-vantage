import Link from "next/link";
import type { ReactNode } from "react";

export const COLORS = {
  navy: "#16205C",
  blue: "#1E4FA8",
  cyan: "#22B8D8",
  red: "#D7262E",
  green: "#2E9E5B",
  amber: "#F28C28",
  slate: "#8792B5",
  violet: "#7B5CC4",
};

/** Fixed colour per powertrain so every chart reads the same way. */
export const PT_COLORS: Record<string, string> = {
  CNG: COLORS.slate,
  BIOCNG: COLORS.green,
  HEV: COLORS.amber,
  PHEV: COLORS.violet,
  BEV: COLORS.cyan,
  EREV: COLORS.red,
};

export function PageHeader({ step, title, lead, deliverable }: { step?: string; title: string; lead: ReactNode; deliverable?: string }) {
  return (
    <div className="pt-8 pb-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
        {step && <span className="grid place-items-center size-6 rounded-full bg-navy text-white dark:bg-mblue">{step}</span>}
        {deliverable && <span>{deliverable}</span>}
      </div>
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-balance">{title}</h1>
      <div className="mt-2 max-w-3xl text-muted leading-relaxed text-pretty">{lead}</div>
    </div>
  );
}

export function Card({ title, sub, tag, children, className = "" }: { title?: ReactNode; sub?: ReactNode; tag?: Tagkind; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 min-w-0 ${className}`}>
      {(title || tag) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-ink leading-snug">{title}</h2>}
            {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
          </div>
          {tag && <Tag kind={tag} />}
        </div>
      )}
      {children}
    </section>
  );
}

type Tagkind = "illustrative" | "synthetic" | "sourced" | "target";

export function Tag({ kind }: { kind: Tagkind }) {
  const cls: Record<Tagkind, string> = {
    illustrative: "bg-amber/15 text-[#a85a0c] dark:text-amber",
    synthetic: "bg-cyan/15 text-[#0b7b93] dark:text-cyan",
    sourced: "bg-mgreen/15 text-mgreen",
    target: "bg-mblue/15 text-mblue dark:text-accent",
  };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls[kind]}`}>{kind}</span>;
}

export function Kpi({ value, label, sub, color = COLORS.blue }: { value: ReactNode; label: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4 min-w-0">
      <div className="text-2xl sm:text-3xl font-bold num leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-2 text-sm font-semibold text-ink">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt = (v) => String(v),
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="block py-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink">{label}</span>
        <span className="num font-semibold text-accent">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      {hint && <div className="text-[11px] text-muted -mt-0.5">{hint}</div>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl bg-surface-2 p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${value === o.id ? "bg-surface text-ink shadow-sm font-semibold" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ n, color = COLORS.navy }: { n: ReactNode; color?: string }) {
  return (
    <span className="grid place-items-center size-7 shrink-0 rounded-full text-white text-xs font-bold" style={{ background: color }}>
      {n}
    </span>
  );
}

export function ModuleLink({ href, n, title, text }: { href: string; n: string; title: string; text: string }) {
  return (
    <Link href={href} className="card p-4 flex gap-3 hover:-translate-y-0.5 transition-transform">
      <Badge n={n} />
      <div className="min-w-0">
        <div className="font-semibold text-ink">{title} →</div>
        <div className="text-sm text-muted mt-0.5">{text}</div>
      </div>
    </Link>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted leading-relaxed mt-3">{children}</p>;
}
