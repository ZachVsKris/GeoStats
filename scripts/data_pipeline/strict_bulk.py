from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Callable, Iterable, Sequence

from .canonical_countries import canonical_country_name, country_name_to_iso3
from .countries import normalize_iso3
from .models import SourceObservation
from .official_tabular import first_value, norm, number, read_official_rows, source_file_sha256


@dataclass(frozen=True)
class StrictBulkSpec:
    key: str
    title: str
    aliases: tuple[str, ...]
    unit: str
    value_type: str = "other"
    ranking_direction: str = "high"
    minimum: float | None = None
    maximum: float | None = None
    multiplier: float = 1.0
    denominator_label: str | None = None
    eligible_universe_type: str = "universal"
    min_coverage: int = 100


def exact_norm_match(value: object, aliases: Sequence[str]) -> bool:
    target = norm(value)
    return bool(target) and any(target == norm(alias) for alias in aliases)


def country_iso3(row: dict[str, object], *, code_fields: Sequence[str] = ("ISO3", "ISO alpha-3", "Country Code", "Economy Code", "Code"), name_fields: Sequence[str] = ("Country", "Country or Area", "Economy", "Location", "Area")) -> str | None:
    for field in code_fields:
        raw = first_value(row, field)
        if raw not in (None, ""):
            code = normalize_iso3(raw)
            if code:
                return code
    for field in name_fields:
        raw = first_value(row, field)
        if raw not in (None, ""):
            code = country_name_to_iso3(str(raw))
            if code:
                return code
    return None


def country_label(row: dict[str, object], iso3: str, *, name_fields: Sequence[str] = ("Country", "Country or Area", "Economy", "Location", "Area")) -> str:
    for field in name_fields:
        raw = first_value(row, field)
        if raw not in (None, ""):
            return canonical_country_name(iso3, str(raw))
    return canonical_country_name(iso3, iso3)


def row_year(row: dict[str, object], *, fields: Sequence[str] = ("Year", "Reference year", "Data year", "TIME_PERIOD", "Time Period"), default: int | None = None) -> int | None:
    for field in fields:
        raw = first_value(row, field)
        if raw in (None, ""):
            continue
        try:
            return int(float(str(raw).strip()))
        except ValueError:
            text = str(raw).strip()
            if len(text) >= 4 and text[:4].isdigit():
                return int(text[:4])
    return default


def _guard_value(spec: StrictBulkSpec, value: float) -> float:
    value = float(value) * spec.multiplier
    if spec.minimum is not None and value < spec.minimum - 1e-9:
        raise RuntimeError(f"{spec.key}: value {value} is below allowed minimum {spec.minimum}.")
    if spec.maximum is not None and value > spec.maximum + 1e-9:
        raise RuntimeError(f"{spec.key}: value {value} exceeds allowed maximum {spec.maximum}.")
    return value


def _insert_unique(store: dict[tuple[str, int], tuple[str, float, dict[str, object]]], *, spec: StrictBulkSpec, iso3: str, year: int, name: str, value: float, metadata: dict[str, object]) -> None:
    key = (iso3, year)
    prior = store.get(key)
    if prior is not None and abs(prior[1] - value) > 1e-9:
        raise RuntimeError(f"{spec.key}: contradictory duplicate for {iso3} {year}: {prior[1]} vs {value}.")
    store[key] = (name, value, metadata)


def parse_long_indicator_file(
    path: str,
    specs: Sequence[StrictBulkSpec],
    *,
    indicator_fields: Sequence[str] = ("Indicator", "Indicator Name", "Series", "Series Name", "Variable", "Variable Name"),
    indicator_code_fields: Sequence[str] = ("Indicator Code", "Series Code", "Variable Code"),
    value_fields: Sequence[str] = ("Value", "OBS_VALUE", "Observation Value"),
    default_year: int | None = None,
    fixed_year: int | None = None,
) -> dict[str, list[SourceObservation]]:
    rows = read_official_rows(path)
    out: dict[str, dict[tuple[str, int], tuple[str, float, dict[str, object]]]] = {spec.key: {} for spec in specs}
    for row in rows:
        iso3 = country_iso3(row)
        if not iso3:
            continue
        year = row_year(row, default=default_year)
        if year is None or (fixed_year is not None and year != fixed_year):
            continue
        label = country_label(row, iso3)
        indicator_values = [first_value(row, field) for field in (*indicator_code_fields, *indicator_fields)]
        raw_value = next((first_value(row, field) for field in value_fields if first_value(row, field) not in (None, "")), None)
        parsed = number(raw_value)
        if parsed is None:
            continue
        for spec in specs:
            if not any(exact_norm_match(value, spec.aliases) for value in indicator_values if value not in (None, "")):
                continue
            value = _guard_value(spec, parsed)
            _insert_unique(out[spec.key], spec=spec, iso3=iso3, year=year, name=label, value=value, metadata={"indicator": next((str(v) for v in indicator_values if v not in (None, "")), "")})
    source_hash = source_file_sha256(path)
    return {
        spec.key: [
            SourceObservation(iso3, name, year, value, str(Path(path)), f"{spec.key}:{iso3}:{year}", "official", {**metadata, "source_file_sha256": source_hash, "strict_exact_indicator_match": True})
            for (iso3, year), (name, value, metadata) in sorted(out[spec.key].items())
        ]
        for spec in specs
    }


