from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable, Mapping

from .countries import UN_COUNTRY_ISO3
from .models import CandidateDefinition, QualityResult, SourceObservation

VALIDATION_VERSION = "geostats-v14.2-source-integrity-v1"


@dataclass(frozen=True)
class IntegrityResult:
    status: str
    common_year: int | None
    expected_count: int
    stored_count: int
    compared_count: int
    value_mismatch_count: int
    ranking_mismatch_count: int
    source_checksum: str | None
    stored_checksum: str | None
    metadata_checks: dict[str, bool]
    failure_reason: str | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def rpc_payload(self, category_id: str, *, run_id: int | None = None) -> dict[str, Any]:
        return {
            "p_category_id": category_id,
            "p_status": self.status,
            "p_validation_version": VALIDATION_VERSION,
            "p_common_year": self.common_year,
            "p_expected_count": self.expected_count,
            "p_stored_count": self.stored_count,
            "p_compared_count": self.compared_count,
            "p_value_mismatch_count": self.value_mismatch_count,
            "p_ranking_mismatch_count": self.ranking_mismatch_count,
            "p_source_checksum": self.source_checksum,
            "p_stored_checksum": self.stored_checksum,
            "p_metadata_checks": self.metadata_checks,
            "p_failure_reason": self.failure_reason,
            "p_details": self.details,
            "p_validation_run_id": run_id,
        }


