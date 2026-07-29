#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.countries import normalize_iso3
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.supabase import SupabaseWarehouse


@dataclass(frozen=True)
class PhysicalRule:
    source: str
    source_organization: str
    source_dataset: str
    source_page: str
    methodology_url: str
    rule: IndicatorRule
    broad_domain: str
    knowledge_cluster: str
    strategy_family: str


def make_rule(
    source: str,
    organization: str,
    dataset: str,
    page: str,
    methodology: str,
    key: str,
    title: str,
    description: str,
    icon: str,
    unit: str,
    *,
    family: str,
    value_type: str = "other",
    minimum_coverage: int = 150,
    fun: int = 96,
) -> PhysicalRule:
    broad = "physical-geography"
    cluster = (
        "land-cover" if source == "worldcover"
        else "physical-waterways" if source == "hydrosheds"
        else "terrain-elevation"
    )
    strategy = (
        "land-cover" if source == "worldcover"
        else "hydrography" if source == "hydrosheds"
        else "terrain"
    )
    return PhysicalRule(
        source=source,
        source_organization=organization,
        source_dataset=dataset,
        source_page=page,
        methodology_url=methodology,
        rule=IndicatorRule(
            key=key,
            title=title,
            description=description,
            plain_language_description=description,
            technical_definition=f"{description} Calculated from a fixed, documented global source and country-boundary set.",
            unit_explanation=unit,
            family=family,
            icon=icon,
            unit=unit,
            value_type=value_type,  # type: ignore[arg-type]
            ranking_direction="high",
            include=(key,),
            min_coverage=minimum_coverage,
            evidence_tier="B",
            source_priority=14,
            specificity_score=98,
            recognizability_score=97,
            understandability_score=98,
            fun_score=fun,
            objective_status="objective",
        ),
        broad_domain=broad,
        knowledge_cluster=cluster,
        strategy_family=strategy,
    )


WORLDCOVER_PAGE = "https://esa-worldcover.org/en/data-access"
HYDRO_PAGE = "https://www.hydrosheds.org/products"
ELEVATION_PAGE = "https://www.gebco.net/data-products-gridded-bathymetry-data"

