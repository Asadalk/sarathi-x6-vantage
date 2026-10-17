import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "VANTAGE Mobility Intelligence · SARATHI-X6", template: "%s · SARATHI-X6 + VANTAGE" },
  description:
    "A working decision system for India's 2035 ride-service vehicle: market sizing, powertrain selection, TCO and driver earnings, and a live fleet simulator. Built for Maruti Suzuki XCELerate 2026 (E-Track).",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1236" },
  ],
};

// Set the theme before paint: saved choice, else OS preference.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} antialiased min-h-screen`}>
        <Nav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">{children}</main>
        <footer className="border-t border-line mt-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted leading-relaxed">
            <p>
              <strong className="text-ink">Honesty note:</strong> all economics are illustrative 2035 planning values (real 2026 ₹), not Maruti Suzuki forecasts. Data marked{" "}
              <em>synthetic</em> is simulated. Every input is listed on the{" "}
              <a className="underline text-accent" href="/assumptions">
                assumptions page
              </a>
              .
            </p>
            <p className="mt-1">
              Built by Team SARATHI (Ektedar Ahmad, Asadullah Faisal, Harshita Pahadia) for Maruti Suzuki XCELerate 2026 · E-Track ·{" "}
              <a className="underline" href="https://github.com/Asadalk/sarathi-x6-vantage">
                source on GitHub
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
