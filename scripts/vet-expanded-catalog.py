#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
from collections import defaultdict
from itertools import combinations

from data_pipeline.supabase import SupabaseWarehouse

EXPANSION_SOURCES = {
    "Pew Research Center", "Smithsonian GVP", "USGS", "ESA WorldCover",
    "HydroSHEDS", "Global Elevation", "UNESCO World Heritage Centre",
    "FAO AQUASTAT", "USGS Minerals", "FAO Fisheries",
}
JARGON = re.compile(r"\betc\.|\bn\.e\.c\.|\bLULUCF\b|Fruit Primary|constant 20\d\d|current LCU", re.I)
BAD_FAO = re.compile(
    r"yield|kg/ha|tonnes?/ha|per hectare|area harvested|harvested area|"
    r"carcass|slaughter|per animal|output per animal|producing animals|"
    r"milk animals|laying hens?",
    re.I,
)


def tokens(value: object) -> set[str]:
    stop = {"highest", "lowest", "largest", "most", "share", "total", "country"}
    return {v for v in re.findall(r"[a-z0-9]+", str(value).lower()) if len(v) > 2 and v not in stop}


def jaccard(a: object, b: object) -> float:
    left, right = tokens(a), tokens(b)
    return len(left & right) / len(left | right) if left | right else 0.0


def ranks(values: dict[str, float]) -> dict[str, int]:
    ordered = sorted(values.items(), key=lambda item: (-item[1], item[0]))
    return {key: index + 1 for index, (key, _) in enumerate(ordered)}


def rank_correlation(a: dict[str, float], b: dict[str, float]) -> float | None:
    shared = sorted(set(a) & set(b))
    if len(shared) < 30:
        return None
    left = ranks({key: a[key] for key in shared})
    right = ranks({key: b[key] for key in shared})
    n = len(shared)
    d2 = sum((left[key] - right[key]) ** 2 for key in shared)
    return 1 - (6 * d2) / (n * (n * n - 1)) if n > 1 else None