RULES: dict[str, PhysicalRule] = {
    item.rule.key: item
    for item in (
        make_rule("worldcover","ESA WorldCover","ESA WorldCover 2021 country summaries",WORLDCOVER_PAGE,WORLDCOVER_PAGE,
                  "grassland-share","Most grassland","Share of land classified as grassland in ESA WorldCover 2021.","🌾","% of land",family="Land cover",value_type="percentage"),
        make_rule("worldcover","ESA WorldCover","ESA WorldCover 2021 country summaries",WORLDCOVER_PAGE,WORLDCOVER_PAGE,
                  "grassland-area","Largest grassland area","Land area classified as grassland in ESA WorldCover 2021.","🌾","square kilometers",family="Land cover"),
        make_rule("worldcover","ESA WorldCover","ESA WorldCover 2021 country summaries",WORLDCOVER_PAGE,WORLDCOVER_PAGE,
                  "shrubland-share","Most shrubland","Share of land classified as shrubland in ESA WorldCover 2021.","🌿","% of land",family="Land cover",value_type="percentage"),
        make_rule("worldcover","ESA WorldCover","ESA WorldCover 2021 country summaries",WORLDCOVER_PAGE,WORLDCOVER_PAGE,
                  "wetland-area","Largest wetland area","Land area classified as herbaceous wetland in ESA WorldCover 2021.","🪷","square kilometers",family="Land cover"),
        make_rule("worldcover","ESA WorldCover","ESA WorldCover 2021 country summaries",WORLDCOVER_PAGE,WORLDCOVER_PAGE,
                  "bare-land-share","Most bare land","Share of land classified as bare or sparsely vegetated in ESA WorldCover 2021.","🏜️","% of land",family="Land cover",value_type="percentage"),
        make_rule("worldcover","ESA WorldCover","ESA WorldCover 2021 country summaries",WORLDCOVER_PAGE,WORLDCOVER_PAGE,
                  "snow-ice-area","Most permanent snow and ice","Area classified as permanent snow and ice in ESA WorldCover 2021.","❄️","square kilometers",family="Land cover",minimum_coverage=50),
        make_rule("hydrosheds","HydroSHEDS","HydroRIVERS country summaries",HYDRO_PAGE,HYDRO_PAGE,
                  "river-density","Highest river density","Kilometers of HydroRIVERS river reaches per 1,000 square kilometers of land.","💧","km per 1,000 km²",family="Geography"),
        make_rule("hydrosheds","HydroSHEDS","HydroRIVERS country summaries",HYDRO_PAGE,HYDRO_PAGE,
                  "river-length","Longest river network","Combined length of HydroRIVERS river reaches inside the country.","🏞️","kilometers",family="Geography"),
        make_rule("hydrosheds","HydroSHEDS","HydroLAKES country summaries",HYDRO_PAGE,HYDRO_PAGE,
                  "lake-count","Most lakes","Number of HydroLAKES lake polygons with an area of at least 10 hectares.","💦","lakes",family="Geography"),
        make_rule("hydrosheds","HydroSHEDS","HydroLAKES country summaries",HYDRO_PAGE,HYDRO_PAGE,
                  "lake-area","Most lake area","Combined area of HydroLAKES lake polygons.","🏞️","square kilometers",family="Geography"),
        make_rule("elevation","Global Elevation","Fixed-grid country elevation summaries",ELEVATION_PAGE,ELEVATION_PAGE,
                  "mean-elevation","Highest average elevation","Average land elevation from the documented global elevation grid.","⛰️","meters",family="Terrain"),
        make_rule("elevation","Global Elevation","Fixed-grid country elevation summaries",ELEVATION_PAGE,ELEVATION_PAGE,
                  "elevation-range","Greatest elevation range","Difference between the highest and lowest land elevations in the country.","🏔️","meters",family="Terrain"),
        make_rule("elevation","Global Elevation","Fixed-grid country elevation summaries",ELEVATION_PAGE,ELEVATION_PAGE,
                  "land-above-1000m-share","Most high-elevation land","Share of land at least 1,000 meters above sea level.","⛰️","% of land",family="Terrain",value_type="percentage"),
        make_rule("elevation","Global Elevation","Fixed-grid country elevation summaries",ELEVATION_PAGE,ELEVATION_PAGE,
                  "land-below-sea-level-area","Most land below sea level","Land area below mean sea level in the documented elevation grid.","⬇️","square kilometers",family="Terrain",minimum_coverage=40),
    )
}


REQUIRED_COLUMNS = {
    "source", "metric", "country_iso3", "data_year", "value", "unit",
    "dataset_release", "source_url", "methodology_url", "derivation_method",
    "boundary_dataset",
}


def _read_input(value: str) -> str:
    path = Path(value)
    if path.exists():
        return path.read_text(encoding="utf-8-sig")
    request = Request(value, headers={"User-Agent": "GeoStats/15.5 physical summary importer"})
    with urlopen(request, timeout=240) as response:
        return response.read().decode("utf-8-sig")