def parse_wide_metric_file(
    path: str,
    specs: Sequence[StrictBulkSpec],
    *,
    default_year: int | None = None,
    fixed_year: int | None = None,
    code_fields: Sequence[str] = ("ISO3", "ISO alpha-3", "Country Code", "Economy Code", "Code"),
    name_fields: Sequence[str] = ("Country", "Country or Area", "Economy", "Location", "Area"),
    row_filter: Callable[[dict[str, object]], bool] | None = None,
) -> dict[str, list[SourceObservation]]:
    rows = read_official_rows(path)
    out: dict[str, dict[tuple[str, int], tuple[str, float, dict[str, object]]]] = {spec.key: {} for spec in specs}
    for row in rows:
        if row_filter is not None and not row_filter(row):
            continue
        iso3 = country_iso3(row, code_fields=code_fields, name_fields=name_fields)
        if not iso3:
            continue
        year = row_year(row, default=default_year)
        if year is None or (fixed_year is not None and year != fixed_year):
            continue
        label = country_label(row, iso3, name_fields=name_fields)
        normalized_headers = {norm(key): key for key in row}
        for spec in specs:
            matched_header = next((normalized_headers.get(norm(alias)) for alias in spec.aliases if normalized_headers.get(norm(alias)) is not None), None)
            if matched_header is None:
                continue
            parsed = number(row.get(matched_header))
            if parsed is None:
                continue
            value = _guard_value(spec, parsed)
            _insert_unique(out[spec.key], spec=spec, iso3=iso3, year=year, name=label, value=value, metadata={"column": matched_header})
    source_hash = source_file_sha256(path)
    return {
        spec.key: [
            SourceObservation(iso3, name, year, value, str(Path(path)), f"{spec.key}:{iso3}:{year}", "official", {**metadata, "source_file_sha256": source_hash, "strict_exact_column_match": True})
            for (iso3, year), (name, value, metadata) in sorted(out[spec.key].items())
        ]
        for spec in specs
    }


def parse_wide_metric_year_file(
    path: str,
    specs: Sequence[StrictBulkSpec],
    *,
    code_fields: Sequence[str] = ("ISO3", "ISO alpha-3", "Country Code", "Economy Code", "Code"),
    name_fields: Sequence[str] = ("Country", "Country or Area", "Economy", "Location", "Area"),
    min_year: int | None = None,
    max_year: int | None = None,
    fixed_year: int | None = None,
    row_filter: Callable[[dict[str, object]], bool] | None = None,
) -> dict[str, list[SourceObservation]]:
    """Parse official wide tables whose metric columns are named `<metric>_<YYYY>`.

    Matching is exact on the metric portion after normalization.  It never uses
    substring/fuzzy matching, so similarly named ranks, subgroups, and component
    columns cannot be silently substituted for a requested series.
    """
    rows = read_official_rows(path)
    out: dict[str, dict[tuple[str, int], tuple[str, float, dict[str, object]]]] = {spec.key: {} for spec in specs}
    year_header = re.compile(r"^(.*)_([12][0-9]{3})$")
    header_matches: dict[str, list[tuple[str, int]]] = {spec.key: [] for spec in specs}
    if rows:
        for header in rows[0]:
            match = year_header.fullmatch(str(header).strip())
            if not match:
                continue
            base, year_text = match.groups()
            year = int(year_text)
            if fixed_year is not None and year != fixed_year:
                continue
            if min_year is not None and year < min_year:
                continue
            if max_year is not None and year > max_year:
                continue
            for spec in specs:
                if exact_norm_match(base, spec.aliases):
                    header_matches[spec.key].append((header, year))
    for row in rows:
        if row_filter is not None and not row_filter(row):
            continue
        iso3 = country_iso3(row, code_fields=code_fields, name_fields=name_fields)
        if not iso3:
            continue
        label = country_label(row, iso3, name_fields=name_fields)
        for spec in specs:
            for header, year in header_matches[spec.key]:
                parsed = number(row.get(header))
                if parsed is None:
                    continue
                value = _guard_value(spec, parsed)
                _insert_unique(out[spec.key], spec=spec, iso3=iso3, year=year, name=label, value=value, metadata={"column": header, "metric_year_column": True})
    source_hash = source_file_sha256(path)
    return {
        spec.key: [
            SourceObservation(iso3, name, year, value, str(Path(path)), f"{spec.key}:{iso3}:{year}", "official", {**metadata, "source_file_sha256": source_hash, "strict_exact_metric_year_match": True})
            for (iso3, year), (name, value, metadata) in sorted(out[spec.key].items())
        ]
        for spec in specs
    }
