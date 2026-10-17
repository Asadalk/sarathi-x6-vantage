"""Synthetic data generators (seeded, reproducible).

Everything produced here is SYNTHETIC. It exists to demonstrate methods
(demand forecasting, anomaly detection) — it is not real fleet data.

1. trip_logs(): 60 days of hourly ride requests per city zone, shaped like
   Indian metro demand (commute peaks, airport waves, intercity mornings).
2. fleet_health(): 90 days of daily battery/brake telematics for a 50-vehicle
   SARATHI-X6 fleet, with a handful of injected faults to detect.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SEED = 2035

# Zone centres in km on a stylised city map (CBD at the middle).
ZONES = {
    "CBD": (8.0, 8.0),
    "RES_N": (4.0, 13.0),
    "RES_S": (4.5, 3.0),
    "RES_E": (12.5, 12.5),
    "IT_PARK": (13.0, 4.0),
    "AIRPORT": (30.0, 9.0),
    "HWY_EXIT": (16.0, 15.5),
}


def _bump(h: np.ndarray, centre: float, width: float, height: float) -> np.ndarray:
    d = np.minimum(np.abs(h - centre), 24 - np.abs(h - centre))
    return height * np.exp(-0.5 * (d / width) ** 2)


def true_hourly_rate(zone: str, kind: str) -> np.ndarray:
    """Ground-truth mean requests/hour for (origin zone, trip kind)."""
    h = np.arange(24, dtype=float)
    night = 0.15
    if kind == "city":
        if zone.startswith("RES"):
            r = night + _bump(h, 8.75, 1.4, 5.2) + _bump(h, 13, 2.5, 1.4) + _bump(h, 20.5, 1.6, 2.4)
        elif zone == "CBD":
            r = night + _bump(h, 9.5, 1.5, 2.2) + _bump(h, 13.5, 2.0, 2.4) + _bump(h, 18.5, 1.6, 5.6) + _bump(h, 22, 1.2, 2.0)
        elif zone == "IT_PARK":
            r = night + _bump(h, 10, 1.2, 1.2) + _bump(h, 18.75, 1.5, 6.0) + _bump(h, 23, 1.0, 1.5)
        else:
            r = np.zeros(24)
    elif kind == "airport_out":  # city → airport
        r = _bump(h, 5, 1.0, 1.2) + _bump(h, 11, 1.5, 0.8) + _bump(h, 16.5, 1.5, 1.0) + _bump(h, 20, 1.2, 0.9)
        if zone == "AIRPORT" or zone == "HWY_EXIT" or zone == "IT_PARK":
            r = r * 0.4
    elif kind == "airport_in":  # airport → city (arrival waves)
        r = (_bump(h, 7, 1.0, 4.0) + _bump(h, 10, 1.0, 2.5) + _bump(h, 14, 1.2, 2.5) + _bump(h, 19, 1.2, 4.2) + _bump(h, 23, 1.0, 3.5)) if zone == "AIRPORT" else np.zeros(24)
    elif kind == "intercity":
        r = (_bump(h, 7, 1.2, 0.35) + _bump(h, 16, 1.5, 0.25)) if zone in ("CBD", "RES_E", "RES_N") else np.zeros(24)
    else:
        raise ValueError(kind)
    return r


KINDS = ("city", "airport_out", "airport_in", "intercity")


def trip_logs(days: int = 60, seed: int = SEED) -> pd.DataFrame:
    """Hourly request counts per (day, zone, kind) — Poisson around the true rate with day effects."""
    rng = np.random.default_rng(seed)
    rows = []
    for d in range(days):
        dow = d % 7
        day_mult = 1.08 if dow in (4, 5) else (0.85 if dow == 6 else 1.0)
        day_mult *= rng.normal(1.0, 0.06)
        for z in ZONES:
            for k in KINDS:
                lam = true_hourly_rate(z, k)
                if lam.sum() == 0:
                    continue
                counts = rng.poisson(np.clip(lam * day_mult, 0, None))
                for hr, c in enumerate(counts):
                    rows.append((d, dow, z, k, hr, int(c)))
    return pd.DataFrame(rows, columns=["day", "dow", "zone", "kind", "hour", "requests"])


def fleet_health(n: int = 50, days: int = 90, seed: int = SEED) -> pd.DataFrame:
    """Daily per-vehicle telematics. A few vehicles get injected degradation faults."""
    rng = np.random.default_rng(seed + 1)
    faulty = {7: "cell_imbalance", 19: "thermal", 33: "brake_wear", 42: "fast_charge_abuse"}
    rows = []
    for v in range(n):
        soh0 = rng.uniform(97.5, 99.5)
        fade = rng.uniform(0.010, 0.018)  # % SOH per day under commercial duty
        brake0 = rng.uniform(0.2, 0.35)
        for d in range(days):
            dc = rng.poisson(1.1)
            spread = rng.normal(2.2, 0.35)  # °C cell temperature spread
            delta_v = rng.normal(18, 3)  # mV cell voltage spread
            f = fade
            brake = brake0 + d * rng.uniform(0.0025, 0.0035)
            kind = faulty.get(v)
            if kind and d > 55:
                t = d - 55
                if kind == "cell_imbalance":
                    delta_v += 1.6 * t
                    f *= 2.2
                elif kind == "thermal":
                    spread += 0.18 * t
                elif kind == "brake_wear":
                    brake += 0.012 * t
                elif kind == "fast_charge_abuse":
                    dc += 3
                    f *= 2.5
            soh = soh0 - f * d * (1 + 0.08 * dc / 1.1) + rng.normal(0, 0.05)
            rows.append((v, d, round(soh, 3), round(spread, 3), round(delta_v, 2), dc, round(brake, 4), kind or "none"))
    return pd.DataFrame(rows, columns=["vehicle", "day", "soh_pct", "cell_temp_spread_c", "cell_dv_mv", "dc_sessions", "brake_wear_idx", "injected_fault"])


if __name__ == "__main__":
    t = trip_logs()
    print(t.groupby("kind").requests.sum() / t.day.nunique())
    h = fleet_health()
    print(h.tail())
