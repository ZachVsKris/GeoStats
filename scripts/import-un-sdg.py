#!/usr/bin/env python3
"""Import a curated, cross-family slice of the official UN SDG bulk catalog.

The source exposes hundreds of series. GeoStats deliberately keeps an explicit
allowlist and accepts only aggregate country observations with a disclosed unit.
Disaggregated rows are never averaged or silently combined.
"""
from __future__ import annotations

import argparse
import math
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import pycountry

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES, canonical_country_name
from data_pipeline.http import HttpClient
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG = "United Nations Statistics Division"
SOURCE_DATASET = "Global SDG Indicators Database"
SOURCE_PAGE = "https://unstats.un.org/sdgs/dataportal/database"
API = "https://unstats.un.org/SDGAPI/v1/sdg"


@dataclass(frozen=True)
class Spec:
    key: str
    title: str
    code: str
    family: str
    icon: str
    unit: str
    value_type: str = "percentage"
    direction: str = "high"
    dimensions: tuple[tuple[str, str], ...] = ()
    unit_code: str = "PERCENT"
    min_coverage: int = 70
    minimum: float | None = 0
    maximum: float | None = 100


# High-recognition measures from underrepresented families. Exact dimensions
# make several useful boards from one bulk series without inventing aggregates.
SPECS = (
    Spec("youth-literacy", "Highest youth literacy rate", "SE_ADT_LITR", "Education", "📚", "% of ages 15–24", dimensions=(("Age", "15-24"), ("Sex", "BOTHSEX"), ("Type of skill", "LITE"))),
    Spec("adult-literacy", "Highest adult literacy rate", "SE_ADT_LITR", "Education", "📚", "% of ages 15–99", dimensions=(("Age", "15-99"), ("Sex", "BOTHSEX"), ("Type of skill", "LITE"))),
    Spec("organized-learning", "Highest pre-primary learning participation", "SE_PRE_PARTN", "Education", "🎓", "% of eligible children", dimensions=(("Sex", "BOTHSEX"),)),
    Spec("primary-school-electricity", "Most primary schools with electricity", "SE_ACS_ELECT", "Education", "⚡", "% of primary schools", dimensions=(("Education level", "PRIMAR"),)),
    Spec("primary-school-internet", "Most primary schools with internet", "SE_ACS_INTNT", "Education", "🌐", "% of primary schools", dimensions=(("Education level", "PRIMAR"),)),
    Spec("primary-school-computers", "Most primary schools with computers", "SE_ACS_CMPTR", "Education", "💻", "% of primary schools", dimensions=(("Education level", "PRIMAR"),)),
    Spec("primary-school-water", "Most primary schools with drinking water", "SE_ACS_H2O", "Education", "🚰", "% of primary schools", dimensions=(("Education level", "PRIMAR"),)),
    Spec("primary-school-sanitation", "Most primary schools with basic sanitation", "SE_ACS_SANIT", "Education", "🚻", "% of primary schools", dimensions=(("Education level", "PRIMAR"),)),
    Spec("primary-school-handwashing", "Most primary schools with handwashing facilities", "SE_ACC_HNDWSH", "Education", "🧼", "% of primary schools", dimensions=(("Education level", "PRIMAR"),)),
    Spec("highest-unemployment", "Highest unemployment rate", "SL_TLF_UEM", "Labor", "👷", "% of labor force", dimensions=(("Age", "15+"), ("Sex", "BOTHSEX"))),
    Spec("highest-youth-neet", "Highest youth NEET rate", "SL_TLF_NEET", "Labor", "🎒", "% of youth", dimensions=(("Sex", "BOTHSEX"), ("Age", "15-24"))),
    Spec("highest-informal-employment", "Highest informal-employment share", "SL_ISV_IFEM", "Labor", "🧾", "% of employment", dimensions=(("Sex", "BOTHSEX"),)),
    Spec("fatal-work-injuries", "Highest fatal workplace-injury rate", "SL_EMP_FTLINJUR", "Labor", "⛑️", "per 100,000 employees", value_type="rate", dimensions=(("Sex", "BOTHSEX"),), unit_code="PER_100000_EMP", min_coverage=45, maximum=None),
    Spec("manufacturing-employment", "Largest manufacturing-employment share", "SL_TLF_MANF", "Labor", "🏭", "% of employment", dimensions=(("Activity", "ISIC4_C"), ("Sex", "BOTHSEX"))),
    Spec("five-g-coverage", "Highest 5G network coverage", "IT_MOB_5GNTWK", "Infrastructure", "📡", "% of population"),
    Spec("four-g-coverage", "Highest 4G network coverage", "IT_MOB_4GNTWK", "Infrastructure", "📡", "% of population"),
    Spec("three-g-coverage", "Highest 3G network coverage", "IT_MOB_3GNTWK", "Infrastructure", "📡", "% of population"),
    Spec("researchers-per-million", "Most researchers per million people", "GB_POP_SCIERD", "Knowledge", "🔬", "per million people", value_type="rate", unit_code="PER_1000000_POP", maximum=None),
    Spec("research-spending", "Highest research-and-development spending", "GB_XPD_RSDV", "Knowledge", "🔬", "% of GDP"),
    Spec("container-port-traffic", "Most container port traffic", "IS_RDP_PORFVOL", "Transport", "🚢", "TEU", value_type="total", unit_code="TEU", maximum=None),
    Spec("birth-registration", "Highest birth-registration coverage", "SG_REG_BRTH", "Government", "🏛️", "% of children under 5", dimensions=(("Age", "<5Y"),)),
    Spec("unsentenced-detainees", "Highest unsentenced-detainee share", "VC_PRS_UNSNT", "Government", "⚖️", "% of prison population", min_coverage=50),
    Spec("homicide-rate", "Highest homicide rate", "VC_IHR_PSRC", "Safety", "🛡️", "per 100,000 people", value_type="rate", dimensions=(("Sex", "BOTHSEX"),), unit_code="PER_100000_POP", maximum=None),
    Spec("firm-bribery", "Highest business bribery incidence", "IC_FRM_BRIB", "Government", "🏛️", "% of firms", min_coverage=50),
    Spec("urban-slum-share", "Largest urban slum population share", "EN_LND_SLUM", "Infrastructure", "🏙️", "% of urban population", dimensions=(("Location", "URBAN"),)),
    Spec("pm25-exposure", "Highest fine-particle air pollution", "EN_ATM_PM25", "Environment", "🌫️", "micrograms per m³", value_type="other", dimensions=(("Location", "ALLAREA"),), unit_code="mgr/m^3", maximum=None),
    Spec("disaster-affected-rate", "Most people affected by disasters", "VC_DSR_DAFF", "Natural hazards", "🌪️", "per 100,000 people", value_type="rate", unit_code="PER_100000_POP", min_coverage=50, maximum=None),
    Spec("disaster-death-rate", "Highest disaster death and missing rate", "VC_DSR_MTMP", "Natural hazards", "🌪️", "per 100,000 people", value_type="rate", unit_code="PER_100000_POP", min_coverage=50, maximum=None),
)
BY_KEY = {spec.key: spec for spec in SPECS}
BY_CODE: dict[str, list[Spec]] = {}
for _spec in SPECS:
    BY_CODE.setdefault(_spec.code, []).append(_spec)

