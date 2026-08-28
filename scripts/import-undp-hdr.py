#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

from data_pipeline.base import WarehouseImporter
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES, canonical_country_name
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation
from data_pipeline.official_tabular import first_value, number, read_official_rows, source_file_sha256
from data_pipeline.strict_bulk import StrictBulkSpec
from data_pipeline.supabase import SupabaseWarehouse

SOURCE_ORG = "UNDP"
SOURCE_DATASET = "Human Development Reports Data Center"
SOURCE_PAGE = "https://hdr.undp.org/data-center"
DOWNLOAD_PAGE = "https://hdr.undp.org/data-center/documentation-and-downloads"

# The official HDR 2025 composite-index export is a wide time-series file:
# one country per row and metric_year columns such as hdi_2023 and ihdi_2023.
# Keep a deliberately small, distinct set; MPI is not in this exact composite
# file and sex-specific HDI variants are excluded by GeoStats product policy.
SPECS = (
    StrictBulkSpec("hdi", "Highest Human Development Index", ("hdi",), "HDI", "index", "high", 0, 1, min_coverage=180),
    StrictBulkSpec("ihdi", "Highest inequality-adjusted Human Development Index", ("ihdi",), "IHDI", "index", "high", 0, 1, min_coverage=150),
    StrictBulkSpec("hdi-inequality-loss", "Largest human-development loss to inequality", ("loss",), "%", "percentage", "high", 0, 100, min_coverage=150),
    StrictBulkSpec("human-inequality-coefficient", "Highest coefficient of human inequality", ("coef_ineq",), "%", "percentage", "high", 0, 100, min_coverage=150),
    StrictBulkSpec("life-expectancy-inequality", "Highest inequality in life expectancy", ("ineq_le",), "%", "percentage", "high", 0, 100, min_coverage=150),
    StrictBulkSpec("education-inequality", "Highest inequality in education", ("ineq_edu",), "%", "percentage", "high", 0, 100, min_coverage=150),
    StrictBulkSpec("income-inequality", "Highest inequality in income", ("ineq_inc",), "%", "percentage", "high", 0, 100, min_coverage=150),
    StrictBulkSpec("gdi", "Highest Gender Development Index", ("gdi",), "GDI", "index", "high", 0, 1.5, min_coverage=160),
    StrictBulkSpec("gii", "Highest Gender Inequality Index", ("gii",), "GII", "index", "high", 0, 1, min_coverage=160),
    StrictBulkSpec("phdi", "Highest planetary pressures-adjusted HDI", ("phdi",), "PHDI", "index", "high", 0, 1, min_coverage=150),
)


def _guard_value(spec: StrictBulkSpec, value: float) -> float:
    value = float(value) * spec.multiplier
    if spec.minimum is not None and value < spec.minimum - 1e-9:
        raise RuntimeError(f"{spec.key}: value {value} is below allowed minimum {spec.minimum}.")
    if spec.maximum is not None and value > spec.maximum + 1e-9:
        raise RuntimeError(f"{spec.key}: value {value} exceeds allowed maximum {spec.maximum}.")
    return value


class Importer(WarehouseImporter):
    source_organization = SOURCE_ORG
    source_dataset = SOURCE_DATASET
    source_slug = "undphdr"

    def __init__(self, warehouse, input_path=None, dry_run=False):
        super().__init__(warehouse, dry_run=dry_run)
        self.input_path = input_path
        self._parsed = None

    def _data(self):
        if self._parsed is not None:
            return self._parsed
        if not self.input_path:
            raise RuntimeError("UNDP HDR importer requires the exact official HDR25 composite-index time-series CSV via --input.")

        rows = read_official_rows(self.input_path)
        if not rows:
            raise RuntimeError("UNDP HDR official bulk file contains no data rows.")

        source_hash = source_file_sha256(self.input_path)
        stores: dict[str, dict[tuple[str, int], SourceObservation]] = {spec.key: {} for spec in SPECS}
        metric_codes = {spec.aliases[0].lower(): spec for spec in SPECS}
        header_map: list[tuple[str, StrictBulkSpec, int]] = []

        # The exact official schema is metric_YYYY. Do not fuzzy-match labels:
        # only explicit metric codes in SPECS are accepted.
        for header in rows[0].keys():
            match = re.fullmatch(r"([A-Za-z0-9_]+)_(\d{4})", str(header).strip())
            if not match:
                continue
            spec = metric_codes.get(match.group(1).lower())
            if spec is None:
                continue
            year = int(match.group(2))
            if 1990 <= year <= 2100:
                header_map.append((header, spec, year))

        if not header_map:
            raise RuntimeError("UNDP HDR schema mismatch: no exact metric_YYYY columns matched the curated metric codes.")

        for row in rows:
            iso3 = str(first_value(row, "iso3") or "").strip().upper()
            if iso3 not in CANONICAL_COUNTRY_NAMES:
                continue
            source_name = str(first_value(row, "country") or iso3)
            name = canonical_country_name(iso3, source_name)

            for header, spec, year in header_map:
                parsed = number(row.get(header))
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
                    {"column": header, "source_file_sha256": source_hash, "strict_exact_metric_year_match": True},
                )

        self._parsed = {key: [store[k] for k in sorted(store)] for key, store in stores.items()}
        return self._parsed

    def discover(self):
        out = []
        for spec in SPECS:
            desc = f"{spec.title} using the official UNDP Human Development Reports country dataset."
            metric_code = spec.aliases[0]
            rule = IndicatorRule(
                key=spec.key,
                title=spec.title,
                description=desc,
                plain_language_description=desc,
                technical_definition=f"Exact official UNDP HDR 2025 time-series columns {metric_code}_YYYY only. Common-year selection is performed after import; no interpolation or manual fills.",
                unit_explanation=spec.unit,
                family="Human development",
                icon="🌍",
                unit=spec.unit,
                value_type=spec.value_type,
                ranking_direction="high",
                include=spec.aliases,
                min_coverage=spec.min_coverage,
                evidence_tier="A",
                source_priority=8,
                specificity_score=99,
                recognizability_score=95,
                understandability_score=92,
                fun_score=88,
            )
            out.append(CandidateDefinition(rule, f"UNDPHDR:{spec.key}", spec.title, SOURCE_PAGE, {
                "source_page_url": SOURCE_PAGE,
                "download_page": DOWNLOAD_PAGE,
                "dataset_release": "Human Development Report 2025 composite-index time series",
                "source_query": {"accepted_exact_metric_code": metric_code},
                "official_bulk_input_required": True,
                "manual_review_required": True,
                "common_year_required": True,
                "canonical_country_universe_only": True,
                "v16_2_6_content_reviewed": True,
            }))
        return out

    def fetch_observations(self, candidate):
        return self._data().get(candidate.rule.key, [])

    def category_id(self, candidate):
        return f"undp-hdr:{candidate.rule.key}"


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
            raise SystemExit(f"UNDP HDR import failed closed: selected={selected}, observations={observations}, verified={verified}, failed={failed}.")


if __name__ == "__main__":
    main()
