"""2035 ride-service market sizing (scriptable version of market_sizing.ipynb).

Top-down: 2026 India taxi market (S1) grown at the sourced 2026–31 CAGR (S1) and an
assumed 2031–35 CAGR, times the 2035 ride-hailing share, split into six segments by
assumed revenue shares, then converted to paid km and trips using segment ₹/km yields
and trip lengths. Mirrors web/lib/engine/market.ts exactly (a test checks they agree).
"""
from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent


def load_assumptions() -> dict:
    return yaml.safe_load((ROOT / "assumptions.yaml").read_text(encoding="utf-8"))


def size_market(a: dict, cagr1: float | None = None, cagr2: float | None = None,
                rh_share: float | None = None, fare_mult: float = 1.0) -> dict:
    m = a["market"]
    c1 = m["cagr2026to2031"]["value"] if cagr1 is None else cagr1
    c2 = m["cagr2031to2035"]["value"] if cagr2 is None else cagr2
    rh = m["rideHailingShare2035"]["value"] if rh_share is None else rh_share
    usd2035 = m["taxiMarket2026UsdBn"]["value"] * (1 + c1) ** 5 * (1 + c2) ** 4
    rh_cr = usd2035 * 1e9 * m["usdInr"]["value"] * rh / 1e7
    avg_margin = sum(s["marginPct"] * s["revenueShare"] for s in m["segments"])
    segs = []
    for s in m["segments"]:
        rev = rh_cr * s["revenueShare"]
        fare = s["farePerKm"] * fare_mult
        km = rev * 1e7 / fare
        segs.append({
            "id": s["id"], "label": s["label"], "revenueCr": rev, "paidKmBn": km / 1e9,
            "tripsPerDayLakh": km / s["avgTripKm"] / 365 / 1e5, "avgTripKm": s["avgTripKm"],
            "farePerKm": fare, "marginPct": s["marginPct"], "marginCr": rev * s["marginPct"],
            "pool": "yield" if s["marginPct"] >= avg_margin else "volume",
        })
    return {"taxiMarket2035UsdBn": usd2035, "rideHailing2035Cr": rh_cr, "segments": segs}


if __name__ == "__main__":
    r = size_market(load_assumptions())
    print(f"2035 taxi market ≈ US${r['taxiMarket2035UsdBn']:.1f} bn; ride-hailing ≈ ₹{r['rideHailing2035Cr']/1e5:.2f} lakh crore")
    for s in r["segments"]:
        print(f"{s['label']:<22} ₹{s['revenueCr']:>9,.0f} cr  {s['paidKmBn']:6.2f} bn km  {s['tripsPerDayLakh']:6.1f} L trips/day  {s['pool']}")
