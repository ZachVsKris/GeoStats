#!/usr/bin/env python3
"""Curated WHO GHED importer for GeoStats v16.2.6.

Accepts an official WHO Global Health Expenditure Database bulk export supplied by
release tooling.  The importer supports both long-form GHED exports (indicator/unit/
value columns) and wide extracts.  Indicator and unit matching is deliberately
explicit: ambiguous health-expenditure rows fail closed rather than being coerced
into a player-facing category.
"""
from __future__ import annotations

import argparse
import os
import re

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name, country_name_to_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, norm, normalized, number, read_official_rows, source_file_sha256
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG = "World Health Organization"
SOURCE_DATASET = "Global Health Expenditure Database (GHED), March 2026"
SOURCE_PAGE = "https://apps.who.int/nha/database/"
METHOD = "https://apps.who.int/nha/database/DocumentationCentre/en"

# key: title, definition, display unit, value type, direction, indicator aliases,
# accepted unit patterns, minimum common-year country coverage.
SPECS = {
    "health-spending-per-person": (
        "Highest health spending per person",
        "Current health expenditure per person in current US dollars.",
        "US dollars per person",
        "per_capita",
        "high",
        (
            "current health expenditure che per capita in us dollars",
            "current health expenditure per capita us dollars",
            "current health expenditure per capita us$",
            "che per capita us$",
        ),
        (r"usd", r"us dollar"),
        150,
    ),
    "gghe-gdp": (
        "Highest government health-spending share of GDP",
        "Domestic general government health expenditure as a share of gross domestic product.",
        "% of GDP",
        "percentage",
        "high",
        (
            "domestic general government health expenditure gghe d as percentage of gross domestic product gdp",
            "domestic general government health expenditure as percentage of gdp",
            "gghe d as percentage of gdp",
            "gghe d gdp",
        ),
        (r"percent", r"percentage.*gdp"),
        150,
    ),
    "private-che-share": (
        "Highest private share of health spending",
        "Domestic private health expenditure as a share of current health expenditure.",
        "% of health spending",
        "percentage",
        "high",
        (
            "domestic private health expenditure pvt d as percentage of current health expenditure che",
            "domestic private health expenditure as percentage of current health expenditure",
            "pvt d as percentage of che",
            "pvt d che",
        ),
        (r"percent", r"percentage.*che"),
        150,
    ),
    "external-che-share": (
        "Highest externally funded share of health spending",
        "External health expenditure as a share of current health expenditure.",
        "% of health spending",
        "percentage",
        "high",
        (
            "external health expenditure ext as percentage of current health expenditure che",
            "external health expenditure as percentage of current health expenditure",
            "ext as percentage of che",
            "ext che",
        ),
        (r"percent", r"percentage.*che"),
        120,
    ),
    "gghe-gge": (
        "Highest health share of government spending",
        "Domestic general government health expenditure as a share of general government expenditure.",
        "% of government spending",
        "percentage",
        "high",
        (
            "domestic general government health expenditure gghe d as percentage of general government expenditure gge",
            "domestic general government health expenditure as percentage of general government expenditure",
            "gghe d as percentage of gge",
            "gghe d gge",
        ),
        (r"percent", r"percentage.*gge", r"percent.*government"),
        150,
    ),
    "gghe-pc-usd": (
        "Highest government health spending per person",
        "Domestic general government health expenditure per person in current US dollars.",
        "US dollars per person",
        "per_capita",
        "high",
        (
            "domestic general government health expenditure gghe d per capita in us dollars",
            "domestic general government health expenditure per capita us dollars",
            "gghe d per capita us$",
            "gghe d pc usd",
        ),
        (r"usd", r"us dollar"),
        150,
    ),
    "gghe-che-share": (
        "Highest government-funded share of health spending",
        "Domestic general government health expenditure as a share of current health expenditure.",
        "% of health spending",
        "percentage",
        "high",
        (
            "domestic general government health expenditure gghe d as percentage of current health expenditure che",
            "domestic general government health expenditure as percentage of current health expenditure",
            "gghe d as percentage of che",
            "gghe d che",
        ),
        (r"percent", r"percentage.*che"),
        150,
    ),
    "private-pc-usd": (
        "Highest private health spending per person",
        "Domestic private health expenditure per person in current US dollars.",
        "US dollars per person",
        "per_capita",
        "high",
        (
            "domestic private health expenditure pvt d per capita in us dollars",
            "domestic private health expenditure per capita us dollars",
            "pvt d per capita us$",
            "pvt d pc usd",
        ),
        (r"usd", r"us dollar"),
        150,
    ),
    "external-pc-usd": (
        "Highest external health spending per person",
        "External health expenditure per person in current US dollars.",
        "US dollars per person",
        "per_capita",
        "high",
        (
            "external health expenditure ext per capita in us dollars",
            "external health expenditure per capita us dollars",
            "ext per capita us$",
            "ext pc usd",
        ),
        (r"usd", r"us dollar"),
        120,
    ),
    "oop-che-share": (
        "Highest out-of-pocket share of health spending",
        "Out-of-pocket expenditure as a share of current health expenditure.",
        "% of health spending",
        "percentage",
        "high",
        (
            "out of pocket expenditure oop as percentage of current health expenditure che",
            "out of pocket expenditure as percentage of current health expenditure",
            "oop as percentage of che",
            "oop che",
        ),
        (r"percent", r"percentage.*che"),
        150,
    ),
    "oop-pc-usd": (
        "Highest out-of-pocket health spending per person",
        "Out-of-pocket health expenditure per person in current US dollars.",
        "US dollars per person",
        "per_capita",
        "high",
        (
            "out of pocket expenditure oop per capita in us dollars",
            "out of pocket expenditure per capita us dollars",
            "oop per capita us$",
            "oop pc usd",
        ),
        (r"usd", r"us dollar"),
        150,
    ),
}

