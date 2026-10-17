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


def parse_sources(md: Path) -> dict:
    """Turn the tables in docs/SOURCES.md into {id: {figure, notes, publisher, url}}."""
    out = {}
    if not md.exists():
        return out
    for line in md.read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 6 and cells[0].startswith("S") and cells[0][1:].isdigit():
            url = cells[4] if cells[4].startswith("http") else None
            out[cells[0]] = {"figure": cells[1], "notes": cells[2], "publisher": cells[3], "url": url, "accessed": cells[5]}
    return out


def main() -> None:
    a = load_assumptions()
    write("assumptions.json", a)
    write("sources.json", parse_sources(Path(__file__).resolve().parent.parent / "docs" / "SOURCES.md"))
    write("market.json", size_market(a))
    write("demand.json", train_demand())
    write("health.json", train_health(a["revenue"]["downtimeCostPerDay"]["value"]))


if __name__ == "__main__":
    main()