TOTAL_CODES = {"_T", "TOTAL", "ALL", "ALLAGE", "BOTHSEX", "NOCITI", "NO_BREAKDOWN", "N", "G"}


def m49_to_iso3(value: Any) -> str | None:
    try:
        country = pycountry.countries.get(numeric=f"{int(str(value)):03d}")
    except (LookupError, TypeError, ValueError):
        return None
    iso3 = str(country.alpha_3).upper() if country else ""
    return iso3 if iso3 in CANONICAL_COUNTRY_NAMES else None


def accepts_dimensions(spec: Spec, dimensions: dict[str, Any], definitions: dict[str, set[str]]) -> bool:
    required = dict(spec.dimensions)
    for name, expected in required.items():
        if str(dimensions.get(name) or "") != expected:
            return False
    for name, raw in dimensions.items():
        if name in required:
            continue
        code = str(raw or "").upper()
        choices = definitions.get(name, set())
        if name == "Reporting Type":
            if code != "G":
                return False
        elif len(choices) > 1 and code not in TOTAL_CODES:
            return False
    return True


class Importer(WarehouseImporter):
    source_organization = SOURCE_ORG
    source_dataset = SOURCE_DATASET
    source_slug = "unsdg"

    def __init__(self, warehouse: SupabaseWarehouse | None, dry_run: bool = False):
        super().__init__(warehouse, dry_run=dry_run)
        self.http = HttpClient(timeout=180, retries=5, user_agent="GeoStats/16.2.7 UN SDG bulk importer")
        self.catalog: dict[str, dict[str, Any]] = {}
        self.cache: dict[str, dict[str, Any]] = {}

    def _catalog(self) -> dict[str, dict[str, Any]]:
        if not self.catalog:
            rows = self.http.get_json(f"{API}/Series/List?allreleases=false")
            if not isinstance(rows, list) or len(rows) < 600:
                raise RuntimeError("Official UN SDG catalog is missing or unexpectedly partial.")
            self.catalog = {str(row.get("code")): row for row in rows if isinstance(row, dict) and row.get("code")}
        return self.catalog

    def discover(self) -> list[CandidateDefinition]:
        catalog = self._catalog()
        missing = sorted(set(BY_CODE) - set(catalog))
        if missing:
            raise RuntimeError("Curated UN SDG series missing from the current official release: " + ", ".join(missing))
        out = []
        for spec in SPECS:
            source = catalog[spec.code]
            source_name = str(source.get("description") or "").strip()
            description = f"{spec.title} using the official UN Global SDG Indicators Database series {spec.code}."
            rule = IndicatorRule(
                key=spec.key, title=spec.title, description=description,
                plain_language_description=description,
                technical_definition=f"UN SDG series {spec.code}; exact aggregate dimensions {dict(spec.dimensions) or 'source total'}; one common country-year only.",
                unit_explanation=spec.unit, family=spec.family, icon=spec.icon, unit=spec.unit,
                value_type=spec.value_type, ranking_direction=spec.direction,
                include=(spec.code,), min_coverage=spec.min_coverage, evidence_tier="A",
                source_priority=6, specificity_score=99, recognizability_score=94,
                understandability_score=94, fun_score=88,
            )
            query = {"seriesCode": spec.code, "page": 1, "pageSize": 20000}
            out.append(CandidateDefinition(rule, spec.code, source_name, SOURCE_PAGE, {
                "source_page_url": SOURCE_PAGE,
                "api_url": f"{API}/Series/Data?{urlencode(query)}",
                "source_query": {**query, "dimensions": dict(spec.dimensions), "unit": spec.unit_code},
                "dataset_release": source.get("release"),
                "retrieved_at": datetime.now(timezone.utc).isoformat(),
                "strict_indicator_code": spec.code,
                "manual_review_required": True,
                "v16_2_7_content_reviewed": True,
            }))
        return out

    def _payload(self, code: str) -> dict[str, Any]:
        if code not in self.cache:
            page_size = 20000

            def fetch_page(page: int) -> dict[str, Any]:
                query = urlencode({"seriesCode": code, "page": page, "pageSize": page_size})
                value = self.http.get_json(f"{API}/Series/Data?{query}")
                if not isinstance(value, dict) or not isinstance(value.get("data"), list):
                    raise RuntimeError(f"UN SDG series {code} returned no observation page {page}.")
                return value

            payload = fetch_page(1)
            total = int(payload.get("totalElements") or len(payload["data"]))
            total_pages = int(payload.get("totalPages") or math.ceil(total / page_size) or 1)
            if total_pages < 1 or total_pages > 100:
                raise RuntimeError(f"UN SDG series {code} reported an unsafe page count: {total_pages}.")
            rows = list(payload["data"])
            for page in range(2, total_pages + 1):
                next_payload = fetch_page(page)
                next_total = int(next_payload.get("totalElements") or total)
                next_page = int(next_payload.get("pageNumber") or page)
                if next_total != total or next_page != page:
                    raise RuntimeError(f"UN SDG series {code} pagination changed during retrieval at page {page}.")
                rows.extend(next_payload["data"])
            if len(rows) != total:
                raise RuntimeError(f"UN SDG series {code} was truncated ({len(rows)}/{total}); refusing partial import.")
            payload = {**payload, "data": rows}
            if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
                raise RuntimeError(f"UN SDG series {code} returned no observation page.")
            self.cache[code] = payload
        return self.cache[code]

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        spec = BY_KEY[candidate.rule.key]
        payload = self._payload(spec.code)
        definitions = {str(item.get("id")): {str(code.get("code")).upper() for code in item.get("codes", []) if isinstance(code, dict)} for item in payload.get("dimensions", []) if isinstance(item, dict)}
        chosen: dict[tuple[str, int], tuple[int, SourceObservation]] = {}
        completed_year = datetime.now(timezone.utc).year - 1
        nature_priority = {"G": 5, "E": 4, "M": 3, "CA": 2, "C": 1}
        for index, row in enumerate(payload["data"]):
            if not isinstance(row, dict):
                continue
            iso3 = m49_to_iso3(row.get("geoAreaCode"))
            dimensions = row.get("dimensions") if isinstance(row.get("dimensions"), dict) else {}
            attributes = row.get("attributes") if isinstance(row.get("attributes"), dict) else {}
            if not iso3 or not accepts_dimensions(spec, dimensions, definitions) or str(attributes.get("Units") or "") != spec.unit_code:
                continue
            try:
                year = int(float(row.get("timePeriodStart")))
                value = float(str(row.get("value")).replace(",", ""))
            except (TypeError, ValueError):
                continue
            if year > completed_year or not math.isfinite(value):
                continue
            if spec.minimum is not None and value < spec.minimum - 1e-9:
                raise RuntimeError(f"{spec.code} value below range for {iso3} {year}: {value}")
            if spec.maximum is not None and value > spec.maximum + 1e-9:
                raise RuntimeError(f"{spec.code} value above range for {iso3} {year}: {value}")
            nature = str(attributes.get("Nature") or "NA")
            evidence = "modeled" if nature == "M" else ("estimated" if nature in {"E", "G"} else "official")
            observation = SourceObservation(
                iso3, canonical_country_name(iso3, iso3), year, value, candidate.source_url,
                f"UNSDG:{spec.code}:{spec.key}:{iso3}:{year}:{index}", evidence,
                {"series_code": spec.code, "dimensions": dimensions, "attributes": attributes, "source": row.get("source"), "release": self._catalog()[spec.code].get("release")},
            )
            key = (iso3, year)
            priority = nature_priority.get(nature, 0)
            prior = chosen.get(key)
            if prior and priority == prior[0] and abs(prior[1].value - value) > 1e-9:
                raise RuntimeError(f"{spec.code} has contradictory aggregate values for {iso3} {year}.")
            if prior is None or priority > prior[0]:
                chosen[key] = (priority, observation)
        rows = [item[1] for item in chosen.values()]
        if len({row.country_iso3 for row in rows}) < spec.min_coverage:
            raise RuntimeError(f"{spec.code}/{spec.key} has fewer than {spec.min_coverage} aggregate countries.")
        return sorted(rows, key=lambda row: (row.data_year, row.country_iso3))

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"unsdg:{candidate.rule.key}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Import curated official UN SDG bulk series.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set Supabase production credentials.")
    warehouse = None if args.dry_run else SupabaseWarehouse(url, key)
    result = Importer(warehouse, dry_run=args.dry_run).run(only_keys=set(args.only) or None)
    print(result, flush=True)
    return 1 if result["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
