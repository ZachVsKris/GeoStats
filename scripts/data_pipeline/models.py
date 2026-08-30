from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

EvidenceTier = Literal["A", "B", "C"]
ReviewStatus = Literal["candidate", "needs_review", "approved", "rejected"]


@dataclass(frozen=True)
class IndicatorRule:
    """A player-facing concept and the rules used to find it in a source catalog."""

    key: str
    title: str
    description: str
    family: str
    icon: str
    unit: str
    value_type: Literal["total", "per_capita", "percentage", "rate", "index", "other"]
    ranking_direction: Literal["high", "low"]
    include: tuple[str, ...]
    prefer: tuple[str, ...] = ()
    exclude: tuple[str, ...] = ()
    min_coverage: int = 100
    evidence_tier: EvidenceTier = "B"
    modeled_hint: float | None = None
    source_priority: int = 20
    specificity_score: int = 90
    recognizability_score: int = 90
    allowed_dimension_codes: tuple[str, ...] = ()
    # Player-quality metadata. Importers may override these; the v14 governance
    # pass recalculates and fail-closes anything that is subjective, unclear, or
    # impossible to reproduce.
    plain_language_description: str | None = None
    technical_definition: str | None = None
    unit_explanation: str | None = None
    understandability_score: int = 85
    fun_score: int = 80
    objective_status: Literal["objective", "composite", "subjective", "uncertain"] = "objective"
    # A climatology is a published stable normal period, not a stale annual
    # observation. Its publication year controls source freshness while the
    # observation year continues to identify the period end shown to players.
    temporal_scope: Literal["annual", "climatology", "historical"] = "annual"
    publication_year: int | None = None

    @property
    def canonical_slug(self) -> str:
        return self.key


@dataclass(frozen=True)
class CandidateDefinition:
    rule: IndicatorRule
    source_indicator_code: str
    source_indicator_name: str
    source_url: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SourceObservation:
    country_iso3: str
    country_name: str
    data_year: int
    value: float
    source_url: str
    source_record_id: str | None = None
    evidence_status: Literal["official", "estimated", "modeled", "unknown"] = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class QualityResult:
    score: int
    review_status: ReviewStatus
    auto_qualified: bool
    common_year: int | None
    common_year_coverage: int
    latest_year: int | None
    country_coverage: int
    official_share: float | None
    modeled_share: float | None
    clustering_score: int
    stability_score: int
    evidence_tier: EvidenceTier
    notes: str
