#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES, canonical_country_name
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, number, read_official_rows, source_file_sha256
from data_pipeline.strict_bulk import StrictBulkSpec
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG = "World Bank"
SOURCE_DATASET = "Global Findex Database 2025 (2024 survey round)"
SOURCE_PAGE = "https://www.worldbank.org/en/publication/globalfindex/download-data"

# The 2025 country CSV uses compact variable codes and stores shares as 0-1
# proportions. Only codes confirmed in the official file are imported here.
# GeoStats intentionally keeps this family small rather than proliferating
# dozens of near-duplicate financial-inclusion variants.
SPECS = (
    StrictBulkSpec("account-ownership", "Highest account ownership", ("account_t_d",), "% of adults", "percentage", "high", 0, 100, multiplier=100, min_coverage=120),
    StrictBulkSpec("financial-institution-account", "Highest financial-institution account ownership", ("fiaccount_t_d",), "% of adults", "percentage", "high", 0, 100, multiplier=100, min_coverage=110),
    StrictBulkSpec("mobile-money-account", "Highest mobile-money account ownership", ("mobileaccount_t_d",), "% of adults", "percentage", "high", 0, 100, multiplier=100, min_coverage=90),
    StrictBulkSpec("borrowed-any-money", "Highest share who borrowed money", ("borrow_any_t_d",), "% of adults", "percentage", "high", 0, 100, multiplier=100, min_coverage=100),
    StrictBulkSpec("digital-merchant-payment", "Highest digital merchant-payment use", ("merchant_pay",), "% of adults", "percentage", "high", 0, 100, multiplier=100, min_coverage=90),
    StrictBulkSpec("saved-any-money", "Highest share who saved money", ("save_any_t_d",), "% of adults", "percentage", "high", 0, 100, multiplier=100, min_coverage=100),
)


def _guard_value(spec: StrictBulkSpec, raw_value: float) -> float:
    value = float(raw_value) * spec.multiplier
    if spec.minimum is not None and value < spec.minimum - 1e-9:
        raise RuntimeError(f"{spec.key}: value {value} is below allowed minimum {spec.minimum}.")
    if spec.maximum is not None and value > spec.maximum + 1e-9:
        raise RuntimeError(f"{spec.key}: value {value} exceeds allowed maximum {spec.maximum}.")
    return value


class Importer(WarehouseImporter):
    source_organization = SOURCE_ORG
    source_dataset = SOURCE_DATASET
    source_slug = "globalfindex2025"

    def __init__(self, warehouse, input_path=None, dry_run=False):
        super().__init__(warehouse, dry_run=dry_run)
        self.input_path = input_path
        self._parsed = None

    def _data(self):
        if self._parsed is not None:
            return self._parsed
        if not self.input_path:
            raise RuntimeError("Global Findex importer requires the exact official 2025 country-level CSV via --input.")

        rows = read_official_rows(self.input_path)
        source_hash = source_file_sha256(self.input_path)
        stores: dict[str, dict[tuple[str, int], SourceObservation]] = {spec.key: {} for spec in SPECS}

        for row in rows:
            # The official release contains subgroup rows. GeoStats uses the
            # nationally representative total-population row only.
            if str(first_value(row, "group") or "").strip().lower() != "all":
                continue
            if str(first_value(row, "group2") or "").strip().lower() != "all":
                continue
            raw_year = first_value(row, "year")
            try:
                year = int(float(str(raw_year)))
            except (TypeError, ValueError):
                continue
            if year != 2024:
                continue

            iso3 = str(first_value(row, "codewb") or "").strip().upper()
            if iso3 not in CANONICAL_COUNTRY_NAMES:
                continue
            source_name = str(first_value(row, "countrynewwb") or iso3)
            name = canonical_country_name(iso3, source_name)

            for spec in SPECS:
                parsed = number(first_value(row, *spec.aliases))
                if parsed is None:
                    continue
                value = _guard_value(spec, parsed)
                key = (iso3, year)
                prior = stores[spec.key].get(key)
                if prior is not None and abs(prior.value - value) > 1e-9:
                    raise RuntimeError(f"{spec.key}: contradictory duplicate for {iso3} {year}: {prior.value} vs {value}.")
                stores[spec.key][key] = SourceObservation(
                    iso3,
                    name,
                    year,
                    value,
                    str(Path(self.input_path)),
                    f"{spec.key}:{iso3}:{year}",
                    "official",
                    {
                        "column": spec.aliases[0],
                        "source_file_sha256": source_hash,
                        "strict_exact_column_match": True,
                        "findex_group": "all",
                        "findex_group2": "all",
                        "source_scale": "0-1 proportion multiplied by 100 for player display",
                    },
                )

        self._parsed = {key: [store[k] for k in sorted(store)] for key, store in stores.items()}
        return self._parsed

    def discover(self):
        out = []
        for spec in SPECS:
            desc = f"{spec.title} in the World Bank Global Findex 2025 edition, using the 2024 nationally representative survey round."
            rule = IndicatorRule(
                key=spec.key,
                title=spec.title,
                description=desc,
                plain_language_description=desc,
                technical_definition=f"Exact official Global Findex 2025 country CSV column {spec.aliases[0]!r}; group=all and group2=all only; official 0-1 proportion multiplied by 100.",
                unit_explanation=spec.unit,
                family="Financial & digital inclusion",
                icon="💳",
                unit=spec.unit,
                value_type="percentage",
                ranking_direction="high",
                include=spec.aliases,
                min_coverage=spec.min_coverage,
                evidence_tier="A",
                source_priority=7,
                specificity_score=98,
                recognizability_score=92,
                understandability_score=94,
                fun_score=90,
            )
            out.append(CandidateDefinition(rule, f"FINDEX2025:{spec.key}", spec.title, SOURCE_PAGE, {
                "source_page_url": SOURCE_PAGE,
                "dataset_release": "Global Findex 2025",
                "reference_year": 2024,
                "source_query": {"accepted_exact_columns": spec.aliases, "row_filter": {"group": "all", "group2": "all", "year": 2024}},
                "official_bulk_input_required": True,
                "manual_review_required": True,
                "canonical_country_universe_only": True,
                "v16_2_6_content_reviewed": True,
            }))
        return out

    def fetch_observations(self, candidate):
        return self._data().get(candidate.rule.key, [])

    def category_id(self, candidate):
        return f"global-findex:{candidate.rule.key}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run and (not url or not key):
        raise SystemExit("Set Supabase secrets.")
    result = Importer(None if args.dry_run else SupabaseWarehouse(url, key), args.input, args.dry_run).run(only_keys=set(args.only) or None)
    print(result)
    if not args.dry_run:
        selected = int(result.get("candidates_selected") or 0)
        verified = int(result.get("source_integrity_verified") or 0)
        failed = int(result.get("source_integrity_failed") or 0)
        observations = int(result.get("observations_inserted") or 0)
        if selected == 0 or observations == 0 or failed != 0 or verified != selected:
            raise SystemExit(f"Global Findex import failed closed: selected={selected}, observations={observations}, verified={verified}, failed={failed}.")


if __name__ == "__main__":
    main()