def _finite(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _snapshot(observations: Iterable[SourceObservation | Mapping[str, Any]], year: int) -> tuple[dict[str, float], list[str]]:
    values: dict[str, float] = {}
    conflicts: list[str] = []
    for observation in observations:
        if isinstance(observation, SourceObservation):
            iso3 = observation.country_iso3
            data_year = observation.data_year
            raw_value = observation.value
        else:
            iso3 = str(observation.get("country_iso3") or observation.get("countryId") or "")
            data_year = observation.get("data_year") or observation.get("year")
            raw_value = observation.get("value")
        try:
            data_year = int(data_year)
        except (TypeError, ValueError):
            continue
        value = _finite(raw_value)
        if data_year != year or not iso3 or value is None:
            continue
        if iso3 in values and not values_match(values[iso3], value):
            conflicts.append(iso3)
        values[iso3] = value
    return values, sorted(set(conflicts))


def snapshot_checksum(values: Mapping[str, float]) -> str:
    canonical = "\n".join(f"{iso3}\t{format(float(value), '.17g')}" for iso3, value in sorted(values.items()))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def values_match(expected: float, actual: float) -> bool:
    tolerance = max(1e-9, abs(expected) * 1e-9)
    return abs(expected - actual) <= tolerance


def competition_ranks(values: Mapping[str, float], direction: str) -> dict[str, int]:
    ordered = sorted(values.items(), key=lambda item: ((-item[1]) if direction == "high" else item[1], item[0]))
    ranks: dict[str, int] = {}
    previous: float | None = None
    previous_rank = 0
    for index, (iso3, value) in enumerate(ordered, start=1):
        rank = previous_rank if previous is not None and values_match(previous, value) else index
        ranks[iso3] = rank
        previous = value
        previous_rank = rank
    return ranks


def _query_contains(query: Any, token: str) -> bool:
    if not token:
        return False
    return token.lower() in json.dumps(query, sort_keys=True, default=str).lower()


def source_identity_checks(source_slug: str, candidate: CandidateDefinition) -> dict[str, bool]:
    metadata = candidate.metadata
    query = metadata.get("source_query") or {}
    official_name = str(candidate.source_indicator_name or "").strip()
    checks: dict[str, bool] = {
        "source_url_present": bool(candidate.source_url),
        "source_indicator_present": bool(candidate.source_indicator_code),
        "official_series_name_present": bool(official_name),
        "source_query_present": bool(query),
    }
    # These catalog-driven sources select an official series by matching the
    # provider's current series name. Re-run those independent selector
    # predicates during validation so a stale or incorrectly resolved code is
    # quarantined even when its numeric values were imported consistently.
    if source_slug in {"who", "unesco", "ilostat"}:
        checks["official_name_matches_required_concept"] = all(
            re.search(pattern, official_name, re.IGNORECASE) is not None
            for pattern in candidate.rule.include
        )
        checks["official_name_avoids_excluded_concepts"] = not any(
            re.search(pattern, official_name, re.IGNORECASE) is not None
            for pattern in candidate.rule.exclude
        )
    if source_slug in {"worldbank", "who", "unesco", "ilostat"}:
        checks["query_identifies_series"] = _query_contains(query, candidate.source_indicator_code)
    elif source_slug == "comtrade":
        checks.update({
            "query_identifies_commodity": bool(query.get("cmdCode") or query.get("commodity_codes")),
            "exports_flow_selected": str(query.get("flowCode") or query.get("flow_code") or "").upper() in {"X", "EXPORT", "EXPORTS"},
            "world_partner_selected": str(query.get("partnerCode") or query.get("partner_code") or "") in {"0", "World", "WORLD"},
        })
    elif source_slug == "eia":
        checks.update({
            "query_identifies_product": bool(query.get("productId") or metadata.get("product_id")),
            "query_identifies_activity": bool(query.get("activityId") or metadata.get("activity_id")),
            "single_unit_selected": bool(metadata.get("selected_unit")),
        })
    elif source_slug == "unhcr":
        checks.update({
            "endpoint_identified": bool(query.get("endpoint") or metadata.get("endpoint")),
            "country_dimension_identified": bool(query.get("dimension") or metadata.get("dimension")),
            "value_field_identified": bool(query.get("value_field") or metadata.get("value_keys")),
        })
    elif source_slug == "naturalearth":
        checks.update({
            "derivation_method_present": bool(metadata.get("derivation_method")),
            "derivation_version_present": bool(metadata.get("derivation_version")),
            "input_dataset_present": bool(metadata.get("input_datasets")),
            "layer_identified": bool(query.get("layer")),
        })
    return checks


def validate_category_snapshot(
    *,
    source_slug: str,
    source_organization: str,
    source_dataset: str,
    category_id: str,
    candidate: CandidateDefinition,
    quality: QualityResult,
    source_observations: list[SourceObservation],
    expected_category_row: Mapping[str, Any],
    stored_category: Mapping[str, Any],
    stored_observations: list[Mapping[str, Any]],
) -> IntegrityResult:
    common_year = quality.common_year
    if common_year is None:
        return IntegrityResult(
            status="failed", common_year=None, expected_count=0, stored_count=0, compared_count=0,
            value_mismatch_count=0, ranking_mismatch_count=0, source_checksum=None, stored_checksum=None,
            metadata_checks={"common_year_present": False}, failure_reason="No common comparison year was selected.",
        )

    expected, expected_conflicts = _snapshot(source_observations, common_year)
    stored, stored_conflicts = _snapshot(stored_observations, common_year)
    source_checksum = snapshot_checksum(expected)
    stored_checksum = snapshot_checksum(stored)
    source_checks = source_identity_checks(source_slug, candidate)

    stored_metadata = stored_category.get("metadata") if isinstance(stored_category.get("metadata"), Mapping) else {}
    expected_query = expected_category_row.get("source_query") or {}
    stored_query = stored_category.get("source_query") or {}
    metadata_checks: dict[str, bool] = {
        "category_id": str(stored_category.get("id")) == category_id,
        "source_organization": str(stored_category.get("source_organization")) == source_organization,
        "source_dataset": str(stored_category.get("source_dataset")) == source_dataset,
        "source_indicator_code": str(stored_category.get("source_indicator_code")) == candidate.source_indicator_code,
        "official_series_name": str(stored_metadata.get("source_indicator_name") or "") == str(candidate.source_indicator_name),
        "source_query": json.dumps(stored_query, sort_keys=True, default=str) == json.dumps(expected_query, sort_keys=True, default=str),
        "unit": str(stored_category.get("unit")) == str(expected_category_row.get("unit")),
        "ranking_direction": str(stored_category.get("ranking_direction")) == candidate.rule.ranking_direction,
        "common_year": int(stored_category.get("common_year") or 0) == common_year,
        "declared_coverage": int(stored_category.get("common_year_coverage") or 0) == len(expected),
        "quality_coverage": quality.common_year_coverage == len(expected),
        "minimum_coverage": len(expected) >= candidate.rule.min_coverage,
        "country_universe_size": len(expected) <= len(UN_COUNTRY_ISO3),
        "source_country_universe": all(iso3 in UN_COUNTRY_ISO3 for iso3 in expected),
        "stored_country_universe": all(iso3 in UN_COUNTRY_ISO3 for iso3 in stored),
        "source_snapshot_unique": not expected_conflicts,
        "stored_snapshot_unique": not stored_conflicts,
        "source_records_present": all(
            observation.source_record_id and observation.source_url
            for observation in source_observations if observation.data_year == common_year
        ),
        **source_checks,
    }

    expected_ids = set(expected)
    stored_ids = set(stored)
    missing = sorted(expected_ids - stored_ids)
    extra = sorted(stored_ids - expected_ids)
    mismatches = [
        {"country": iso3, "source": expected[iso3], "stored": stored[iso3]}
        for iso3 in sorted(expected_ids & stored_ids)
        if not values_match(expected[iso3], stored[iso3])
    ]
    expected_ranks = competition_ranks(expected, candidate.rule.ranking_direction)
    stored_ranks = competition_ranks(stored, candidate.rule.ranking_direction)
    ranking_mismatches = [
        {"country": iso3, "source_rank": expected_ranks[iso3], "stored_rank": stored_ranks[iso3]}
        for iso3 in sorted(expected_ids & stored_ids)
        if expected_ranks[iso3] != stored_ranks[iso3]
    ]

    metadata_failures = sorted(key for key, passed in metadata_checks.items() if not passed)
    failure_parts: list[str] = []
    if metadata_failures:
        failure_parts.append("metadata checks failed: " + ", ".join(metadata_failures))
    if missing:
        failure_parts.append(f"{len(missing)} official countries missing from storage")
    if extra:
        failure_parts.append(f"{len(extra)} unexpected stored countries")
    if mismatches:
        failure_parts.append(f"{len(mismatches)} value mismatches")
    if ranking_mismatches:
        failure_parts.append(f"{len(ranking_mismatches)} ranking mismatches")
    if source_checksum != stored_checksum:
        failure_parts.append("source and stored snapshot checksums differ")

    details = {
        "categoryId": category_id,
        "sourceIndicatorCode": candidate.source_indicator_code,
        "sourceIndicatorName": candidate.source_indicator_name,
        "commonYear": common_year,
        "missingCountries": missing[:50],
        "extraCountries": extra[:50],
        "valueMismatchExamples": mismatches[:25],
        "rankingMismatchExamples": ranking_mismatches[:25],
        "sourceDuplicateCountries": expected_conflicts[:25],
        "storedDuplicateCountries": stored_conflicts[:25],
        "sourceQuery": candidate.metadata.get("source_query") or {},
    }
    return IntegrityResult(
        status="verified" if not failure_parts else "failed",
        common_year=common_year,
        expected_count=len(expected),
        stored_count=len(stored),
        compared_count=len(expected_ids & stored_ids),
        value_mismatch_count=len(mismatches) + len(missing) + len(extra),
        ranking_mismatch_count=len(ranking_mismatches),
        source_checksum=source_checksum,
        stored_checksum=stored_checksum,
        metadata_checks=metadata_checks,
        failure_reason="; ".join(failure_parts) if failure_parts else None,
        details=details,
    )


def unable_to_verify(reason: str, *, common_year: int | None = None, details: dict[str, Any] | None = None) -> IntegrityResult:
    return IntegrityResult(
        status="unable_to_verify", common_year=common_year, expected_count=0, stored_count=0,
        compared_count=0, value_mismatch_count=0, ranking_mismatch_count=0,
        source_checksum=None, stored_checksum=None, metadata_checks={}, failure_reason=reason[:1800],
        details=details or {},
    )
