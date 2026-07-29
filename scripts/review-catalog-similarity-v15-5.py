#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from statistics import mean
from typing import Iterable

from data_pipeline.supabase import SupabaseWarehouse


STOP_WORDS = {
    "highest", "lowest", "largest", "smallest", "most", "least", "rate", "share",
    "total", "average", "annual", "country", "countries", "people", "population",
    "per", "of", "the", "a", "an", "and", "or", "to", "from", "by", "in", "with",
}

OUTCOME_RANK = {"daily": 4, "random": 3, "rewrite": 2, "quarantined": 1, "retired": 0}


@dataclass(frozen=True)
class Category:
    id: str
    title: str
    source: str
    outcome: str
    broad_domain: str
    knowledge_cluster: str
    strategy_family: str
    clarity: int
    wonkiness: int
    coverage: int
    distinct_values: int
    tie_share: float
    quality: float
    common_year: int


def normalized_tokens(value: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", value.lower())
    aliases = {
        "refugees": "refugee", "originating": "origin", "applications": "application",
        "exports": "export", "imports": "import", "forested": "forest",
        "lakes": "lake", "rivers": "river", "glaciers": "glacier",
    }
    return {
        aliases.get(token, token)
        for token in tokens
        if len(token) > 2 and token not in STOP_WORDS
    }


def token_similarity(first: str, second: str) -> float:
    a, b = normalized_tokens(first), normalized_tokens(second)
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    jaccard = intersection / len(a | b)
    containment = intersection / max(1, min(len(a), len(b)))
    sequence = SequenceMatcher(None, first.lower(), second.lower()).ratio()
    return max(jaccard, containment * 0.9, sequence * 0.8)


def average_ranks(values: dict[str, float]) -> dict[str, float]:
    ordered = sorted(values.items(), key=lambda item: item[1])
    result: dict[str, float] = {}
    index = 0
    while index < len(ordered):
        end = index + 1
        while end < len(ordered) and ordered[end][1] == ordered[index][1]:
            end += 1
        rank = (index + 1 + end) / 2.0
        for position in range(index, end):
            result[ordered[position][0]] = rank
        index = end
    return result


def pearson(first: list[float], second: list[float]) -> float | None:
    if len(first) != len(second) or len(first) < 3:
        return None
    first_mean = mean(first)
    second_mean = mean(second)
    numerator = sum((a - first_mean) * (b - second_mean) for a, b in zip(first, second))
    first_denominator = math.sqrt(sum((a - first_mean) ** 2 for a in first))
    second_denominator = math.sqrt(sum((b - second_mean) ** 2 for b in second))
    denominator = first_denominator * second_denominator
    return numerator / denominator if denominator else None


def spearman(first: dict[str, float], second: dict[str, float]) -> tuple[int, float | None]:
    countries = sorted(set(first) & set(second))
    if len(countries) < 3:
        return len(countries), None
    first_ranks = average_ranks({country: first[country] for country in countries})
    second_ranks = average_ranks({country: second[country] for country in countries})
    return len(countries), pearson(
        [first_ranks[country] for country in countries],
        [second_ranks[country] for country in countries],
    )


def top_set(values: dict[str, float], limit: int) -> set[str]:
    return {country for country, _ in sorted(values.items(), key=lambda item: item[1], reverse=True)[:limit]}


def overlap_ratio(first: set[str], second: set[str]) -> float:
    denominator = max(1, min(len(first), len(second)))
    return len(first & second) / denominator


def is_total_share_pair(first: Category, second: Category) -> bool:
    text = f"{first.title} {second.title}".lower()
    return (
        ("share" in text or "coverage" in text or "covered" in text or "forested" in text)
        and any(token in text for token in ("area", "total", "most forest", "lake", "glacier", "water"))
    )


def category_priority(category: Category) -> tuple[float, ...]:
    return (
        OUTCOME_RANK.get(category.outcome, 0),
        category.clarity,
        -category.wonkiness,
        min(category.coverage, 195),
        category.distinct_values,
        -category.tie_share,
        category.quality,
        -len(category.title),
    )


def choose_preferred(first: Category, second: Category) -> tuple[Category, Category]:
    return (first, second) if category_priority(first) >= category_priority(second) else (second, first)


def recommendation(
    first: Category,
    second: Category,
    correlation: float | None,
    top10: float,
    top30: float,
    title_similarity: float,
) -> tuple[str, str]:
    same_cluster = first.knowledge_cluster == second.knowledge_cluster
    same_family = first.strategy_family == second.strategy_family
    if correlation is None:
        return "keep_both", "Insufficient overlapping observations for a correlation decision."

    strong_rank_overlap = abs(correlation) >= 0.92 and top30 >= 0.60
    strong_concept_overlap = title_similarity >= 0.52 or same_family

    if same_cluster and strong_rank_overlap and strong_concept_overlap:
        preferred, alternate = choose_preferred(first, second)
        if is_total_share_pair(first, second):
            code = "random_b" if preferred.id == first.id else "random_a"
            return code, (
                f"Highly correlated total/share alternatives (Spearman {correlation:.3f}); "
                f"keep {preferred.title!r} Daily-ready and move {alternate.title!r} to Random-only."
            )
        code = "retire_b" if preferred.id == first.id else "retire_a"
        return code, (
            f"Same knowledge cluster with highly overlapping rankings (Spearman {correlation:.3f}, "
            f"top-30 overlap {top30:.0%}); prefer {preferred.title!r}."
        )

    if same_cluster and (abs(correlation) >= 0.85 or title_similarity >= 0.70 or top10 >= 0.70):
        return "review", (
            f"Shared knowledge cluster with material overlap (Spearman {correlation:.3f}, "
            f"title similarity {title_similarity:.3f}, top-10 overlap {top10:.0%})."
        )

    if same_family and abs(correlation) >= 0.90 and top30 >= 0.55:
        return "review", (
            f"Shared strategy family and highly similar rankings (Spearman {correlation:.3f})."
        )

    return "keep_both", "The measures remain meaningfully distinct despite any statistical correlation."


def parse_category(row: dict[str, object]) -> Category:
    return Category(
        id=str(row["id"]),
        title=str(row.get("title") or ""),
        source=str(row.get("source_organization") or ""),
        outcome=str(row.get("editorial_outcome") or "quarantined"),
        broad_domain=str(row.get("broad_domain") or "other"),
        knowledge_cluster=str(row.get("knowledge_cluster") or row.get("family") or "other"),
        strategy_family=str(row.get("strategy_family") or row.get("knowledge_cluster") or "other"),
        clarity=int(row.get("clarity_score") or 0),
        wonkiness=int(row.get("wonkiness_score") or 0),
        coverage=int(row.get("coverage") or row.get("common_year_coverage") or 0),
        distinct_values=int(row.get("distinct_display_values") or 0),
        tie_share=float(row.get("largest_display_tie_share") or 1.0),
        quality=float(row.get("quality_score") or 0),
        common_year=int(row.get("common_year") or 0),
    )


def chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def main() -> int:
    parser = argparse.ArgumentParser(description="Review GeoStats categories for correlated and redundant gameplay.")
    parser.add_argument("--apply", action="store_true", help="Apply only high-confidence retire/random recommendations.")
    parser.add_argument("--output", default="catalog-similarity-report-v15.5.csv")
    parser.add_argument("--minimum-overlap", type=int, default=50)
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.")

    warehouse = SupabaseWarehouse(url, key, timeout=180)
    categories = [parse_category(row) for row in warehouse.list_catalog_review_v15_5()]
    active = [category for category in categories if category.outcome in {"daily", "random", "rewrite"} and category.common_year]
    year_by_category = {category.id: category.common_year for category in active}

    observations: dict[str, dict[str, float]] = defaultdict(dict)
    for group in chunks([category.id for category in active], 50):
        for row in warehouse.list_category_observations_paged(group, year_by_category=year_by_category):
            category_id = str(row.get("category_id") or "")
            country = str(row.get("country_iso3") or "")
            try:
                value = float(row["value"])
            except (KeyError, TypeError, ValueError):
                continue
            if category_id and country and math.isfinite(value):
                observations[category_id][country] = value

    groups: dict[str, list[Category]] = defaultdict(list)
    for category in active:
        groups[category.knowledge_cluster].append(category)

    pairs: list[dict[str, object]] = []
    for cluster_categories in groups.values():
        if len(cluster_categories) < 2:
            continue
        ordered = sorted(cluster_categories, key=lambda category: category.id)
        for index, first in enumerate(ordered):
            for second in ordered[index + 1:]:
                overlap, correlation = spearman(observations[first.id], observations[second.id])
                if overlap < args.minimum_overlap:
                    continue
                top10 = overlap_ratio(top_set(observations[first.id], 10), top_set(observations[second.id], 10))
                top30 = overlap_ratio(top_set(observations[first.id], 30), top_set(observations[second.id], 30))
                title_sim = token_similarity(first.title, second.title)
                decision, rationale = recommendation(first, second, correlation, top10, top30, title_sim)
                pairs.append({
                    "category_id_a": first.id,
                    "category_id_b": second.id,
                    "overlapping_countries": overlap,
                    "spearman_correlation": round(correlation, 5) if correlation is not None else None,
                    "top_10_overlap": round(top10, 5),
                    "top_30_overlap": round(top30, 5),
                    "title_similarity": round(title_sim, 5),
                    "shared_knowledge_cluster": first.knowledge_cluster == second.knowledge_cluster,
                    "shared_strategy_family": first.strategy_family == second.strategy_family,
                    "recommendation": decision,
                    "rationale": rationale,
                    "calculated_at": None,
                })

    warehouse.upsert_similarity_pairs_v15_5([
        {key: value for key, value in row.items() if key != "calculated_at" or value is not None}
        for row in pairs
    ])

    if args.apply:
        by_id = {category.id: category for category in categories}
        for row in pairs:
            recommendation_code = str(row["recommendation"])
            if recommendation_code not in {"retire_a", "retire_b", "random_a", "random_b"}:
                continue
            target_key = "category_id_a" if recommendation_code.endswith("_a") else "category_id_b"
            other_key = "category_id_b" if target_key == "category_id_a" else "category_id_a"
            target = str(row[target_key])
            preferred = str(row[other_key])
            current = by_id[target]
            if current.outcome == "retired":
                continue
            next_outcome = "retired" if recommendation_code.startswith("retire") else "random"
            warehouse.patch_catalog_editorial_v15_5(target, {
                "editorial_outcome": next_outcome,
                "preferred_category_id": preferred,
                "decision_reason": row["rationale"],
                "decision_source": "v15.5 correlation review",
            })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "category_id_a", "category_id_b", "overlapping_countries", "spearman_correlation",
        "top_10_overlap", "top_30_overlap", "title_similarity", "shared_knowledge_cluster",
        "shared_strategy_family", "recommendation", "rationale",
    ]
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows({field: row.get(field) for field in fields} for row in pairs)

    summary = defaultdict(int)
    for row in pairs:
        summary[str(row["recommendation"])] += 1
    print(json.dumps({
        "categories_reviewed": len(active),
        "pairs_calculated": len(pairs),
        "recommendations": dict(sorted(summary.items())),
        "applied": args.apply,
        "report": str(output),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
