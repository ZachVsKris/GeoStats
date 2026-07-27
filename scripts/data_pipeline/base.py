from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Iterable

from .canonical_countries import canonical_country_name
from .descriptions import plain_language_description
from .governance import GOVERNANCE_VERSION, evaluate_governance
from .integrity import VALIDATION_VERSION, validate_category_snapshot
from .models import CandidateDefinition, SourceObservation
from .quality import QUALITY_STANDARD_VERSION, score_observations
from .supabase import SupabaseWarehouse


class WarehouseImporter(ABC):
    source_organization: str
    source_dataset: str
    source_slug: str

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        self.warehouse = warehouse
        self.dry_run = dry_run

    @abstractmethod
    def discover(self) -> list[CandidateDefinition]:
        raise NotImplementedError

    @abstractmethod
    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        raise NotImplementedError

    @abstractmethod
    def category_id(self, candidate: CandidateDefinition) -> str:
        raise NotImplementedError

    def run(
        self,
        *,
        limit: int | None = None,
        only_keys: set[str] | None = None,
        offset: int = 0,
        scan_limit: int | None = None,
        target_successes: int | None = None,
    ) -> dict[str, object]:
        """Import candidates while keeping broad catalog runs observable and resumable.

        ``limit`` remains the backwards-compatible maximum number of candidates to scan.
        ``scan_limit`` is the preferred explicit name. ``target_successes`` lets broad
        catalog importers keep scanning past stale or empty indicators until they have
        inserted the requested number of usable candidates.
        """
        candidates = self.discover()
        discovered_count = len(candidates)
        if only_keys:
            candidates = [candidate for candidate in candidates if candidate.rule.key in only_keys]
        if offset > 0:
            candidates = candidates[offset:]
        effective_scan_limit = scan_limit if scan_limit is not None else limit
        if effective_scan_limit is not None:
            candidates = candidates[:effective_scan_limit]

        run_id: int | None = None
        if not self.dry_run:
            if self.warehouse is None:
                raise RuntimeError("A Supabase warehouse is required unless --dry-run is used.")
            run_id = self.warehouse.create_import_run(
                self.source_organization,
                self.source_dataset,
                {
                    "quality_standard": QUALITY_STANDARD_VERSION,
                    "candidate_count": len(candidates),
                    "candidates_discovered_before_filters": discovered_count,
                    "offset": offset,
                    "scan_limit": effective_scan_limit,
                    "target_successes": target_successes,
                    "started_by": "generic-importer-framework-v14.2",
                },
            )

        category_count = 0
        observation_count = 0
        attempted_count = 0
        successful_keys: list[str] = []
        failures: list[dict[str, str]] = []
        stopped_reason: str | None = None
        validation_verified = 0
        validation_failed = 0
        try:
            for index, candidate in enumerate(candidates, start=1):
                if target_successes is not None and category_count >= target_successes:
                    break
                attempted_count += 1
                print(f"[{index}/{len(candidates)}] {candidate.rule.title} ({candidate.source_indicator_code})", flush=True)
                try:
                    observations = self.fetch_observations(candidate)
                    quality = score_observations(candidate.rule, observations)
                    governance = evaluate_governance(self.source_slug, candidate, quality)
                    category_id = self.category_id(candidate)
                    row = self.build_category_row(candidate, quality, governance, category_id)
                    if not self.dry_run:
                        assert self.warehouse is not None
                        row = self.preserve_editorial_state(
                            row,
                            self.warehouse.get_category_state(category_id),
                            auto_qualified=governance.auto_approved,
                        )
                    if self.dry_run:
                        print(
                            f"  dry-run: {len(observations)} rows; common year {quality.common_year}; "
                            f"coverage {quality.common_year_coverage}; score {quality.score}; {quality.review_status}",
                            flush=True,
                        )
                    else:
                        assert self.warehouse is not None
                        self.warehouse.upsert_category(row)
                        self.warehouse.clear_category_observations(category_id)
                        observation_count += self.warehouse.upsert_observations(
                            self.build_observation_rows(category_id, observations, run_id)
                        )
                        self.warehouse.link_canonical(self.canonical_payload(candidate, category_id))
                        stored_category = self.warehouse.get_category_integrity_state(category_id)
                        if not stored_category:
                            raise RuntimeError(f"Stored category {category_id} disappeared before integrity validation.")
                        if quality.common_year is None:
                            stored_observations = []
                        else:
                            stored_observations = self.warehouse.get_category_observations(category_id, quality.common_year)
                        integrity = validate_category_snapshot(
                            source_slug=self.source_slug,
                            source_organization=self.source_organization,
                            source_dataset=self.source_dataset,
                            category_id=category_id,
                            candidate=candidate,
                            quality=quality,
                            source_observations=observations,
                            expected_category_row=row,
                            stored_category=stored_category,
                            stored_observations=stored_observations,
                        )
                        self.warehouse.record_category_validation(category_id, integrity)
                        if integrity.status == "verified":
                            validation_verified += 1
                        else:
                            validation_failed += 1
                            failures.append({"key": candidate.rule.key, "error": f"Source integrity: {integrity.failure_reason}"[:1200]})
                            print(f"  quarantined: {integrity.failure_reason}", flush=True)
                    category_count += 1
                    successful_keys.append(candidate.rule.key)
                except Exception as error:  # keep a long source import moving while preserving failure details
                    failures.append({"key": candidate.rule.key, "error": str(error)[:1200]})
                    print(f"  failed: {error}", flush=True)
                    if getattr(error, "stop_import", False):
                        stopped_reason = str(error)[:1200]
                        print("  import paused; completed categories are saved and the next run can resume.", flush=True)
                        break

            if not self.dry_run and self.warehouse is not None and run_id is not None:
                final_status = "completed" if stopped_reason else ("failed" if failures and category_count == 0 else "completed")
                self.warehouse.finish_import_run(
                    run_id,
                    status=final_status,
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    categories_processed=category_count,
                    observations_inserted=observation_count,
                    error_message=(failures[0]["error"] if final_status == "failed" else None),
                    details={
                        "quality_standard": QUALITY_STANDARD_VERSION,
                        "candidate_count": len(candidates),
                        "candidates_discovered_before_filters": discovered_count,
                        "attempted_count": attempted_count,
                        "successful_count": category_count,
                        "target_successes": target_successes,
                        "target_reached": target_successes is None or category_count >= target_successes,
                        "successful_keys": successful_keys,
                        "failures": failures,
                        "stopped_reason": stopped_reason,
                        "source_integrity_version": VALIDATION_VERSION,
                        "source_integrity_verified": validation_verified,
                        "source_integrity_failed": validation_failed,
                    },
                )
                if final_status == "completed":
                    self.warehouse.mark_source_success(self.source_slug)
        except Exception as error:
            if not self.dry_run and self.warehouse is not None and run_id is not None:
                self.warehouse.finish_import_run(
                    run_id,
                    status="failed",
                    completed_at=datetime.now(timezone.utc).isoformat(),
                    categories_processed=category_count,
                    observations_inserted=observation_count,
                    error_message=str(error)[:2000],
                    details={
                        "candidates_discovered_before_filters": discovered_count,
                        "attempted_count": attempted_count,
                        "successful_count": category_count,
                        "target_successes": target_successes,
                        "successful_keys": successful_keys,
                        "failures": failures,
                        "source_integrity_version": VALIDATION_VERSION,
                        "source_integrity_verified": validation_verified,
                        "source_integrity_failed": validation_failed,
                    },
                )
            raise

        return {
            "candidates_discovered": discovered_count,
            "candidates_selected": len(candidates),
            "candidates_attempted": attempted_count,
            "categories_processed": category_count,
            "observations_inserted": observation_count,
            "target_successes": target_successes,
            "target_reached": target_successes is None or category_count >= target_successes,
            "successful_keys": successful_keys,
            "failures": failures,
            "stopped_reason": stopped_reason,
            "source_integrity_verified": validation_verified,
            "source_integrity_failed": validation_failed,
        }


    @staticmethod
    def preserve_editorial_state(
        row: dict[str, object],
        existing: dict[str, object] | None,
        *,
        auto_qualified: bool,
    ) -> dict[str, object]:
        """Keep human decisions across re-imports without bypassing the current quality gate."""
        if not existing:
            return row
        previous = str(existing.get("review_status") or "")
        if previous == "rejected":
            return {
                **row,
                "review_status": "rejected",
                "enabled": False,
                "eligible_daily": False,
                "auto_qualified": False,
                "duplicate_status": "not_eligible",
                "auto_decision_reason": "Remains disabled because an administrator manually rejected this category.",
            }
        if previous == "approved" and auto_qualified:
            # Preserve the editorial decision, but keep the category unavailable until
            # the freshly imported official snapshot passes source-integrity validation.
            return {**row, "review_status": "approved", "enabled": False, "eligible_daily": False}
        if previous == "approved" and not auto_qualified:
            # A source change can revoke automatic eligibility; the old approval is not silently retained.
            return {**row, "review_status": "needs_review", "enabled": False, "eligible_daily": False}
        return row

    def build_category_row(self, candidate, quality, governance, category_id: str) -> dict[str, object]:
        rule = candidate.rule
        player_description = plain_language_description(
            rule.title,
            rule.unit,
            rule.plain_language_description or rule.description,
        )
        return {
            "id": category_id,
            "title": rule.title,
            "short_title": rule.title,
            "description": player_description,
            "icon": rule.icon,
            "unit": rule.unit,
            "value_type": rule.value_type,
            "ranking_direction": rule.ranking_direction,
            "family": rule.family,
            "source_organization": self.source_organization,
            "source_dataset": self.source_dataset,
            "source_indicator_code": candidate.source_indicator_code,
            "source_url": candidate.source_url,
            "source_page_url": candidate.metadata.get("source_page_url") or candidate.source_url,
            "exact_query_url": candidate.metadata.get("exact_query_url"),
            "download_url": candidate.metadata.get("download_url"),
            "api_url": candidate.metadata.get("api_url"),
            "dataset_release": candidate.metadata.get("dataset_release"),
            "retrieved_at": candidate.metadata.get("retrieved_at") or datetime.now(timezone.utc).isoformat(),
            "license_name": candidate.metadata.get("license_name"),
            "license_url": candidate.metadata.get("license_url"),
            "source_query": candidate.metadata.get("source_query") or {},
            "derivation_method": candidate.metadata.get("derivation_method"),
            "derivation_version": candidate.metadata.get("derivation_version"),
            "input_datasets": candidate.metadata.get("input_datasets") or [],
            "plain_language_description": player_description,
            "technical_definition": rule.technical_definition or candidate.source_indicator_name,
            "unit_explanation": rule.unit_explanation or rule.unit,
            "understandability_score": max(0, min(100, int(rule.understandability_score))),
            "fun_score": max(0, min(100, int(rule.fun_score))),
            "objective_status": rule.objective_status,
            "validation_status": "pending",
            "validation_version": VALIDATION_VERSION,
            "validation_reason": "Awaiting end-to-end comparison with the official source snapshot.",
            "validation_mismatch_count": 0,
            "validation_ranking_mismatch_count": 0,
            # Imports are always fail-closed. record_category_validation() and the
            # governance RPC can enable a verified, approved category afterward.
            "enabled": False,
            "eligible_daily": False,
            "minimum_year": 2022,
            "latest_available_year": quality.latest_year,
            "country_coverage": quality.country_coverage,
            "quality_score": quality.score,
            "review_status": "approved" if governance.auto_approved else quality.review_status,
            "evidence_tier": quality.evidence_tier,
            "auto_qualified": governance.auto_approved,
            "common_year": quality.common_year,
            "common_year_coverage": quality.common_year_coverage,
            "official_observation_share": quality.official_share,
            "modeled_observation_share": quality.modeled_share,
            "clustering_score": quality.clustering_score,
            "stability_score": quality.stability_score,
            "methodology_notes": f"{quality.notes} {governance.provenance_reason}",
            "quality_standard_version": QUALITY_STANDARD_VERSION,
            "provenance_status": governance.provenance_status,
            "provenance_class": governance.provenance_class,
            "provenance_reason": governance.provenance_reason,
            "methodology_url": governance.methodology_url,
            "independent_validation": governance.independent_validation,
            "government_assertion_risk": governance.government_assertion_risk,
            "concept_group": governance.concept_group,
            "governance_priority": governance.source_priority,
            "governance_version": GOVERNANCE_VERSION,
            "duplicate_status": "pending",
            "auto_decision_reason": governance.auto_decision_reason,
            "recognizability_score": rule.recognizability_score,
            "specificity_score": rule.specificity_score,
            "canonical_match_status": "linked",
            "canonical_match_score": 100,
            "metadata": {
                **candidate.metadata,
                "source_indicator_name": candidate.source_indicator_name,
                "canonical_slug": rule.canonical_slug,
                "import_framework": "v14.2",
                "sourceIntegrityVersion": VALIDATION_VERSION,
                "plainLanguageDescription": player_description,
                "technicalDefinition": rule.technical_definition or candidate.source_indicator_name,
                "unitExplanation": rule.unit_explanation or rule.unit,
                "understandabilityScore": max(0, min(100, int(rule.understandability_score))),
                "funScore": max(0, min(100, int(rule.fun_score))),
                "objectiveStatus": rule.objective_status,
                "governance_version": GOVERNANCE_VERSION,
                "concept_group": governance.concept_group,
            },
        }

    def build_observation_rows(
        self, category_id: str, observations: Iterable[SourceObservation], run_id: int | None
    ) -> Iterable[dict[str, object]]:
        for observation in observations:
            yield {
                "category_id": category_id,
                "country_iso3": observation.country_iso3,
                "country_name": canonical_country_name(observation.country_iso3, observation.country_name),
                "data_year": observation.data_year,
                "value": observation.value,
                "source_url": observation.source_url,
                "source_record_id": observation.source_record_id,
                "metadata": {
                    **observation.metadata,
                    "source_country_name": observation.country_name,
                    "evidence_status": observation.evidence_status,
                    "import_run_id": run_id,
                },
            }

    def canonical_payload(self, candidate: CandidateDefinition, category_id: str) -> dict[str, object]:
        rule = candidate.rule
        player_description = plain_language_description(
            rule.title,
            rule.unit,
            rule.plain_language_description or rule.description,
        )
        return {
            "p_slug": rule.canonical_slug,
            "p_title": rule.title,
            "p_description": rule.description,
            "p_family": rule.family,
            "p_icon": rule.icon,
            "p_unit": rule.unit,
            "p_value_type": rule.value_type,
            "p_ranking_direction": rule.ranking_direction,
            "p_source_category_id": category_id,
            "p_priority": rule.source_priority,
            "p_role": "candidate",
        }