def evaluate(
    row: dict[str, object],
    observations: dict[str, float],
    best_duplicate: tuple[str, float] | None = None,
) -> tuple[str, int, str]:
    title = str(row.get("effective_title") or row.get("title") or "")
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    description = str(
        metadata.get("boardDescription")
        or row.get("plain_language_description")
        or row.get("description")
        or ""
    )
    reasons: list[str] = []
    recommendation = "approve"
    score = 100

    if row.get("validation_status") != "verified":
        recommendation = "quarantine_data"
        reasons.append("Source-integrity validation is not verified.")
        score -= 45
    if not row.get("hard_gate_ready"):
        recommendation = "quarantine_data"
        reasons.append("One or more hard integrity gates are blocked.")
        score -= 25

    coverage = int(row.get("common_year_coverage") or 0)
    if coverage < 60:
        recommendation = "quarantine_data"
        reasons.append(f"Only {coverage} countries have common-year data.")
        score -= 30

    values = list(observations.values())
    unique = len(set(values))
    tie_share = 1 - (unique / len(values)) if values else 1
    if tie_share > 0.35:
        recommendation = "quarantine_data"
        reasons.append(f"{tie_share:.0%} of values are tied after deduplication.")
        score -= 25

    if len(title) > 58 or len(title.split()) > 9 or JARGON.search(title):
        if recommendation == "approve":
            recommendation = "rewrite"
        reasons.append("Player title is too long or contains source jargon.")
        score -= 15
    if not description or len(description) > 110 or description.endswith(("...", "…")):
        if recommendation == "approve":
            recommendation = "rewrite"
        reasons.append("Board description needs a short complete sentence.")
        score -= 12

    if row.get("source_organization") == "FAOSTAT" and BAD_FAO.search(
        f"{title} {description} {row.get('unit') or ''}"
    ):
        recommendation = "retire"
        reasons.append("FAOSTAT yield/productivity/input measure is outside the approved policy.")
        score = 0

    if best_duplicate:
        recommendation = "duplicate"
        reasons.append(f"Near-duplicate of {best_duplicate[0]} (similarity {best_duplicate[1]:.2f}).")
        score = min(score, 35)

    if not reasons:
        reasons.append("Passed automated integrity, coverage, tie, clarity, and uniqueness checks.")
    return recommendation, max(0, min(100, score)), " ".join(reasons)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="expansion")
    parser.add_argument("--limit", type=int, default=5000)
    args = parser.parse_args()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set Supabase secrets.")
    warehouse = SupabaseWarehouse(url, key)

    all_rows = warehouse._request(
        "GET",
        f"category_review_queue_v15?select=*&limit={args.limit}",
    ) or []
    if args.source == "expansion":
        target_rows = [row for row in all_rows if row.get("source_organization") in EXPANSION_SOURCES]
    elif args.source != "all":
        target_rows = [row for row in all_rows if row.get("source_organization") == args.source]
    else:
        target_rows = list(all_rows)

    # Compare expansion candidates against the entire viable catalog, not merely
    # against other newly imported rows. This is essential for catching a new
    # physical, cultural, trade, or production category that duplicates an
    # existing World Bank, FAOSTAT, Natural Earth, or other concept.
    comparison_rows = [
        row for row in all_rows
        if row.get("editorial_status") != "rejected"
        and (row.get("computed_playable_v15") or row.get("editorial_status") in {"approved", "pending"})
    ]
    observation_ids = sorted({str(row["id"]) for row in comparison_rows} | {str(row["id"]) for row in target_rows})
    year_by = {
        str(row["id"]): int(row.get("common_year") or 0)
        for row in all_rows
        if row.get("common_year")
    }
    observation_rows = warehouse.list_category_observations_paged(
        observation_ids,
        year_by_category=year_by,
    )
    observations: dict[str, dict[str, float]] = defaultdict(dict)
    for observation in observation_rows:
        observations[str(observation["category_id"])][str(observation["country_iso3"])] = float(observation["value"])

    duplicates: dict[str, tuple[str, float, float | None, float]] = {}
    for target in target_rows:
        target_id = str(target["id"])
        best: tuple[str, float, float | None, float] | None = None
        for other in comparison_rows:
            other_id = str(other["id"])
            if other_id == target_id or target.get("ranking_direction") != other.get("ranking_direction"):
                continue
            title_similarity = jaccard(
                target.get("effective_title") or target.get("title"),
                other.get("effective_title") or other.get("title"),
            )
            correlation = rank_correlation(observations[target_id], observations[other_id])
            same_group = bool(
                target.get("effective_semantic_group")
                and target.get("effective_semantic_group") == other.get("effective_semantic_group")
            )
            duplicate_match = title_similarity >= 0.72 or (same_group and correlation is not None and correlation >= 0.97)
            if not duplicate_match:
                continue
            combined = max(title_similarity, correlation or 0.0)
            # Prefer a match against an already playable category when scores tie.
            priority = combined + (0.01 if other.get("computed_playable_v15") else 0.0)
            if best is None or priority > best[3]:
                best = (other_id, title_similarity, correlation, priority)
        if best:
            duplicates[target_id] = best

    results = []
    for row in target_rows:
        category_id = str(row["id"])
        duplicate = duplicates.get(category_id)
        duplicate_for_evaluate = (duplicate[0], max(duplicate[1], duplicate[2] or 0.0)) if duplicate else None
        recommendation, score, reason = evaluate(
            row, observations[category_id], duplicate_for_evaluate
        )
        values = list(observations[category_id].values())
        tie_share = 1 - len(set(values)) / max(1, len(values))
        results.append({
            "category_id": category_id,
            "recommendation": recommendation,
            "vetting_score": score,
            "reason": reason,
            "possible_duplicate_of": duplicate[0] if duplicate else None,
            "title_similarity": duplicate[1] if duplicate else None,
            "rank_correlation": duplicate[2] if duplicate else None,
            "coverage": row.get("common_year_coverage"),
            "tie_share": tie_share,
            "vetting_version": "geostats-v15.8-auto-vetting-v2",
        })

    if results:
        warehouse._request(
            "POST",
            "category_auto_vetting_v15_8?on_conflict=category_id",
            results,
            prefer="resolution=merge-duplicates,return=minimal",
        )
    print({
        "categories_vetted": len(results),
        "recommendations": {
            value: sum(1 for row in results if row["recommendation"] == value)
            for value in {"approve", "rewrite", "duplicate", "quarantine_data", "retire"}
        },
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
