"""Train the two small models used by the web app (on SYNTHETIC data).

1. Demand forecaster — Poisson gradient boosting on (zone, kind, hour, day-of-week)
   trained on 60 days of synthetic request logs. Its typical-weekday forecast is what
   the VANTAGE policy "knows" in the simulator; the simulator samples *actual* requests
   from the ground-truth rate, so the forecast is useful but imperfect.
2. Predictive-maintenance flagger — IsolationForest over 14-day telematics features
   per vehicle, plus a robust z-score to name the reason.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, IsolationForest

from synth_telematics import KINDS, SEED, ZONES, fleet_health, trip_logs, true_hourly_rate

FEATURES = ["hour_sin", "hour_cos", "hour_sin2", "hour_cos2", "hour", "dow", "zone_id", "kind_id"]
ZONE_IDS = {z: i for i, z in enumerate(ZONES)}
KIND_IDS = {k: i for i, k in enumerate(KINDS)}


def _features(df: pd.DataFrame) -> pd.DataFrame:
    h = df["hour"].to_numpy(dtype=float)
    out = pd.DataFrame(
        {
            "hour_sin": np.sin(2 * np.pi * h / 24),
            "hour_cos": np.cos(2 * np.pi * h / 24),
            "hour_sin2": np.sin(4 * np.pi * h / 24),
            "hour_cos2": np.cos(4 * np.pi * h / 24),
            "hour": h,
            "dow": df["dow"].to_numpy(),
            "zone_id": df["zone"].map(ZONE_IDS).to_numpy(),
            "kind_id": df["kind"].map(KIND_IDS).to_numpy(),
        }
    )
    return out[FEATURES]


def train_demand(days: int = 60, seed: int = SEED) -> dict:
    logs = trip_logs(days, seed)
    train = logs[logs.day < days - 7]
    test = logs[logs.day >= days - 7]
    model = HistGradientBoostingRegressor(loss="poisson", max_iter=300, learning_rate=0.08, random_state=seed,
                                          categorical_features=[6, 7])
    model.fit(_features(train), train["requests"])
    pred_test = model.predict(_features(test))
    mae = float(np.mean(np.abs(pred_test - test["requests"])))
    naive = float(np.mean(np.abs(test["requests"].mean() - test["requests"])))

    # Typical weekday (dow=1) forecast grid.
    forecast: dict[str, dict[str, list[float]]] = {}
    truth: dict[str, dict[str, list[float]]] = {}
    for z in ZONES:
        for k in KINDS:
            t = true_hourly_rate(z, k)
            if t.sum() == 0:
                continue
            grid = pd.DataFrame({"hour": range(24), "dow": 1, "zone": z, "kind": k})
            forecast.setdefault(z, {})[k] = [round(float(x), 3) for x in model.predict(_features(grid))]
            truth.setdefault(z, {})[k] = [round(float(x), 3) for x in t]
    return {
        "synthetic": True,
        "model": "HistGradientBoostingRegressor(loss=poisson)",
        "trainDays": days - 7,
        "testDays": 7,
        "testMAE": round(mae, 3),
        "baselineMAE": round(naive, 3),
        "zones": {z: {"x": xy[0], "y": xy[1]} for z, xy in ZONES.items()},
        "forecast": forecast,
        "truth": truth,
    }


HEALTH_FEATURES = ["soh_slope", "temp_spread", "cell_dv", "dc_per_day", "brake_idx"]
ACTIONS = {
    "soh_slope": ("Fast SOH fade", "Limit DC fast-charge to 1/day, schedule BMS balancing + capacity test"),
    "temp_spread": ("Cell temperature spread rising", "Inspect pack coolant loop & thermal pads at next depot slot"),
    "cell_dv": ("Cell voltage imbalance", "Run passive balancing; replace module if ΔV persists"),
    "dc_per_day": ("Excess DC fast-charging", "Shift charging to depot AC/overnight via VANTAGE schedule"),
    "brake_idx": ("Brake wear above fleet trend", "Book pad replacement in off-peak window"),
}


def train_health(downtime_cost_per_day: float = 2000.0, seed: int = SEED) -> dict:
    df = fleet_health(seed=seed)
    last = df[df.day >= df.day.max() - 13]
    feats = []
    for v, g in last.groupby("vehicle"):
        slope = np.polyfit(g.day, g.soh_pct, 1)[0]
        feats.append(
            {
                "vehicle": int(v),
                "soh_slope": float(-slope),  # positive = fading
                "temp_spread": float(g.cell_temp_spread_c.mean()),
                "cell_dv": float(g.cell_dv_mv.mean()),
                "dc_per_day": float(g.dc_sessions.mean()),
                "brake_idx": float(g.brake_wear_idx.iloc[-1]),
                "injected": g.injected_fault.iloc[-1],
            }
        )
    F = pd.DataFrame(feats)
    X = F[HEALTH_FEATURES].to_numpy()
    iso = IsolationForest(n_estimators=300, contamination=0.08, random_state=seed).fit(X)
    score = -iso.score_samples(X)  # higher = more anomalous
    flagged = iso.predict(X) == -1
    med = np.median(X, axis=0)
    mad = np.median(np.abs(X - med), axis=0) * 1.4826 + 1e-9
    z = (X - med) / mad

    vehicles = []
    for i, row in F.iterrows():
        top = int(np.argmax(z[i]))
        feat = HEALTH_FEATURES[top]
        reason, action = ACTIONS[feat]
        g = df[df.vehicle == row.vehicle]
        is_flag = bool(flagged[i])
        # Avoided downtime: unplanned failure ≈ 4 days off-road vs 1 planned day.
        avoided = (4 - 1) * downtime_cost_per_day + 6000 if is_flag else 0
        vehicles.append(
            {
                "id": int(row.vehicle),
                "flagged": is_flag,
                "score": round(float(score[i]), 4),
                "reason": reason if is_flag else None,
                "action": action if is_flag else None,
                "topFeature": feat,
                "z": {f: round(float(z[i][j]), 2) for j, f in enumerate(HEALTH_FEATURES)},
                "features": {f: round(float(row[f]), 4) for f in HEALTH_FEATURES},
                "avoidedRs": avoided,
                "injected": row.injected,
                "soh": [round(float(x), 2) for x in g.soh_pct.to_numpy()[::3]],
                "tempSpread": [round(float(x), 2) for x in g.cell_temp_spread_c.to_numpy()[::3]],
                "dc": [int(x) for x in g.dc_sessions.to_numpy()[::3]],
                "brake": [round(float(x), 3) for x in g.brake_wear_idx.to_numpy()[::3]],
            }
        )
    inj = F.injected != "none"
    tp = int((flagged & inj).sum())
    return {
        "synthetic": True,
        "model": "IsolationForest(n_estimators=300, contamination=0.08) + robust z-score reason",
        "days": int(df.day.max() + 1),
        "sampleEveryDays": 3,
        "features": HEALTH_FEATURES,
        "detected": {"truePositives": tp, "injectedFaults": int(inj.sum()), "flagged": int(flagged.sum())},
        "vehicles": vehicles,
    }


if __name__ == "__main__":
    d = train_demand()
    print("demand MAE", d["testMAE"], "baseline", d["baselineMAE"])
    h = train_health()
    print(h["detected"])
    for v in h["vehicles"]:
        if v["flagged"] or v["injected"] != "none":
            print(v["id"], v["flagged"], v["injected"], v["reason"])
