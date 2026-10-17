"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const PAGES = [
  { href: "/market", label: "Market" },
  { href: "/vehicle", label: "Vehicle" },
  { href: "/powertrain", label: "Powertrain" },
  { href: "/tco", label: "TCO" },
  { href: "/vantage", label: "Fleet sim" },
  { href: "/health", label: "Health" },
  { href: "/apps", label: "Apps" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/assumptions", label: "Assumptions" },
];

function toggleTheme() {
  const el = document.documentElement;
  const next = el.dataset.theme === "dark" ? "light" : "dark";
  el.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* storage may be unavailable */
  }
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink shrink-0" onClick={() => setOpen(false)}>
          <span className="grid place-items-center size-7 rounded-lg bg-navy text-white text-xs dark:bg-mblue">VX</span>
          <span>
            VANTAGE <span className="hidden sm:inline font-medium text-muted">· SARATHI-X6</span>
          </span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm ml-auto">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                path === p.href ? "bg-mblue text-white" : "text-muted hover:text-ink hover:bg-surface-2"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto lg:ml-2 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light/dark theme"
            className="size-9 grid place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface-2"
          >
            <svg viewBox="0 0 24 24" className="size-5 dark:hidden" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
            <svg viewBox="0 0 24 24" className="size-5 hidden dark:block" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
          <button
            type="button"
            className="lg:hidden size-9 grid place-items-center rounded-lg text-muted hover:bg-surface-2"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-line bg-bg px-4 py-2 grid grid-cols-2 gap-1 text-sm">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2 rounded-lg ${path === p.href ? "bg-mblue text-white" : "text-ink hover:bg-surface-2"}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
