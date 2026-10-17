import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from market_sizing import load_assumptions, size_market  # noqa: E402
from synth_telematics import fleet_health, trip_logs  # noqa: E402
from train_models import train_health  # noqa: E402

DATA = ROOT.parent / "web" / "public" / "data"


def test_assumptions_json_matches_yaml():
    """The web engine and Python model must read the same numbers."""
    assert json.loads((DATA / "assumptions.json").read_text(encoding="utf-8")) == load_assumptions()


def test_market_json_matches_python():
    exported = json.loads((DATA / "market.json").read_text(encoding="utf-8"))
    fresh = size_market(load_assumptions())
    assert exported["rideHailing2035Cr"] == pytest.approx(fresh["rideHailing2035Cr"])


def test_segment_shares_sum_to_one():
    segs = load_assumptions()["market"]["segments"]
    assert sum(s["revenueShare"] for s in segs) == pytest.approx(1.0)


def test_synthetic_generators_are_deterministic():
    assert trip_logs(days=3).equals(trip_logs(days=3))
    assert fleet_health(n=5, days=10).equals(fleet_health(n=5, days=10))


def test_health_model_finds_injected_faults():
    h = train_health()
    assert h["detected"]["truePositives"] >= 3
    assert h["detected"]["flagged"] <= 6


def test_every_assumption_has_unit_and_rationale_or_source():
    a = load_assumptions()
    for section in ("duty", "revenue", "energy", "vehicle"):
        for key, v in a[section].items():
            assert "unit" in v, key
            assert v.get("why") or v.get("src"), key
