#!/usr/bin/env python3
"""Import a curated, dynamically resolved set of WHO GHO indicators into GeoStats.

Official API documentation:
https://www.who.int/data/gho/info/gho-odata-api

The importer resolves player-facing concepts against WHO's current Indicator catalog,
then imports country totals only. Categories are enabled only after automatic quality, provenance, and duplicate gates pass.
"""
from __future__ import annotations

import argparse
import math
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))

from data_pipeline.base import WarehouseImporter
from data_pipeline.countries import normalize_iso3
from data_pipeline.http import JsonHttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

WHO_API = "https://ghoapi.azureedge.net/api"
WHO_DOCS = "https://www.who.int/data/gho/info/gho-odata-api"

# Sibling WHO indicators can have almost identical names while representing
# fundamentally different measures. Pin concepts whose semantic identity is
# safety-critical rather than allowing fuzzy name resolution.
PINNED_INDICATORS: dict[str, str] = {
    "highest-clean-fuel-access": "PHE_HHAIR_PROP_POP_CLEAN_FUELS",
}


def rule(
    key: str,
    title: str,
    family: str,
    icon: str,
    unit: str,
    value_type: str,
    direction: str,
    include: tuple[str, ...],
    *,
    prefer: tuple[str, ...] = (),
    exclude: tuple[str, ...] = (),
    min_coverage: int = 100,
    evidence: str = "B",
    modeled: float | None = None,
    priority: int = 20,
    specificity: int = 90,
    recognizability: int = 90,
    allowed_dimensions: tuple[str, ...] = (),
) -> IndicatorRule:
    label = title.removeprefix("Highest ").removeprefix("Lowest ")
    return IndicatorRule(
        key=key,
        title=title,
        description=f"Countries ranked by {label.lower()} using the latest broadly comparable WHO Global Health Observatory data.",
        family=family,
        icon=icon,
        unit=unit,
        value_type=value_type,  # type: ignore[arg-type]
        ranking_direction=direction,  # type: ignore[arg-type]
        include=include,
        prefer=prefer,
        exclude=exclude,
        min_coverage=min_coverage,
        evidence_tier=evidence,  # type: ignore[arg-type]
        modeled_hint=modeled,
        source_priority=priority,
        specificity_score=specificity,
        recognizability_score=recognizability,
        allowed_dimension_codes=allowed_dimensions,
    )


