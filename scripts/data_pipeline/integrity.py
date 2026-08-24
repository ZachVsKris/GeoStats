from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable, Mapping

from .countries import UN_COUNTRY_ISO3
from .models import CandidateDefinition, QualityResult, SourceObservation

VALIDATION_VERSION = "geostats-v16.2.1-source-integrity-v3"


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
    # Normalize harmless floating-point serialization drift while retaining far
    # more precision than any player-facing value. Importers that derive spatial
    # values also round before storage, so source and stored snapshots hash alike.
    canonical = "\n".join(f"{iso3}\t{format(float(value), '.12g')}" for iso3, value in sorted(values.items()))
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




def _normalized_unit(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("²", "2").replace("$", "dollar")
    text = re.sub(r"u\.?s\.?", "us", text)
    text = re.sub(r"square\s+kilomet(?:er|re)s?|sq\.?\s*km|km2", "km2", text)
    text = re.sub(r"metric\s+tons?", "tonnes", text)
    if re.fullmatch(r"an|animal(?:s)?|head(?:s)?", text):
        text = "animals"
    text = re.sub(r"\s+", " ", text)
    return text


def _unit_signature(*values: Any) -> str:
    text = " ".join(_normalized_unit(value) for value in values if value not in (None, ""))
    if re.search(r"us dollar.*per capita|usd.*per capita|dollar.*per person|usd/person", text):
        return "usd-per-person"
    if re.search(r"us dollar|usd|current us", text):
        return "usd"
    if re.search(r"people.*per.*km2|people/km2|population density", text):
        return "people-per-km2"
    if re.search(r"per 100(?: people| population)?", text):
        return "per-100"
    if re.search(r"per 1,?000", text):
        return "per-1000"
    if re.search(r"per 100,?000", text):
        return "per-100000"
    if re.search(r"%|percent|percentage|share of", text):
        return "percent"
    if re.search(r"kg.*ha|kilogram.*hectare", text):
        return "kg-per-ha"
    if re.search(r"km2|land area", text):
        return "km2"
    if re.search(r"tonnes?|tons?", text):
        return "tonnes"
    if re.search(r"years?", text):
        return "years"
    if re.search(r"\banimals?\b|\bheads?\b|^an$", text):
        return "animals"
    if re.search(r"people|persons?", text):
        return "people"
    return _normalized_unit(values[0] if values else "")


def units_compatible(stored_unit: Any, expected_unit: Any, official_name: Any = "", official_unit: Any = "") -> bool:
    """Compare display units by meaning rather than provider-specific wording.

    A generic placeholder such as ``reported value`` is not considered compatible
    when the official series name or unit identifies a concrete measure. This keeps
    player-facing unit mistakes blocked while allowing harmless wording differences
    such as ``current US$`` versus ``USD`` or ``sq. km`` versus ``km²``.
    """
    stored = _unit_signature(stored_unit)
    expected = _unit_signature(expected_unit)
    official = _unit_signature(official_unit, official_name)
    generic = {"", "reported value", "rate", "value", "other"}
    if official not in generic:
        return stored == official or (expected == official and stored == expected)
    if stored == expected and stored not in generic:
        return True
    if stored in generic and expected in generic:
        return True
    return _normalized_unit(stored_unit) == _normalized_unit(expected_unit)

def official_units_compatible(stored_unit: Any, expected_unit: Any, official_name: Any = "") -> bool:
    """Compare raw provider-unit metadata without inventing a missing raw unit.

    Many World Bank catalog records leave the raw unit field blank even though the
    series name makes the player display unit obvious. Two blank provider-unit fields
    therefore match; player-facing unit correctness is checked separately by ``unit``.
    """
    stored_raw = _normalized_unit(stored_unit)
    expected_raw = _normalized_unit(expected_unit)
    if not stored_raw and not expected_raw:
        return True
    return units_compatible(stored_unit, expected_unit, official_name, expected_unit)


def _query_contains(query: Any, token: str) -> bool:
    if not token:
        return False
    return token.lower() in json.dumps(query, sort_keys=True, default=str).lower()


def _world_partner_selected(value: Any) -> bool:
    # UN Comtrade's World partner is code 0. Older GeoStats rows stored the
    # same selector as a display label ("0 (World)"). Treat those two exact
    # representations as equivalent without accepting arbitrary partner values.
    normalized = " ".join(str(value or "").strip().upper().split())
    return normalized in {"0", "WORLD", "0 (WORLD)"}


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
    if source_slug in {"worldbank", "worldbankexpansion", "who", "unesco", "ilostat"}:
        checks["query_identifies_series"] = _query_contains(query, candidate.source_indicator_code)
    elif source_slug == "worldbankhistory":
        code_match = re.search(r"^MILESTONE:([^:]+):", candidate.source_indicator_code)
        underlying_code = code_match.group(1) if code_match else ""
        checks.update({
            "query_identifies_series": bool(underlying_code) and _query_contains(query, underlying_code),
            "threshold_identified": query.get("threshold") is not None,
            "consecutive_crossing_rule": "Y-1" in str(query.get("crossing_rule") or ""),
        })
    elif source_slug == "comtrade":
        checks.update({
            "query_identifies_commodity": bool(query.get("cmdCode") or query.get("commodity_codes")),
            "exports_flow_selected": str(query.get("flowCode") or query.get("flow_code") or "").upper() in {"X", "EXPORT", "EXPORTS"},
            "world_partner_selected": _world_partner_selected(query.get("partnerCode") or query.get("partner_code")),
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
    elif source_slug == "unmembership":
        checks.update({
            "member_state_scope": str(query.get("population") or "").lower() == "current member states",
            "admission_field": str(query.get("field") or "").lower() == "date of admission",
        })
    elif source_slug == "constitute":
        checks.update({
            "constitutions_endpoint": str(query.get("endpoint") or "").lower() == "service/constitutions",
            "in_force_selected": query.get("in_force") is True,
            "historic_excluded": query.get("historic") is False,
            "year_enacted_selected": str(query.get("field") or "").lower() == "year_enacted",
        })
    elif source_slug == "ipu":
        field = str(query.get("field") or "").lower()
        checks.update({
            "ipu_endpoint": str(query.get("endpoint") or "").lower() == "v1/parliaments",
            "ipu_field_identified": field in {"date_of_independence", "suffrage.right_to_vote"},
            "universal_national_filter": field != "suffrage.right_to_vote" or (
                str(query.get("national_or_local") or "").lower() == "national"
                and str(query.get("restricted_or_unrestricted") or "").lower() == "universal"
                and str(query.get("selection") or "").lower() == "earliest"
            ),
            "post_1940_scope": field != "date_of_independence" or "after 1940" in str(query.get("scope") or "").lower(),
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
        "official_series_name": str(stored_metadata.get("source_indicator_name") or "").strip() == str(candidate.source_indicator_name).strip(),
        "official_unit": official_units_compatible(
            stored_metadata.get("official_unit"),
            candidate.metadata.get("official_unit"),
            candidate.source_indicator_name,
        ),
        "source_query": json.dumps(stored_query, sort_keys=True, default=str) == json.dumps(expected_query, sort_keys=True, default=str),
        "unit": units_compatible(
            stored_category.get("unit"),
            expected_category_row.get("unit"),
            candidate.source_indicator_name,
            candidate.metadata.get("official_unit"),
        ),
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
    source_identity_keys = {
        "source_organization", "source_dataset", "source_indicator_code", "official_series_name",
        "source_url_present", "source_indicator_present", "official_series_name_present",
        "source_query_present", "query_identifies_series", "query_identifies_commodity",
        "exports_flow_selected", "world_partner_selected", "query_identifies_product",
        "query_identifies_activity", "single_unit_selected", "endpoint_identified",
        "country_dimension_identified", "value_field_identified", "derivation_method_present",
        "derivation_version_present", "input_dataset_present", "layer_identified",
        "member_state_scope", "admission_field", "constitutions_endpoint", "in_force_selected", "historic_excluded", "year_enacted_selected",
        "official_name_matches_required_concept", "official_name_avoids_excluded_concepts",
    }
    coverage_keys = {
        "common_year", "declared_coverage", "quality_coverage", "minimum_coverage",
        "country_universe_size", "source_country_universe", "stored_country_universe",
        "source_snapshot_unique", "stored_snapshot_unique", "source_records_present",
    }
    source_identity_failures = [key for key in metadata_failures if key in source_identity_keys]
    coverage_check_failures = [key for key in metadata_failures if key in coverage_keys]
    metadata_only_failures = [
        key for key in metadata_failures
        if key not in source_identity_keys and key not in coverage_keys
    ]
    failure_buckets = {
        "sourceIdentity": source_identity_failures,
        "metadata": metadata_only_failures,
        "coverage": {
            "checks": coverage_check_failures,
            "expected": len(expected),
            "stored": len(stored),
            "missingCount": len(missing),
            "extraCount": len(extra),
        },
        "values": {"mismatchCount": len(mismatches)},
        "rankings": {"mismatchCount": len(ranking_mismatches)},
        "checksum": {"matches": source_checksum == stored_checksum},
    }
    failure_types: list[str] = []
    if source_identity_failures:
        failure_types.append("source_identity")
    if metadata_only_failures:
        failure_types.append("metadata")
    if coverage_check_failures or missing or extra:
        failure_types.append("coverage")
    if mismatches:
        failure_types.append("values")
    if ranking_mismatches:
        failure_types.append("rankings")
    checksum_only_warning = (
        source_checksum != stored_checksum
        and not source_identity_failures
        and not metadata_only_failures
        and not coverage_check_failures
        and not missing and not extra and not mismatches and not ranking_mismatches
    )
    if source_checksum != stored_checksum and not checksum_only_warning:
        failure_types.append("checksum")

    failure_parts: list[str] = []
    if source_identity_failures:
        failure_parts.append("source identity checks failed: " + ", ".join(source_identity_failures))
    if metadata_only_failures:
        failure_parts.append("metadata checks failed: " + ", ".join(metadata_only_failures))
    if coverage_check_failures:
        failure_parts.append("coverage checks failed: " + ", ".join(coverage_check_failures))
    if missing:
        failure_parts.append(f"{len(missing)} official countries missing from storage")
    if extra:
        failure_parts.append(f"{len(extra)} unexpected stored countries")
    if mismatches:
        failure_parts.append(f"{len(mismatches)} value mismatches")
    if ranking_mismatches:
        failure_parts.append(f"{len(ranking_mismatches)} ranking mismatches")
    if source_checksum != stored_checksum and not checksum_only_warning:
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
        "failureTypes": failure_types,
        "failureBuckets": failure_buckets,
        "warnings": (["Snapshot checksums differ, but normalized values, coverage and rankings match."] if checksum_only_warning else []),
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
