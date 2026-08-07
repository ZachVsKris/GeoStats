"""Provenance and source-classification policy for GeoStats v14.

The importer may identify a numerically strong candidate, but v14 still sends unseen
concepts to a disabled editorial queue and applies separate credibility, objectivity,
verifiability, clarity, fun, and duplicate gates before play.
"""
from __future__ import annotations

from dataclasses import dataclass

from .models import CandidateDefinition, QualityResult

GOVERNANCE_VERSION = "geostats-v14-provenance-player-quality-v1"


@dataclass(frozen=True)
class GovernanceDecision:
    provenance_status: str
    provenance_class: str
    provenance_reason: str
    methodology_url: str | None
    independent_validation: bool
    government_assertion_risk: str
    concept_group: str
    source_priority: int
    auto_approved: bool
    auto_decision_reason: str


SOURCE_POLICIES: dict[str, dict[str, object]] = {
    "pewreligion": {
        "provenance_class": "independent_demographic_estimate",
        "reason": "Pew synthesizes censuses, surveys, population registers and demographic models under a published methodology.",
        "methodology_url": "https://www.pewresearch.org/religion/2025/06/09/how-the-global-religious-landscape-changed-from-2010-to-2020-methodology/",
        "independent_validation": True, "risk": "low", "priority": 12,
    },
    "faostatfbs": {
        "provenance_class": "internationally_harmonized_food_balance_statistics",
        "reason": "FAOSTAT Food Balances reconcile national food production, trade and utilization into comparable food-supply estimates.",
        "methodology_url": "https://www.fao.org/faostat/en/#definitions",
        "independent_validation": True, "risk": "low", "priority": 11,
    },
    "worldbankexpansion": {
        "provenance_class": "internationally_harmonized_tourism_and_migration_statistics",
        "reason": "World Development Indicators distribute documented tourism and UN Population Division migration series with stable indicator identifiers.",
        "methodology_url": "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/",
        "independent_validation": True, "risk": "low", "priority": 11,
    },
    "smithsoniangvp": {
        "provenance_class": "official_scientific_inventory",
        "reason": "Smithsonian GVP maintains the authoritative scientific inventory of Holocene volcanoes.",
        "methodology_url": "https://volcano.si.edu/",
        "independent_validation": True, "risk": "none", "priority": 12,
    },
    "usgs": {
        "provenance_class": "instrumental_seismic_catalog",
        "reason": "USGS earthquake categories are derived from a fixed-period instrumental event catalog.",
        "methodology_url": "https://earthquake.usgs.gov/fdsnws/event/1/",
        "independent_validation": True, "risk": "none", "priority": 12,
    },
    "worldbank": {
        "provenance_class": "internationally_harmonized_development_statistics",
        "reason": "World Development Indicators compile documented national and international statistical series with indicator-level metadata and stable API identifiers.",
        "methodology_url": "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/",
        "independent_validation": True,
        "risk": "low",
        "priority": 11,
    },
    "who": {
        "provenance_class": "internationally_harmonized_model_or_health_system_measure",
        "reason": "WHO GHO indicators use documented international methods, standardized health-system inputs, surveys, and/or transparent modeled estimates rather than unsupported political assertions.",
        "methodology_url": "https://www.who.int/data/gho/info/gho-odata-api",
        "independent_validation": True,
        "risk": "low",
        "priority": 10,
    },
    "unesco": {
        "provenance_class": "internationally_harmonized_education_statistics",
        "reason": "UNESCO UIS applies documented definitions, validation, and comparability controls to administrative and survey-based education statistics.",
        "methodology_url": "https://databrowser.uis.unesco.org/resources",
        "independent_validation": True,
        "risk": "low",
        "priority": 12,
    },
    "ilostat": {
        "provenance_class": "internationally_harmonized_labor_survey_or_model",
        "reason": "ILOSTAT harmonizes labor-force surveys, administrative records, and modeled estimates using published international standards.",
        "methodology_url": "https://ilostat.ilo.org/resources/concepts-and-definitions/",
        "independent_validation": True,
        "risk": "low",
        "priority": 10,
    },
    "climate": {
        "provenance_class": "independent_geospatial_measurement",
        "reason": "Natural Earth categories are calculated consistently from a single global geometry dataset rather than country-submitted claims.",
        "methodology_url": "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/",
        "independent_validation": True,
        "risk": "none",
        "priority": 15,
    },
    "naturalearth": {
        "provenance_class": "reproducible_geospatial_derivation",
        "reason": "Natural Earth candidates are calculated from versioned global vector layers with the exact layer, scale, clipping rule, and formula preserved by GeoStats.",
        "methodology_url": "https://www.naturalearthdata.com/downloads/10m-physical-vectors/",
        "independent_validation": True,
        "risk": "none",
        "priority": 15,
    },
    "comtrade": {
        "provenance_class": "transactional_customs_records_with_un_harmonization",
        "reason": "UN Comtrade is built from customs transaction records standardized by the United Nations; records are auditable and not merely leadership self-report.",
        "methodology_url": "https://unstats.un.org/unsd/trade/eg-imts/IMTS%202010%20(English).pdf",
        "independent_validation": True,
        "risk": "low",
        "priority": 8,
    },
    "eia": {
        "provenance_class": "measured_energy_administrative_statistics",
        "reason": "EIA international energy series use documented production, generation, trade, and consumption statistics with standardized units and validation.",
        "methodology_url": "https://www.eia.gov/opendata/documentation.php",
        "independent_validation": True,
        "risk": "low",
        "priority": 9,
    },
    "unmembership": {
        "provenance_class": "official_international_membership_record",
        "reason": "The United Nations publishes the official admission date for each Member State.",
        "methodology_url": "https://www.un.org/en/about-us/about-un-membership",
        "independent_validation": True, "risk": "none", "priority": 15,
    },
    "constitute": {
        "provenance_class": "comparative_constitutional_record",
        "reason": "Constitute publishes structured current constitutional records with explicit in-force status and enactment-year metadata from the Comparative Constitutions Project.",
        "methodology_url": "https://www.constituteproject.org/content/data",
        "independent_validation": True, "risk": "low", "priority": 14,
    },
    "unhcr": {
        "provenance_class": "operational_registration_and_case_records",
        "reason": "UNHCR displacement statistics are compiled from operational registration, asylum, and protection systems with published definitions and quality controls.",
        "methodology_url": "https://www.unhcr.org/refugee-statistics/methodology/",
        "independent_validation": True,
        "risk": "low",
        "priority": 7,
    },    "unescoheritage": {
        "provenance_class": "official_international_cultural_inventory",
        "reason": "UNESCO's World Heritage List is the official inventory of properties inscribed by the World Heritage Committee.",
        "methodology_url": "https://whc.unesco.org/en/criteria/",
        "independent_validation": True, "risk": "low", "priority": 12,
    },
    "aquastat": {
        "provenance_class": "internationally_harmonized_water_statistics",
        "reason": "FAO AQUASTAT standardizes country water-resource, use and irrigation statistics with published definitions.",
        "methodology_url": "https://www.fao.org/aquastat/en/overview/methodology/",
        "independent_validation": True, "risk": "low", "priority": 11,
    },
    "usgsminerals": {
        "provenance_class": "official_geological_mine_production_statistics",
        "reason": "USGS Mineral Commodity Summaries compile documented country mine-production estimates using commodity-specific methods.",
        "methodology_url": "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries",
        "independent_validation": True, "risk": "low", "priority": 12,
    },
    "faofisheries": {
        "provenance_class": "internationally_harmonized_fisheries_production_statistics",
        "reason": "FAO FishStat harmonizes national capture and aquaculture production under published international definitions.",
        "methodology_url": "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en",
        "independent_validation": True, "risk": "low", "priority": 11,
    },
}