# Each rule is intentionally phrased as something a player can understand immediately.
# WHO's catalog names are resolved at runtime so the importer is resilient to code changes.
RULES: tuple[IndicatorRule, ...] = (
    rule("highest-life-expectancy", "Highest life expectancy", "Health", "🫀", "years", "other", "high", (r"life expectancy at birth",), prefer=(r"both sexes|years",), exclude=(r"healthy|hale|inequality|female|male",), min_coverage=150, evidence="A", priority=10),
    rule("highest-healthy-life-expectancy", "Highest healthy life expectancy", "Health", "💚", "years", "other", "high", (r"healthy life expectancy|hale at birth",), prefer=(r"at birth",), exclude=(r"inequality|female|male",), min_coverage=145, evidence="B", modeled=0.9),
    rule("lowest-maternal-mortality", "Lowest maternal mortality", "Health", "🤱", "per 100,000 live births", "rate", "low", (r"maternal mortality ratio",), prefer=(r"per 100.?000 live births",), exclude=(r"number|lifetime risk",), min_coverage=140, evidence="B", modeled=0.9),
    rule("lowest-neonatal-mortality", "Lowest neonatal mortality", "Health", "👶", "per 1,000 live births", "rate", "low", (r"neonatal mortality rate",), exclude=(r"number|inequality",), min_coverage=150, evidence="B", modeled=0.85),
    rule("lowest-infant-mortality", "Lowest infant mortality", "Health", "🍼", "per 1,000 live births", "rate", "low", (r"infant mortality rate",), exclude=(r"neonatal|under-five|number|inequality",), min_coverage=150, evidence="B", modeled=0.85),
    rule("lowest-under-five-mortality", "Lowest under-five mortality", "Health", "🧒", "per 1,000 live births", "rate", "low", (r"under-five mortality rate",), exclude=(r"number|inequality",), min_coverage=150, evidence="B", modeled=0.85),
    rule("lowest-suicide-rate", "Lowest suicide rate", "Health", "🧠", "per 100,000 people", "rate", "low", (r"suicide mortality rate|age-standardized suicide",), prefer=(r"age-standardized",), exclude=(r"female|male|crude|number",), min_coverage=140, evidence="B", modeled=0.9),
    rule("lowest-road-traffic-death-rate", "Lowest road-traffic death rate", "Safety", "🚗", "per 100,000 people", "rate", "low", (r"road traffic.*mortality rate|estimated road traffic death rate",), exclude=(r"number|female|male",), min_coverage=130, evidence="B", modeled=0.85),
    rule("lowest-premature-ncd-mortality", "Lowest premature noncommunicable-disease mortality", "Health", "🩺", "% probability", "percentage", "low", (r"probability of dying.*cardiovascular.*cancer.*diabetes.*respiratory|probability of dying.*four main ncd",), exclude=(r"female|male",), min_coverage=130, evidence="B", modeled=0.9, recognizability=75),
    rule("lowest-cardiovascular-death-rate", "Lowest cardiovascular death rate", "Health", "❤️", "per 100,000 people", "rate", "low", (r"age-standardized death rate.*cardiovascular|cardiovascular diseases.*death rate",), exclude=(r"female|male|number|cerebrovascular",), min_coverage=120, evidence="B", modeled=0.85),
    rule("lowest-cancer-death-rate", "Lowest cancer death rate", "Health", "🎗️", "per 100,000 people", "rate", "low", (r"age-standardized death rate.*cancer|malignant neoplasms.*death rate",), exclude=(r"female|male|number|site",), min_coverage=120, evidence="B", modeled=0.85),
    rule("lowest-diabetes-death-rate", "Lowest diabetes death rate", "Health", "🩸", "per 100,000 people", "rate", "low", (r"age-standardized death rate.*diabetes|diabetes mellitus.*death rate",), exclude=(r"female|male|number",), min_coverage=120, evidence="B", modeled=0.85),
    rule("lowest-respiratory-death-rate", "Lowest chronic respiratory-disease death rate", "Health", "🫁", "per 100,000 people", "rate", "low", (r"age-standardized death rate.*chronic respiratory|chronic respiratory diseases.*death rate",), exclude=(r"female|male|number",), min_coverage=120, evidence="B", modeled=0.85),
    rule("lowest-tuberculosis-incidence", "Lowest tuberculosis incidence", "Disease", "🦠", "per 100,000 people", "rate", "low", (r"tuberculosis incidence",), prefer=(r"per 100.?000",), exclude=(r"hiv|number|notification|female|male",), min_coverage=150, evidence="B", modeled=0.8),
    rule("lowest-tuberculosis-death-rate", "Lowest tuberculosis death rate", "Disease", "🫁", "per 100,000 people", "rate", "low", (r"tuberculosis mortality rate|deaths due to tuberculosis.*rate",), exclude=(r"hiv|number|female|male",), min_coverage=140, evidence="B", modeled=0.85),
    rule("lowest-malaria-incidence", "Lowest malaria incidence", "Disease", "🦟", "per 1,000 people at risk", "rate", "low", (r"malaria incidence",), exclude=(r"number|indigenous|imported",), min_coverage=80, evidence="B", modeled=0.8),
    rule("lowest-hiv-incidence", "Lowest HIV incidence", "Disease", "🎗️", "per 1,000 uninfected people", "rate", "low", (r"hiv incidence",), exclude=(r"children|adults|female|male|number",), min_coverage=130, evidence="B", modeled=0.85),
    rule("lowest-hepatitis-b-incidence", "Lowest hepatitis B incidence", "Disease", "🧬", "per 100,000 people", "rate", "low", (r"hepatitis b incidence",), exclude=(r"children|number|vaccin",), min_coverage=90, evidence="B", modeled=0.8),
    rule("lowest-obesity-rate", "Lowest adult obesity rate", "Health", "⚖️", "% of adults", "percentage", "low", (r"prevalence of obesity.*adults|obesity.*age-standardized.*18",), prefer=(r"age-standardized|bmi",), exclude=(r"children|adolescent|female|male|crude",), min_coverage=140, evidence="B", modeled=0.9),
    rule("lowest-overweight-rate", "Lowest adult overweight rate", "Health", "📏", "% of adults", "percentage", "low", (r"prevalence of overweight.*adults|overweight.*age-standardized.*18",), prefer=(r"age-standardized|bmi",), exclude=(r"children|adolescent|female|male|obesity|crude",), min_coverage=140, evidence="B", modeled=0.9),
    rule("lowest-underweight-rate", "Lowest adult underweight rate", "Health", "🥗", "% of adults", "percentage", "low", (r"prevalence of underweight.*adults|underweight.*age-standardized.*18",), exclude=(r"children|adolescent|female|male",), min_coverage=120, evidence="B", modeled=0.9),
    rule("lowest-high-blood-pressure-rate", "Lowest high-blood-pressure rate", "Health", "🩺", "% of adults", "percentage", "low", (r"raised blood pressure|hypertension.*prevalence",), prefer=(r"age-standardized",), exclude=(r"treatment|controlled|female|male|children",), min_coverage=130, evidence="B", modeled=0.9),
    rule("lowest-high-blood-glucose-rate", "Lowest high-blood-glucose rate", "Health", "🩸", "% of adults", "percentage", "low", (r"raised blood glucose|diabetes.*prevalence",), prefer=(r"age-standardized",), exclude=(r"death|female|male|children",), min_coverage=130, evidence="B", modeled=0.9),
    rule("lowest-tobacco-use", "Lowest tobacco-use rate", "Health", "🚭", "% of people age 15+", "percentage", "low", (r"prevalence of current tobacco use|age-standardized prevalence.*tobacco",), exclude=(r"female|male|youth|smokeless",), min_coverage=130, evidence="B", modeled=0.85),
    rule("lowest-cigarette-smoking", "Lowest cigarette-smoking rate", "Health", "🚬", "% of people age 15+", "percentage", "low", (r"prevalence of current cigarette smoking|current smoking of cigarettes",), exclude=(r"female|male|youth|daily",), min_coverage=110, evidence="B", modeled=0.8),
    rule("lowest-alcohol-consumption", "Lowest alcohol consumption", "Health", "🍷", "litres per adult", "per_capita", "low", (r"alcohol per capita.*consumption|total.*alcohol consumption per capita",), prefer=(r"recorded.*unrecorded|15\+",), exclude=(r"female|male|drinkers only|beer|wine|spirits",), min_coverage=140, evidence="B", modeled=0.7),
    rule("lowest-harmful-alcohol-use", "Lowest alcohol-attributable death rate", "Health", "🍺", "per 100,000 people", "rate", "low", (r"alcohol-attributable.*death|alcohol attributable.*mortality",), exclude=(r"number|female|male|liver",), min_coverage=110, evidence="B", modeled=0.85),
    rule("highest-physical-inactivity", "Highest physical-inactivity rate", "Health", "🛋️", "% of adults", "percentage", "high", (r"insufficient physical activity.*adults|physical inactivity.*age-standardized",), exclude=(r"children|adolescent|female|male",), min_coverage=120, evidence="B", modeled=0.9),
    rule("highest-doctor-density", "Highest doctor density", "Healthcare", "👨‍⚕️", "per 10,000 people", "rate", "high", (r"medical doctors.*per 10.?000|physicians.*density",), exclude=(r"specialist|graduates|number|female|male",), min_coverage=110, evidence="A", priority=10),
    rule("highest-nurse-density", "Highest nurse and midwife density", "Healthcare", "👩‍⚕️", "per 10,000 people", "rate", "high", (r"nursing and midwifery personnel.*per 10.?000|nurses and midwives.*density",), exclude=(r"graduates|number|female|male",), min_coverage=110, evidence="A", priority=10),
    rule("highest-dentist-density", "Highest dentist density", "Healthcare", "🦷", "per 10,000 people", "rate", "high", (r"dentists.*per 10.?000|dentist.*density",), exclude=(r"graduates|number",), min_coverage=90, evidence="A"),
    rule("highest-pharmacist-density", "Highest pharmacist density", "Healthcare", "💊", "per 10,000 people", "rate", "high", (r"pharmacists.*per 10.?000|pharmacist.*density",), exclude=(r"graduates|number",), min_coverage=90, evidence="A"),
    rule("highest-hospital-bed-density", "Highest hospital-bed density", "Healthcare", "🛏️", "per 10,000 people", "rate", "high", (r"hospital beds.*per 10.?000|hospital bed density",), exclude=(r"psychiatric|number",), min_coverage=110, evidence="A", priority=10),
    rule("highest-health-spending-per-person", "Highest health spending per person", "Healthcare", "💵", "international dollars per person", "per_capita", "high", (r"current health expenditure.*per capita.*ppp|health expenditure per capita.*ppp",), exclude=(r"domestic general government|out-of-pocket|external",), min_coverage=140, evidence="B"),
    rule("highest-uhc-service-coverage", "Highest universal-health-coverage score", "Healthcare", "🏥", "index", "index", "high", (r"uhc service coverage index|universal health coverage.*service coverage",), exclude=(r"inequality",), min_coverage=140, evidence="B", modeled=0.7, priority=10),
    rule("lowest-catastrophic-health-spending", "Lowest catastrophic health spending", "Healthcare", "💸", "% of population", "percentage", "low", (r"population.*household expenditure.*health.*10%|catastrophic health expenditure.*10",), exclude=(r"25%|number",), min_coverage=80, evidence="B"),
    rule("highest-dtp3-vaccination", "Highest DTP3 vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"diphtheria.*tetanus.*pertussis.*third dose|dtp3.*immunization coverage",), exclude=(r"dropout|number|one-year-olds vaccinated",), min_coverage=150, evidence="A", priority=10),
    rule("highest-measles-vaccination", "Highest measles vaccination rate", "Vaccination", "💉", "% of children", "percentage", "high", (r"measles.*first dose.*coverage|measles-containing-vaccine first-dose",), exclude=(r"second dose|number|cases",), min_coverage=150, evidence="A", priority=10),
    rule("highest-polio-vaccination", "Highest polio vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"polio.*third dose.*coverage|pol3.*immunization coverage",), exclude=(r"cases|number",), min_coverage=150, evidence="A"),
    rule("highest-hepatitis-b-vaccination", "Highest hepatitis B vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"hepatitis b.*third dose.*coverage|hepb3.*immunization coverage",), exclude=(r"birth dose|number",), min_coverage=140, evidence="A"),
    rule("highest-bcg-vaccination", "Highest tuberculosis vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"bcg.*immunization coverage|bacille calmette.*coverage",), exclude=(r"number",), min_coverage=130, evidence="A"),
    rule("highest-dtp1-vaccination", "Highest DTP first-dose vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"diphtheria.*tetanus.*pertussis.*first[- ]dose.*immunization coverage|dtp1.*immunization coverage",), exclude=(r"third dose|dtp3|dropout|number",), min_coverage=150, evidence="A", priority=10),
    rule("highest-hib3-vaccination", "Highest Hib vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"hib.*hib3.*immunization coverage|hib.*immunization coverage.*1-year-olds",), exclude=(r"number|cases",), min_coverage=120, evidence="A"),
    rule("highest-hpv-vaccination", "Highest HPV vaccination rate", "Vaccination", "💉", "% of target cohort", "percentage", "high", (r"hpv.*immunization coverage.*target cohort|human papillomavirus.*vaccin.*coverage",), exclude=(r"number|introduction|facility",), min_coverage=80, evidence="A", recognizability=88),
    rule("highest-measles-second-dose", "Highest second-dose measles vaccination rate", "Vaccination", "💉", "% of children", "percentage", "high", (r"measles-containing-vaccine second-dose|measles.*second[- ]dose.*immunization coverage|mcv2.*immunization coverage",), exclude=(r"first dose|mcv1|number|cases",), min_coverage=140, evidence="A"),
    rule("highest-pneumococcal-vaccination", "Highest pneumococcal vaccination rate", "Vaccination", "💉", "% of target children", "percentage", "high", (r"pneumococcal conjugate.*immunization coverage|pcv.*immunization coverage",), exclude=(r"number|introduction|disease",), min_coverage=100, evidence="A"),
    rule("highest-ipv-vaccination", "Highest inactivated-polio vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"inactivated.*polio.*immunization coverage|ipv1.*immunization coverage",), prefer=(r"first[- ]dose|ipv1",), exclude=(r"number|cases|second or third",), min_coverage=120, evidence="A"),
    rule("highest-rotavirus-vaccination", "Highest rotavirus vaccination rate", "Vaccination", "💉", "% of infants", "percentage", "high", (r"rotavirus.*completed dose.*immunization coverage|rotac.*immunization coverage",), exclude=(r"number|cases|introduction",), min_coverage=100, evidence="A"),
    rule("highest-neonatal-tetanus-protection", "Highest neonatal-tetanus protection rate", "Vaccination", "💉", "% of newborns", "percentage", "high", (r"tetanus protection for neonates|neonates protected at birth.*tetanus|pab.*tetanus",), exclude=(r"number|cases",), min_coverage=100, evidence="A"),
    rule("highest-vaccine-breadth", "Highest overall vaccine-coverage breadth", "Vaccination", "💉", "% of target population", "percentage", "high", (r"target population covered by all vaccines included in their national programme|covered by all vaccines.*national programme",), exclude=(r"number|facility|stockout",), min_coverage=100, evidence="A", recognizability=82, specificity=95),
    rule("highest-skilled-birth-attendance", "Highest skilled birth-attendance rate", "Maternal Health", "🤱", "% of births", "percentage", "high", (r"births attended by skilled health personnel",), exclude=(r"inequality|number",), min_coverage=100, evidence="A"),
    rule("highest-antenatal-care", "Highest antenatal-care coverage", "Maternal Health", "🤰", "% of pregnancies", "percentage", "high", (r"antenatal care coverage.*at least four|four antenatal care visits",), exclude=(r"one visit|inequality|number",), min_coverage=90, evidence="A"),
    rule("highest-family-planning-satisfaction", "Highest family-planning needs met", "Health", "👨‍👩‍👧", "% of women", "percentage", "high", (r"family planning needs satisfied.*modern methods|demand for family planning satisfied",), exclude=(r"inequality|number",), min_coverage=80, evidence="A"),
    rule("lowest-adolescent-birth-rate", "Lowest adolescent birth rate", "Population", "👩", "per 1,000 women age 15–19", "rate", "low", (r"adolescent birth rate",), exclude=(r"10.?14|number|inequality",), min_coverage=140, evidence="B"),
    rule("highest-clean-fuel-access", "Highest share using clean cooking fuels", "Infrastructure", "🔥", "% of population", "percentage", "high", (r"primary reliance on clean fuels|clean fuels and technologies for cooking",), prefer=(r"proportion|percentage|%",), exclude=(r"urban|rural|female|male|millions?|number of people",), min_coverage=150, evidence="B", modeled=0.8),
    rule("highest-safe-drinking-water", "Highest safely managed drinking-water access", "Infrastructure", "🚰", "% of population", "percentage", "high", (r"safely managed drinking-water services|safely managed drinking water",), exclude=(r"urban|rural|inequality",), min_coverage=120, evidence="B"),
    rule("highest-safe-sanitation", "Highest safely managed sanitation access", "Infrastructure", "🚽", "% of population", "percentage", "high", (r"safely managed sanitation services|safely managed sanitation",), exclude=(r"urban|rural|inequality",), min_coverage=110, evidence="B"),
    rule("highest-handwashing-access", "Highest handwashing access", "Infrastructure", "🧼", "% of population", "percentage", "high", (r"handwashing facilit.*soap and water|basic handwashing facilities",), exclude=(r"schools|health care facilities|urban|rural",), min_coverage=90, evidence="B"),
    rule("lowest-air-pollution", "Lowest urban air pollution", "Environment", "🌫️", "µg/m³ PM2.5", "other", "low", (r"mean annual exposure.*pm2.5|annual mean concentration.*pm2.5",), exclude=(r"mortality|household|female|male",), min_coverage=130, evidence="B", modeled=0.9),
    rule("lowest-air-pollution-death-rate", "Lowest air-pollution death rate", "Environment", "🌬️", "per 100,000 people", "rate", "low", (r"air pollution.*mortality rate|ambient and household air pollution.*death rate",), exclude=(r"number|female|male",), min_coverage=120, evidence="B", modeled=0.9),
    rule("lowest-unsafe-water-death-rate", "Lowest unsafe-water death rate", "Environment", "💧", "per 100,000 people", "rate", "low", (r"unsafe water.*sanitation.*hygiene.*mortality rate|inadequate water.*sanitation.*death rate",), exclude=(r"number|female|male",), min_coverage=120, evidence="B", modeled=0.9),
    rule("lowest-poisoning-death-rate", "Lowest accidental-poisoning death rate", "Safety", "☠️", "per 100,000 people", "rate", "low", (r"unintentional poisoning.*mortality rate|accidental poisoning.*death rate",), exclude=(r"number|female|male",), min_coverage=120, evidence="B", modeled=0.85),
    rule("lowest-homicide-rate", "Lowest homicide rate", "Safety", "🛡️", "per 100,000 people", "rate", "low", (r"homicide mortality rate|interpersonal violence.*death rate",), exclude=(r"number|female|male",), min_coverage=110, evidence="B", modeled=0.8),
    rule("highest-birth-registration", "Highest birth-registration rate", "Government", "📜", "% of children under 5", "percentage", "high", (r"birth registration.*under 5|children under 5.*births registered",), exclude=(r"inequality|urban|rural",), min_coverage=80, evidence="A"),
)

GENERIC_BAD_NAME = re.compile(
    r"\b(archived|male|female|boys|girls|by sex|age-specific|aged [0-9]|children aged|adolescents aged|urban|rural|quintile|wealth|subnational)\b",
    re.IGNORECASE,
)
AGGREGATE_DIMENSIONS = {
    "BTSX", "SEX_BTSX", "BOTHSEX", "ALL", "TOTAL", "TOTL", "AGEGROUP_YEARSALL",
    "AGEGROUP_ALL", "RESIDENCEAREATYPE_TOTL", "WEALTHQUINTILE_ALL", "EDUCATIONLEVEL_ALL",
}


class WhoImporter(WarehouseImporter):
    source_organization = "WHO"
    source_dataset = "Global Health Observatory"
    source_slug = "who"

    def __init__(self, warehouse: SupabaseWarehouse | None, *, dry_run: bool = False) -> None:
        super().__init__(warehouse, dry_run=dry_run)
        self.http = JsonHttpClient(timeout=120, retries=5)
        self.country_names: dict[str, str] = {}

    def discover(self) -> list[CandidateDefinition]:
        catalog = self.http.get_odata(f"{WHO_API}/Indicator")
        self.country_names = self._load_country_names()
        used_codes: set[str] = set()
        discovered: list[CandidateDefinition] = []
        unmatched: list[str] = []
        for concept in RULES:
            ranked: list[tuple[int, dict[str, Any]]] = []
            pinned_code = PINNED_INDICATORS.get(concept.key)
            for row in catalog:
                code = str(row.get("IndicatorCode") or "").strip()
                name = str(row.get("IndicatorName") or "").strip()
                if not code or not name or code in used_codes:
                    continue
                if pinned_code and code != pinned_code:
                    continue
                score = self._match_score(concept, name)
                if score is not None:
                    ranked.append((score + (1000 if pinned_code else 0), row))
            if not ranked:
                unmatched.append(concept.key)
                continue
            ranked.sort(key=lambda item: (-item[0], str(item[1].get("IndicatorName"))))
            chosen = ranked[0][1]
            code = str(chosen["IndicatorCode"])
            name = str(chosen["IndicatorName"])
            used_codes.add(code)
            exact_url = f"{WHO_API}/{quote(code, safe='')}?%24filter=SpatialDimType%20eq%20%27COUNTRY%27"
            discovered.append(CandidateDefinition(
                rule=concept,
                source_indicator_code=code,
                source_indicator_name=name,
                source_url=exact_url,
                metadata={
                    "who_catalog_match_score": ranked[0][0],
                    "who_api_docs": WHO_DOCS,
                    "source_page_url": WHO_DOCS,
                    "exact_query_url": exact_url,
                    "api_url": exact_url,
                    "source_query": {"indicator": code, "SpatialDimType": "COUNTRY", "dimensions": "aggregate only"},
                    "dataset_release": f"WHO GHO accessed {datetime.now(timezone.utc).date().isoformat()}",
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                },
            ))
        print(f"Resolved {len(discovered)} WHO concepts; {len(unmatched)} unmatched.", flush=True)
        if unmatched:
            print("Unmatched concepts: " + ", ".join(unmatched), flush=True)
        return discovered

    def _match_score(self, concept: IndicatorRule, name: str) -> int | None:
        lowered = name.lower()
        if "archived" in lowered:
            return None
        if any(re.search(pattern, name, re.IGNORECASE) for pattern in concept.exclude):
            return None
        if not all(re.search(pattern, name, re.IGNORECASE) for pattern in concept.include):
            return None
        score = 100
        score += sum(24 for pattern in concept.prefer if re.search(pattern, name, re.IGNORECASE))
        if GENERIC_BAD_NAME.search(name):
            score -= 45
        score -= max(0, len(name) - 105) // 4
        if "age-standardized" in lowered and concept.value_type in {"rate", "percentage"}:
            score += 8
        return score

    def _load_country_names(self) -> dict[str, str]:
        try:
            rows = self.http.get_odata(f"{WHO_API}/DIMENSION/COUNTRY/DimensionValues")
        except Exception as error:
            print(f"Country dimension lookup warning: {error}", flush=True)
            return {}
        names: dict[str, str] = {}
        for row in rows:
            code = normalize_iso3(row.get("Code") or row.get("DimensionValueCode"))
            title = str(row.get("Title") or row.get("DimensionValue") or row.get("Name") or "").strip()
            if code and title:
                names[code] = title
        return names

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        code = quote(candidate.source_indicator_code, safe="")
        # Request smaller OData pages so large WHO series do not time out or end mid-response.
        filtered_url = (
            f"{WHO_API}/{code}?%24filter=SpatialDimType%20eq%20%27COUNTRY%27"
            "&%24top=500"
        )
        try:
            rows = self.http.get_odata(filtered_url)
        except Exception:
            rows = self.http.get_odata(f"{WHO_API}/{code}?%24top=500")

        normalized: dict[tuple[str, int], SourceObservation] = {}
        max_year = 0
        for index, row in enumerate(rows):
            iso3 = normalize_iso3(row.get("SpatialDim"))
            if not iso3 or not self._aggregate_row(row, candidate.rule):
                continue
            year = self._year(row)
            value = self._numeric(row)
            if year is None or value is None or not math.isfinite(value):
                continue
            if candidate.rule.value_type == "percentage" and not 0 <= value <= 100:
                raise RuntimeError(
                    f"Semantic integrity failure for {candidate.source_indicator_code}: "
                    f"percentage value {value} for {iso3} in {year} is outside 0-100."
                )
            max_year = max(max_year, year)
            status = self._evidence_status(candidate, row)
            observation = SourceObservation(
                country_iso3=iso3,
                country_name=self.country_names.get(iso3, iso3),
                data_year=year,
                value=value,
                source_url=candidate.source_url,
                source_record_id=str(row.get("Id") or row.get("Numeric") or f"{candidate.source_indicator_code}:{iso3}:{year}:{index}"),
                evidence_status=status,
                metadata={
                    "who_indicator_code": candidate.source_indicator_code,
                    "who_indicator_name": candidate.source_indicator_name,
                    "dim1": row.get("Dim1"),
                    "dim2": row.get("Dim2"),
                    "dim3": row.get("Dim3"),
                    "display_value": row.get("Value"),
                    "low": row.get("Low"),
                    "high": row.get("High"),
                },
            )
            key = (iso3, year)
            current = normalized.get(key)
            if current is None or self._row_priority(observation) > self._row_priority(current):
                normalized[key] = observation

        # Keep enough history for stability without bloating the warehouse with decades of rows.
        minimum_history_year = max(2000, max_year - 12)
        observations = [row for row in normalized.values() if row.data_year >= minimum_history_year]
        if len(observations) < 20:
            raise RuntimeError(f"Only {len(observations)} usable aggregate country-year observations were found.")
        return sorted(observations, key=lambda row: (row.data_year, row.country_iso3))

    def _aggregate_row(self, row: dict[str, Any], concept: IndicatorRule) -> bool:
        spatial_type = str(row.get("SpatialDimType") or "COUNTRY").upper()
        if spatial_type not in {"COUNTRY", ""}:
            return False
        allowed = AGGREGATE_DIMENSIONS | {value.upper() for value in concept.allowed_dimension_codes}
        for key in ("Dim1", "Dim2", "Dim3"):
            raw = row.get(key)
            if raw is None or str(raw).strip() == "":
                continue
            value = str(raw).strip().upper()
            if value in allowed or "BTSX" in value or value.endswith("_ALL") or value.endswith("_TOTL"):
                continue
            return False
        return True

    @staticmethod
    def _year(row: dict[str, Any]) -> int | None:
        for key in ("TimeDim", "TimeDimensionValue", "Date"):
            raw = row.get(key)
            if raw is None:
                continue
            match = re.search(r"(?:19|20)\d{2}", str(raw))
            if match:
                return int(match.group(0))
        for key in ("TimeDimensionBegin", "TimeDimensionEnd"):
            match = re.search(r"(?:19|20)\d{2}", str(row.get(key) or ""))
            if match:
                return int(match.group(0))
        return None

    @staticmethod
    def _numeric(row: dict[str, Any]) -> float | None:
        for key in ("NumericValue", "Numeric"):
            raw = row.get(key)
            if raw is not None:
                try:
                    return float(raw)
                except (TypeError, ValueError):
                    pass
        raw = str(row.get("Value") or "")
        match = re.search(r"-?\d+(?:[.,]\d+)?", raw.replace(",", ""))
        return float(match.group(0)) if match else None

    @staticmethod
    def _evidence_status(candidate: CandidateDefinition, row: dict[str, Any]) -> str:
        text = " ".join(str(value or "") for value in (
            candidate.source_indicator_name,
            row.get("Comments"), row.get("DataSource"), row.get("Value"), row.get("MethodOfEstimation"),
        )).lower()
        if any(token in text for token in ("modelled", "modeled", "model-based", "projection")):
            return "modeled"
        if any(token in text for token in ("estimate", "estimated", "uncertainty interval")):
            return "estimated"
        if any(token in text for token in ("reported", "administrative", "registry", "survey")):
            return "official"
        return "unknown"

    @staticmethod
    def _row_priority(row: SourceObservation) -> int:
        return {"official": 4, "estimated": 3, "modeled": 2, "unknown": 1}[row.evidence_status]

    def category_id(self, candidate: CandidateDefinition) -> str:
        safe_code = re.sub(r"[^A-Za-z0-9._-]+", "-", candidate.source_indicator_code).strip("-")
        return f"who:{safe_code}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import curated WHO GHO indicators through GeoStats automatic governance.")
    parser.add_argument("--dry-run", action="store_true", help="Resolve and score data without writing to Supabase.")
    parser.add_argument("--limit", type=int, default=None, help="Import only the first N resolved concepts.")
    parser.add_argument("--rule", action="append", default=[], help="Import only the named canonical rule key; repeatable.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    warehouse: SupabaseWarehouse | None = None
    if not args.dry_run:
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        if not url or not key:
            raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
        warehouse = SupabaseWarehouse(url, key)

    importer = WhoImporter(warehouse, dry_run=args.dry_run)
    result = importer.run(limit=args.limit, only_keys=set(args.rule) or None)
    print(result, flush=True)
    return 1 if result["failures"] and result["categories_processed"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