class PhysicalSummaryImporter(WarehouseImporter):
    def __init__(self, warehouse: SupabaseWarehouse | None, *, source: str, input_value: str, dry_run: bool = False):
        if source not in {"worldcover", "hydrosheds", "elevation"}:
            raise ValueError(f"Unsupported physical source: {source}")
        self.source_slug = source
        source_rule = next(item for item in RULES.values() if item.source == source)
        self.source_organization = source_rule.source_organization
        self.source_dataset = source_rule.source_dataset
        self.input_value = input_value
        self._rows: list[dict[str, str]] | None = None
        super().__init__(warehouse, dry_run=dry_run)

    def rows(self) -> list[dict[str, str]]:
        if self._rows is None:
            reader = csv.DictReader(_read_input(self.input_value).splitlines())
            missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
            if missing:
                raise RuntimeError(f"Physical summary CSV is missing columns: {', '.join(sorted(missing))}")
            rows = [dict(row) for row in reader if str(row.get("source") or "").strip() == self.source_slug]
            if not rows:
                raise RuntimeError(f"No rows for source={self.source_slug} were found.")
            self._rows = rows
        return self._rows

    def discover(self) -> list[CandidateDefinition]:
        metrics = {str(row.get("metric") or "").strip() for row in self.rows()}
        result: list[CandidateDefinition] = []
        for metric in sorted(metrics):
            item = RULES.get(metric)
            if not item or item.source != self.source_slug:
                raise RuntimeError(f"Unknown or mismatched physical metric: {metric}")
            sample = next(row for row in self.rows() if row.get("metric") == metric)
            if sample.get("unit") != item.rule.unit:
                raise RuntimeError(f"{metric} unit {sample.get('unit')!r} does not match expected {item.rule.unit!r}.")
            result.append(CandidateDefinition(
                rule=item.rule,
                source_indicator_code=f"{self.source_slug.upper()}_{metric.upper().replace('-', '_')}",
                source_indicator_name=item.rule.title,
                source_url=sample["source_url"],
                metadata={
                    "source_page_url": item.source_page,
                    "exact_query_url": sample.get("exact_query_url") or sample["source_url"],
                    "download_url": sample.get("download_url") or None,
                    "api_url": sample.get("api_url") or None,
                    "dataset_release": sample["dataset_release"],
                    "license_name": sample.get("license_name") or None,
                    "license_url": sample.get("license_url") or None,
                    "minimum_year": int(sample["data_year"]),
                    "source_query": {
                        "metric": metric,
                        "unit": item.rule.unit,
                        "year": int(sample["data_year"]),
                        "boundaryDataset": sample["boundary_dataset"],
                    },
                    "methodology_url": sample["methodology_url"],
                    "derivation_method": sample["derivation_method"],
                    "derivation_version": sample.get("derivation_version") or "geostats-physical-summary-v15.5",
                    "input_datasets": [
                        sample["source_url"],
                        sample["boundary_dataset"],
                    ],
                    "broadDomain": item.broad_domain,
                    "knowledgeCluster": item.knowledge_cluster,
                    "strategyFamily": item.strategy_family,
                },
            ))
        return result

    def category_id(self, candidate: CandidateDefinition) -> str:
        return f"{self.source_slug}:{candidate.rule.key}"

    def fetch_observations(self, candidate: CandidateDefinition) -> list[SourceObservation]:
        metric = candidate.rule.key
        observations: list[SourceObservation] = []
        for row in self.rows():
            if row.get("metric") != metric:
                continue
            iso3 = normalize_iso3(row.get("country_iso3"))
            if not iso3:
                continue
            try:
                value = float(row["value"])
                year = int(row["data_year"])
            except (TypeError, ValueError):
                continue
            observations.append(SourceObservation(
                country_iso3=iso3,
                country_name=canonical_country_name(iso3),
                data_year=year,
                value=value,
                source_url=row["source_url"],
                source_record_id=f"{metric}:{iso3}:{year}",
                evidence_status="official",
                metadata={
                    "metric": metric,
                    "unit": row["unit"],
                    "dataset_release": row["dataset_release"],
                    "boundary_dataset": row["boundary_dataset"],
                    "derivation_method": row["derivation_method"],
                },
            ))
        return observations


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, choices=["worldcover", "hydrosheds", "elevation"])
    parser.add_argument("--input", required=True, help="Local CSV path or HTTPS URL.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.")
    warehouse = None if args.dry_run else SupabaseWarehouse(url or "", key or "")
    result = PhysicalSummaryImporter(
        warehouse,
        source=args.source,
        input_value=args.input,
        dry_run=args.dry_run,
    ).run(only_keys=set(args.only) or None)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
