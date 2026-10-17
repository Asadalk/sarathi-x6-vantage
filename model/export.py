"""Write every JSON artifact the web app consumes into ../web/public/data/.

    python export.py

Outputs: assumptions.json (verbatim copy of assumptions.yaml), market.json,
demand.json (synthetic, trained forecast + ground truth), health.json (synthetic).
"""
from __future__ import annotations

import json
from pathlib import Path

from market_sizing import load_assumptions, size_market
from train_models import train_demand, train_health

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", OUT / name)


def main() -> None:
    a = load_assumptions()
    write("assumptions.json", a)
    write("market.json", size_market(a))
    write("demand.json", train_demand())
    write("health.json", train_health(a["revenue"]["downtimeCostPerDay"]["value"]))


if __name__ == "__main__":
    main()