# Cross-source concepts that should have only one playable representative.
CONCEPT_ALIASES: dict[str, str] = {
    "highest-life-expectancy": "life-expectancy",
    "lowest-infant-mortality": "infant-mortality",
    "lowest-road-traffic-death-rate": "road-fatality-rate",
    "highest-health-spending-per-person": "health-spending-per-person",
    "lowest-unemployment": "unemployment-rate",
    "highest-education-spending-gdp": "education-spending-share-gdp",
    "highest-safe-drinking-water": "drinking-water-access",
    "highest-safe-sanitation": "safely-managed-sanitation-access",
    "highest-wage-employment-share": "employment-status-share",
    "highest-self-employment-share": "employment-status-share",
}

# Indicators with methodology or comparability concerns stay quarantined even when
# their numeric quality is high. This is intentionally small and explicit.
BLOCKED_KEYS: dict[tuple[str, str], str] = {
    ("who", "highest-birth-registration"): "Birth-registration completeness can depend heavily on uneven national administrative systems and is not auto-approved without an indicator-specific audit.",
}


def evaluate_governance(
    source_slug: str,
    candidate: CandidateDefinition,
    quality: QualityResult,
) -> GovernanceDecision:
    policy = SOURCE_POLICIES.get(source_slug)
    key = candidate.rule.key
    concept_group = CONCEPT_ALIASES.get(key, key)
    if policy is None:
        return GovernanceDecision(
            provenance_status="uncertain",
            provenance_class="unclassified",
            provenance_reason="No approved source-level methodology policy exists for this importer.",
            methodology_url=None,
            independent_validation=False,
            government_assertion_risk="unknown",
            concept_group=concept_group,
            source_priority=candidate.rule.source_priority,
            auto_approved=False,
            auto_decision_reason="Quarantined because provenance is not classified.",
        )

    blocked_reason = BLOCKED_KEYS.get((source_slug, key))
    provenance_status = "blocked" if blocked_reason else "approved"
    reason = blocked_reason or str(policy["reason"])
    independently_validated = bool(policy["independent_validation"])
    auto_approved = bool(
        quality.auto_qualified
        and provenance_status == "approved"
        and independently_validated
        and candidate.rule.evidence_tier in {"A", "B"}
    )
    if auto_approved:
        decision_reason = "Automatically approved: numerical quality, provenance, and documentation gates passed. Duplicate arbitration may still supersede it."
    elif provenance_status != "approved":
        decision_reason = f"Quarantined by provenance policy: {reason}"
    elif candidate.rule.evidence_tier not in {"A", "B"}:
        decision_reason = "Quarantined because the evidence tier is below the automatic-approval threshold."
    else:
        decision_reason = "Quarantined because the numerical quality gate did not pass."

    return GovernanceDecision(
        provenance_status=provenance_status,
        provenance_class=str(policy["provenance_class"]),
        provenance_reason=reason,
        methodology_url=str(policy["methodology_url"]),
        independent_validation=independently_validated,
        government_assertion_risk=str(policy["risk"]),
        concept_group=concept_group,
        source_priority=int(policy["priority"]),
        auto_approved=auto_approved,
        auto_decision_reason=decision_reason,
    )
