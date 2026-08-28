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
    "unsdg": {
        "provenance_class": "official_un_global_sdg_series",
        "reason": "The UN Statistics Division Global SDG Indicators Database publishes internationally harmonized series supplied by designated custodian agencies, with release, unit, dimension, and data-nature metadata.",
        "methodology_url": "https://unstats.un.org/sdgs/metadata/",
        "independent_validation": True,
        "risk": "low",
        "priority": 12,
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
    "ipu": {
        "provenance_class": "official_interparliamentary_historical_data",
        "reason": "IPU Parline is the Inter-Parliamentary Union's global reference database for national parliament and country-history fields.",
        "methodology_url": "https://data.ipu.org/data-dictionary/",
        "independent_validation": True, "risk": "low", "priority": 12,
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
    },    "unwpp": {"provenance_class":"un_population_estimates","reason":"UN Population Division WPP 2024 provides one harmonized demographic estimate framework; v16.2.6 pins 2023 and excludes projections.","methodology_url":"https://population.un.org/wpp/Publications/Files/WPP2024_Methodology-Report_Final.pdf","independent_validation":True,"risk":"low","priority":4},
    "worldbankclimate": {"provenance_class":"observed_gridded_climatology","reason":"World Bank CCKP distributes CRU TS observed historical country aggregations; v16.2.6 uses one 1991-2020 climatology.","methodology_url":"https://climateknowledgeportal.worldbank.org/metadata","independent_validation":True,"risk":"none","priority":5},
    "imfweo": {"provenance_class":"internationally_harmonized_macro_statistics","reason":"IMF WEO standardizes national macroeconomic series; v16.2.6 uses only a pinned historical year and never forecasts.","methodology_url":"https://www.imf.org/en/Publications/WEO/weo-database/2026/April/select-aggr-data","independent_validation":True,"risk":"low","priority":4},
    "unescoich": {"provenance_class":"official_international_cultural_inventory","reason":"UNESCO DataHub is the official structured inventory for Intangible Cultural Heritage elements.","methodology_url":"https://ich.unesco.org/en/lists","independent_validation":True,"risk":"none","priority":6},
    "noaatsunami": {"provenance_class":"official_historical_hazard_catalog","reason":"NOAA/NCEI maintains the Global Historical Tsunami Database; GeoStats counts only source events with positive event-validity classification.","methodology_url":"https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-data","independent_validation":True,"risk":"none","priority":7},
    "whoghed": {"provenance_class":"official_health_expenditure_accounts","reason":"WHO GHED harmonizes health-expenditure accounts under the System of Health Accounts framework; v16.2.6 imports only an official bulk release.","methodology_url":"https://apps.who.int/nha/database/DocumentationCentre/en","independent_validation":True,"risk":"low","priority":5},
    "undesamigrant": {"provenance_class":"un_international_migrant_stock_estimates","reason":"UN DESA Population Division International Migrant Stock 2024 provides official harmonized origin/destination stock estimates.","methodology_url":"https://www.un.org/development/desa/pd/content/international-migrant-stock","independent_validation":True,"risk":"low","priority":5},
    "wtoservices": {"provenance_class":"official_international_services_trade_statistics","reason":"WTO commercial-services statistics provide annual exports/imports across more than 200 economies under common services classifications.","methodology_url":"https://www.wto.org/english/res_e/statis_e/tradeserv_stat_e.htm","independent_validation":True,"risk":"low","priority":5},
    "untourismdirect": {"provenance_class":"official_international_tourism_statistics","reason":"UN Tourism country-profile/dashboard statistics provide official destination arrivals, receipts and export-share indicators.","methodology_url":"https://www.unwto.org/tourism-data","independent_validation":True,"risk":"low","priority":6},
    "unwup2025": {"provenance_class":"un_harmonized_degree_of_urbanization_statistics","reason":"UN DESA World Urbanization Prospects 2025 applies a harmonized Degree of Urbanization framework and publishes annual country estimates through 2025.","methodology_url":"https://population.un.org/wup/assets/Publications/undesa_pd_2025_wup2025_methodological_report.pdf","independent_validation":True,"risk":"low","priority":5},
    "unwupcities2025": {"provenance_class":"un_harmonized_city_geospatial_statistics","reason":"UN DESA World Urbanization Prospects 2025 publishes harmonized city population, land-area and built-up-area series for cities with at least 50,000 inhabitants.","methodology_url":"https://population.un.org/wup/assets/Publications/undesa_pd_2025_wup2025_methodological_report.pdf","independent_validation":True,"risk":"low","priority":5},
    "worldbankhistory": {"provenance_class":"reproducible_wdi_historical_derivation","reason":"GeoStats derives exact consecutive-year historical threshold crossings from World Development Indicators without interpolating censored or missing years.","methodology_url":"https://databank.worldbank.org/metadataglossary/world-development-indicators/series/","independent_validation":True,"risk":"low","priority":8},
    "naturalearthcapitals": {"provenance_class":"reproducible_geospatial_capital_derivation","reason":"National-capital categories are calculated from pinned Natural Earth populated-place and sovereign-country geometry using one reproducible global method.","methodology_url":"https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/","independent_validation":True,"risk":"none","priority":10},
    "fifa": {"provenance_class":"official_international_sports_history","reason":"FIFA participation records provide an official historical record of men's World Cup finals appearances; GeoStats ranks only current countries with an observed appearance.","methodology_url":"https://www.fifa.com/tournaments/mens/worldcup","independent_validation":True,"risk":"none","priority":10},
    "fifaranking": {"provenance_class":"official_international_sports_ranking","reason":"FIFA publishes the official men's national-team world ranking and its common-date point snapshot; GeoStats preserves the published rank and does not synthesize a United Kingdom team.","methodology_url":"https://inside.fifa.com/fifa-world-ranking/men","independent_validation":True,"risk":"none","priority":10},
    "ioc": {"provenance_class":"official_international_sports_history","reason":"IOC/Olympics participation records provide the official historical basis for modern Olympic appearances; GeoStats ranks only current countries with an observed appearance.","methodology_url":"https://olympics.com/ioc/olympic-games","independent_validation":True,"risk":"none","priority":10},
    "globalfindex2025": {"provenance_class":"internationally_harmonized_financial_inclusion_survey","reason":"World Bank Global Findex 2025 reports nationally representative 2024 financial- and digital-inclusion survey measures with published definitions.","methodology_url":"https://www.worldbank.org/en/publication/globalfindex/download-data","independent_validation":True,"risk":"low","priority":7},
    "faofra2025": {"provenance_class":"internationally_harmonized_forest_resource_assessment","reason":"FAO Global Forest Resources Assessment 2025 harmonizes country forest-resource statistics under a documented global assessment framework.","methodology_url":"https://www.fao.org/forest-resources-assessment/en/","independent_validation":True,"risk":"low","priority":8},
    "unicefdata": {"provenance_class":"internationally_harmonized_child_wellbeing_statistics","reason":"UNICEF Data Warehouse publishes documented cross-country child and family indicators from standardized surveys, administrative sources and modeled series.","methodology_url":"https://data.unicef.org/resources/resource-type/datasets/","independent_validation":True,"risk":"low","priority":7},
    "undphdr": {"provenance_class":"internationally_harmonized_human_development_statistics","reason":"UNDP Human Development Reports publish documented country indicators and composite measures under a stable annual methodology.","methodology_url":"https://hdr.undp.org/data-center/documentation-and-downloads","independent_validation":True,"risk":"low","priority":7},
    "vdemv16": {"provenance_class":"independent_comparative_democracy_measurement","reason":"V-Dem v16 publishes a versioned country-year dataset with a public codebook and transparent expert-coding/measurement methodology.","methodology_url":"https://www.v-dem.net/data/the-v-dem-dataset/","independent_validation":True,"risk":"low","priority":7},
    "faostatfoodsecurity": {"provenance_class":"internationally_harmonized_food_security_statistics","reason":"FAOSTAT food-security and healthy-diet indicators are published under documented FAO definitions and a versioned official data release.","methodology_url":"https://www.fao.org/faostat/en/#data/FS","independent_validation":True,"risk":"low","priority":7},
    "koppengeiger": {"provenance_class":"independent_scientific_climate_classification","reason":"The 1991-2020 Köppen-Geiger raster is a peer-reviewed global climate classification; GeoStats uses pinned raster and sovereign geometry with geodesic area weighting.","methodology_url":"https://doi.org/10.1038/s41597-023-02549-6","independent_validation":True,"risk":"none","priority":10},
    "worldbankinfra": {"provenance_class":"internationally_harmonized_infrastructure_statistics","reason":"World Bank WDI infrastructure and connectivity indicators use exact documented series identifiers and common-year country observations.","methodology_url":"https://databank.worldbank.org/metadataglossary/world-development-indicators/series/","independent_validation":True,"risk":"low","priority":6},
    "faostatlanduse": {"provenance_class":"internationally_harmonized_land_use_statistics","reason":"FAOSTAT Land Use publishes country land-use statistics under common FAO definitions and official bulk releases.","methodology_url":"https://www.fao.org/faostat/en/#definitions","independent_validation":True,"risk":"low","priority":7},
    "faostatworldcover": {"provenance_class":"reproducible_global_land_cover_statistics","reason":"FAOSTAT land-cover statistics derived from ESA WorldCover 2021 provide a harmonized global land-cover basis under documented classes.","methodology_url":"https://esa-worldcover.org/en/data-access","independent_validation":True,"risk":"none","priority":9},
    "worldbankwbl": {"provenance_class":"comparative_legal_framework_measurement","reason":"World Bank Women, Business and the Law 2026 codes national legal frameworks under a published comparative methodology and country evidence base.","methodology_url":"https://wbl.worldbank.org/en/reports","independent_validation":True,"risk":"low","priority":7},
    "jmpwash": {"provenance_class":"who_unicef_harmonized_wash_statistics","reason":"The WHO/UNICEF Joint Monitoring Programme harmonizes household drinking-water, sanitation and hygiene estimates under published service ladders and methods.","methodology_url":"https://washdata.org/how-we-work/about-jmp","independent_validation":True,"risk":"low","priority":8},
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
