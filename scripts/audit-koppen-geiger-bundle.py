#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from collections import Counter
from pathlib import Path

from data_pipeline.quality import score_observations


def load_importer_module():
    path = Path(__file__).with_name("import-koppen-geiger.py")
    spec = importlib.util.spec_from_file_location("geostats_koppen_importer", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load Köppen-Geiger importer")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def display_key(value: float, value_type: str) -> str:
    return f"{value:.1f}" if value_type == "percentage" else f"{value:.0f}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Bounded 10-category natural/physical-geography feasibility audit")
    parser.add_argument("--input", required=True)
    parser.add_argument("--countries", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--minimum-pass", type=int, default=10)
    args = parser.parse_args()
    module = load_importer_module()
    importer = module.Importer(None, args.input, args.countries, True)
    candidates = importer.discover()
    rows = []

    for candidate in candidates:
        observations = importer.fetch_observations(candidate)
        quality = score_observations(candidate.rule, observations)
        values = [float(row.value) for row in observations]
        keys = [display_key(value, candidate.rule.value_type) for value in values if math.isfinite(value)]
        counts = Counter(keys)
        ordered = sorted(observations, key=lambda row: row.value, reverse=candidate.rule.ranking_direction == "high")
        top20 = ordered[:20]
        top20_distinct = len({display_key(float(row.value), candidate.rule.value_type) for row in top20})
        blockers = []
        if len(observations) < candidate.rule.min_coverage:
            blockers.append(f"coverage {len(observations)} < {candidate.rule.min_coverage}")
        if any(not math.isfinite(value) or value < 0 for value in values):
            blockers.append("non-finite or negative value")
        if candidate.rule.value_type == "percentage" and any(value > 100.000001 for value in values):
            blockers.append("percentage exceeds 100")
        if len(counts) < 12:
            blockers.append(f"only {len(counts)} player-visible values")
        if counts and max(counts.values()) / len(keys) > 0.40:
            blockers.append("more than 40% of countries show the same value")
        if top20_distinct < 8:
            blockers.append(f"only {top20_distinct} distinct player-visible values among the global Top 20")
        if not quality.auto_qualified:
            blockers.append(f"quality gate did not auto-qualify ({quality.notes})")
        if candidate.rule.description.rstrip().endswith("."):
            blockers.append("player description ends with a period")
        rows.append({
            "id": importer.category_id(candidate),
            "title": candidate.rule.title,
            "description": candidate.rule.description,
            "coverage": len(observations),
            "visible_value_count": len(counts),
            "largest_visible_tie_share": round(max(counts.values()) / len(keys), 4) if counts else 1,
            "top20_distinct_visible_values": top20_distinct,
            "quality_score": quality.score,
            "quality_auto_qualified": quality.auto_qualified,
            "pass": not blockers,
            "blockers": blockers,
        })

    pass_count = sum(row["pass"] for row in rows)
    result = {
        "subject": "natural-and-physical-geography",
        "minimum_required": args.minimum_pass,
        "candidate_count": len(rows),
        "pass_count": pass_count,
        "decision": "GO_TO_STAGING" if pass_count >= args.minimum_pass else "STOP_BELOW_MINIMUM",
        "rules": [
            "one peer-reviewed globally consistent 1991–2020 climate classification",
            "at least 180 current GeoStats countries",
            "at least 12 distinct player-visible values",
            "no value held by more than 40% of covered countries",
            "at least 8 distinct player-visible values among the global Top 20",
            "current quality gate including climatology publication freshness",
            "no terminal period in player description",
        ],
        "categories": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if pass_count >= args.minimum_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
