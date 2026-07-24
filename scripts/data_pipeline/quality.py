from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import mean

from .models import IndicatorRule, QualityResult, SourceObservation

QUALITY_STANDARD_VERSION = "geostats-v13.1-strict"


def _average_ranks(values: dict[str, float], *, high: bool) -> dict[str, float]:
    ordered = sorted(values.items(), key=lambda item: item[1], reverse=high)
    ranks: dict[str, float] = {}
    index = 0
    while index < len(ordered):
        end = index + 1
        while end < len(ordered) and math.isclose(ordered[end][1], ordered[index][1], rel_tol=1e-12, abs_tol=1e-12):
            end += 1
        average_rank = (index + 1 + end) / 2
        for position in range(index, end):
            ranks[ordered[position][0]] = average_rank
        index = end
    return ranks


def _spearman(left: dict[str, float], right: dict[str, float], *, high: bool) -> float | None:
    shared = sorted(set(left) & set(right))
    if len(shared) < 20:
        return None
    left_ranks = _average_ranks({key: left[key] for key in shared}, high=high)
    right_ranks = _average_ranks({key: right[key] for key in shared}, high=high)
    xs = [left_ranks[key] for key in shared]
    ys = [right_ranks[key] for key in shared]
    x_bar = mean(xs)
    y_bar = mean(ys)
    numerator = sum((x - x_bar) * (y - y_bar) for x, y in zip(xs, ys))
    denominator = math.sqrt(sum((x - x_bar) ** 2 for x in xs) * sum((y - y_bar) ** 2 for y in ys))
    return numerator / denominator if denominator else None


def _clustering_score(values: list[float]) -> int:
    if len(values) < 10:
        return 0
    rounded = [round(value, 8) for value in values]
    most_common_share = Counter(rounded).most_common(1)[0][1] / len(rounded)
    unique_share = len(set(rounded)) / len(rounded)
    base = 100 - max(0, most_common_share - 0.08) * 170
    if unique_share < 0.25:
        base -= (0.25 - unique_share) * 120
    return max(0, min(100, round(base)))


def score_observations(rule: IndicatorRule, observations: list[SourceObservation]) -> QualityResult:
    by_year: dict[int, dict[str, SourceObservation]] = defaultdict(dict)
    for observation in observations:
        current = by_year[observation.data_year].get(observation.country_iso3)
        if current is None or _evidence_weight(observation.evidence_status) > _evidence_weight(current.evidence_status):
            by_year[observation.data_year][observation.country_iso3] = observation

    if not by_year:
        return QualityResult(0, "candidate", False, None, 0, None, 0, None, None, 0, 0, rule.evidence_tier, "No usable country observations.")

    now_year = datetime.now(timezone.utc).year
    latest_year = max(by_year)
    common_year = max(by_year, key=lambda year: (min(len(by_year[year]), 150) * 3 - max(0, now_year - year) * 8, year))
    common_rows = list(by_year[common_year].values())
    coverage = len(common_rows)
    all_countries = {row.country_iso3 for rows in by_year.values() for row in rows.values()}
    country_coverage = len(all_countries)

    official = sum(row.evidence_status == "official" for row in common_rows)
    modeled = sum(row.evidence_status in {"modeled", "estimated"} for row in common_rows)
    known = sum(row.evidence_status != "unknown" for row in common_rows)
    official_share = official / known if known else None
    modeled_share = modeled / known if known else rule.modeled_hint

    clustering = _clustering_score([row.value for row in common_rows])
    previous_years = sorted((year for year in by_year if year < common_year), reverse=True)
    stability_raw: float | None = None
    for previous_year in previous_years[:3]:
        stability_raw = _spearman(
            {iso3: row.value for iso3, row in by_year[common_year].items()},
            {iso3: row.value for iso3, row in by_year[previous_year].items()},
            high=rule.ranking_direction == "high",
        )
        if stability_raw is not None:
            break
    stability = 65 if stability_raw is None else max(0, min(100, round((stability_raw + 1) * 50)))

    age = max(0, now_year - common_year)
    coverage_component = min(35, round(35 * coverage / 160))
    freshness_component = max(0, 20 - age * 4)
    evidence_component = {"A": 15, "B": 11, "C": 6}[rule.evidence_tier]
    distribution_component = round(clustering * 0.12)
    stability_component = round(stability * 0.10)
    product_component = round(rule.recognizability_score * 0.04 + rule.specificity_score * 0.03)
    score = max(0, min(100, coverage_component + freshness_component + evidence_component + distribution_component + stability_component + product_component))

    auto_qualified = (
        score >= 82
        and coverage >= rule.min_coverage
        and age <= 5
        and clustering >= 55
        and stability >= 45
        and rule.specificity_score >= 60
        and rule.recognizability_score >= 60
    )
    review_status = "needs_review" if auto_qualified else "candidate"
    notes = (
        f"Common-year gate: {common_year}; {coverage} countries; "
        f"clustering {clustering}; stability {stability}; evidence {rule.evidence_tier}. "
        "Imports remain quarantined until administrator approval."
    )
    return QualityResult(
        score=score,
        review_status=review_status,
        auto_qualified=auto_qualified,
        common_year=common_year,
        common_year_coverage=coverage,
        latest_year=latest_year,
        country_coverage=country_coverage,
        official_share=official_share,
        modeled_share=modeled_share,
        clustering_score=clustering,
        stability_score=stability,
        evidence_tier=rule.evidence_tier,
        notes=notes,
    )


def _evidence_weight(status: str) -> int:
    return {"official": 4, "estimated": 3, "modeled": 2, "unknown": 1}.get(status, 0)