# Common machine-readable column aliases found in GHED extracts.  These are used
# only for wide exports; long exports still have to pass indicator + unit checks.
WIDE_ALIASES = {
    "health-spending-per-person": ("che_pc_usd", "che pc usd"),
    "gghe-gdp": ("gghe_d_gdp", "gghe d gdp"),
    "private-che-share": ("pvt_d_che", "pvtd_che", "pvt d che"),
    "external-che-share": ("ext_che", "ext che"),
    "gghe-gge": ("gghe_d_gge", "gghe d gge"),
    "gghe-pc-usd": ("gghe_d_pc_usd", "gghe d pc usd"),
    "gghe-che-share": ("gghe_d_che", "gghe d che"),
    "private-pc-usd": ("pvt_d_pc_usd", "pvtd_pc_usd", "pvt d pc usd"),
    "external-pc-usd": ("ext_pc_usd", "ext pc usd"),
    "oop-che-share": ("oop_che", "oop che"),
    "oop-pc-usd": ("oop_pc_usd", "oop pc usd"),
}


def _indicator_norm(value: object) -> str:
    text = str(value or "").replace("%", " percentage ").replace("US$", "US dollars").replace("us$", "us dollars")
    return norm(text).replace(" of ", " ")


def _matches_alias(text: str, aliases: tuple[str, ...]) -> bool:
    value = _indicator_norm(text)
    return any(_indicator_norm(alias) == value or _indicator_norm(alias) in value for alias in aliases)


def _unit_matches(unit: object, patterns: tuple[str, ...], *, allow_blank: bool = False) -> bool:
    text = norm(str(unit or "").replace("%", " percent ").replace("US$", "US dollars").replace("us$", "us dollars"))
    if not text:
        return allow_blank
    return any(re.search(pattern, text) for pattern in patterns)


def load(path: str):
    out: list[tuple[str, str, str, int, float, str, str]] = []
    for row in read_official_rows(path):
        data = normalized(row)
        iso3 = str(first_value(row, "iso3", "country code", "code") or "").upper().strip()
        country = str(first_value(row, "country", "country name") or "")
        if len(iso3) != 3:
            iso3 = country_name_to_iso3(country) or ""
        try:
            year = int(float(str(first_value(row, "year") or "")))
        except (TypeError, ValueError):
            continue
        if not iso3:
            continue

        indicator_raw = first_value(row, "indicator", "indicator name", "measure", "indicator label")
        indicator = str(indicator_raw or "")
        unit_raw = first_value(row, "unit", "units", "unit of measure")
        value_raw = first_value(row, "value", "numeric value", "numeric")

        matched = False
        if indicator and value_raw not in (None, ""):
            for key, (_, _, _, _, _, aliases, unit_patterns, _) in SPECS.items():
                if not _matches_alias(indicator, aliases):
                    continue
                if not _unit_matches(unit_raw, unit_patterns, allow_blank=True):
                    continue
                value = number(value_raw)
                if value is not None and value >= 0:
                    out.append((key, iso3, country, year, value, str(indicator_raw or ""), str(unit_raw or "")))
                    matched = True
                    break
        if matched:
            continue

        # Wide extracts: a variable-specific column is already an unambiguous
        # indicator identity, so a separate unit column is optional.  We still
        # never fall back to generic numeric columns.
        for key, aliases in WIDE_ALIASES.items():
            value = None
            matched_column = ""
            for alias in aliases:
                field = norm(alias)
                if field in data:
                    candidate = number(data.get(field))
                    if candidate is not None:
                        value = candidate
                        matched_column = alias
                        break
            if value is not None and value >= 0:
                out.append((key, iso3, country, year, value, matched_column, str(unit_raw or "")))
    return out


class Importer(WarehouseImporter):
    source_organization = SOURCE_ORG
    source_dataset = SOURCE_DATASET
    source_slug = "whoghed"

    def __init__(self, warehouse, input_path, dry_run=False):
        super().__init__(warehouse, dry_run=dry_run)
        self.rows = load(input_path)
        self.source_sha256 = source_file_sha256(input_path)

    def discover(self):
        out = []
        for key, (title, desc, unit, value_type, direction, aliases, unit_patterns, min_coverage) in SPECS.items():
            rule = IndicatorRule(
                key=key,
                title=title,
                description=desc,
                plain_language_description=desc,
                technical_definition=f"{desc} WHO Global Health Expenditure Database definition.",
                unit_explanation=unit,
                family="Health",
                icon="🏥",
                unit=unit,
                value_type=value_type,
                ranking_direction=direction,
                include=aliases,
                min_coverage=min_coverage,
                evidence_tier="A",
                source_priority=4,
                specificity_score=99,
                recognizability_score=98,
                understandability_score=98,
                fun_score=92,
            )
            out.append(
                CandidateDefinition(
                    rule,
                    f"GHED:{key}",
                    title,
                    SOURCE_PAGE,
                    {
                        "source_page_url": SOURCE_PAGE,
                        "methodology_url": METHOD,
                        "dataset_release": "GHED March 2026",
                        "source_query": {
                            "indicator_aliases": list(aliases),
                            "accepted_unit_patterns": list(unit_patterns),
                        },
                        "measurementType": value_type,
                        "broadDomain": "health",
                        "knowledgeCluster": "health-spending",
                        "strategyFamily": key,
                        "v16_2_6_content_reviewed": True,
                        "source_file_sha256": self.source_sha256,
                    },
                )
            )
        return out

    def fetch_observations(self, candidate):
        out = []
        for key, iso3, country, year, value, source_indicator, source_unit in self.rows:
            if key != candidate.rule.key:
                continue
            out.append(
                SourceObservation(
                    iso3,
                    canonical_country_name(iso3, country or iso3),
                    year,
                    value,
                    SOURCE_PAGE,
                    f"{key}:{iso3}:{year}",
                    "official",
                    {"source_indicator": source_indicator, "source_unit": source_unit},
                )
            )
        return out

    def category_id(self, candidate):
        return f"whoghed:{candidate.rule.key}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set Supabase secrets.")
    print(Importer(None if args.dry_run else SupabaseWarehouse(url, key), args.input, args.dry_run).run())


if __name__ == "__main__":
    main()
