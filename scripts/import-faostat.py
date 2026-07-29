#!/usr/bin/env python3
"""Import total FAOSTAT QCL production categories for GeoStats.

GeoStats intentionally imports only absolute national production totals from QCL.
Yield, harvested area, stocks, animal counts, slaughter counts, per-hectare and
per-animal efficiency measures are excluded because they are not immediately intuitive
for general gameplay. Missing reports remain missing, reporting flags are retained,
and every candidate still passes the commodity-aware quality and provenance gates.
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import sqlite3
import statistics
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import urllib.parse
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence

from data_pipeline.canonical_countries import canonical_country_name
from data_pipeline.integrity import VALIDATION_VERSION, competition_ranks, snapshot_checksum, values_match

try:
    import pycountry
except ImportError as exc:  # pragma: no cover - explicit workflow dependency
    raise SystemExit("pycountry is required. Run: pip install pycountry") from exc

SOURCE_ORG = "FAOSTAT"
SOURCE_DATASET = "Production: Crops and livestock products (QCL)"
SOURCE_URL = "https://www.fao.org/faostat/en/#data/QCL"
CATALOG_URL = "https://bulks-faostat.fao.org/production/datasets_E.json"
FALLBACK_ZIP_URL = (
    "https://bulks-faostat.fao.org/production/"
    "Production_Crops_Livestock_E_All_Data_(Normalized).zip"
)
QUALITY_VERSION = "geostats-v14.4-faostat-source-integrity"
FAOSTAT_GOVERNANCE_VERSION = "geostats-v14.4-faostat-source-integrity-v1"
RECENT_YEAR_WINDOW = 6
MIN_CANDIDATE_COVERAGE = 25
MIN_PLAYABLE_COVERAGE = 60
QUALITY_SCORE_THRESHOLD = 75
MAX_COMMON_YEAR_AGE = 4
MIN_COMMON_YEAR_ALIGNMENT = 0.85
MIN_DOCUMENTED_SHARE = 0.75
MIN_CLUSTERING_SCORE = 65
MIN_STABILITY_SCORE = 50
BATCH_SIZE = 400

# 193 UN members plus the Holy See and State of Palestine.
UN_ISO3 = {
    "AFG","ALB","DZA","AND","AGO","ATG","ARG","ARM","AUS","AUT","AZE","BHS","BHR","BGD","BRB","BLR","BEL","BLZ","BEN","BTN","BOL","BIH","BWA","BRA","BRN","BGR","BFA","BDI","CPV","KHM","CMR","CAN","CAF","TCD","CHL","CHN","COL","COM","COG","COD","CRI","CIV","HRV","CUB","CYP","CZE","DNK","DJI","DMA","DOM","ECU","EGY","SLV","GNQ","ERI","EST","SWZ","ETH","FJI","FIN","FRA","GAB","GMB","GEO","DEU","GHA","GRC","GRD","GTM","GIN","GNB","GUY","HTI","HND","HUN","ISL","IND","IDN","IRN","IRQ","IRL","ISR","ITA","JAM","JPN","JOR","KAZ","KEN","KIR","PRK","KOR","KWT","KGZ","LAO","LVA","LBN","LSO","LBR","LBY","LIE","LTU","LUX","MDG","MWI","MYS","MDV","MLI","MLT","MHL","MRT","MUS","MEX","FSM","MDA","MCO","MNG","MNE","MAR","MOZ","MMR","NAM","NRU","NPL","NLD","NZL","NIC","NER","NGA","MKD","NOR","OMN","PAK","PLW","PAN","PNG","PRY","PER","PHL","POL","PRT","QAT","ROU","RUS","RWA","KNA","LCA","VCT","WSM","SMR","STP","SAU","SEN","SRB","SYC","SLE","SGP","SVK","SVN","SLB","SOM","ZAF","SSD","ESP","LKA","SDN","SUR","SWE","CHE","SYR","TJK","TZA","THA","TLS","TGO","TON","TTO","TUN","TUR","TKM","TUV","UGA","UKR","ARE","GBR","USA","URY","UZB","VUT","VEN","VNM","YEM","ZMB","ZWE","PSE","VAT",
}

ALLOWED_PRODUCTION_ELEMENTS = {
    "production",
    "production quantity",
}

RETIRED_AGRICULTURAL_MEASURE_PATTERNS = (
    "yield",
    "area harvested",
    "harvested area",
    "stocks",
    "producing animals",
    "animals slaughtered",
    "slaughtered",
    "milk animals",
    "laying",
    "per hectare",
    "per animal",
    "per capita",
    "per person",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(message: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}", flush=True)


def normalize_header(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def slug(value: str, limit: int = 70) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value[:limit].rstrip("-") or "category"


def finite_float(value: Any) -> float | None:
    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def chunked(items: Sequence[dict[str, Any]], size: int = BATCH_SIZE) -> Iterator[list[dict[str, Any]]]:
    for start in range(0, len(items), size):
        yield list(items[start : start + size])


class SupabaseRest:
    def __init__(self, url: str, key: str) -> None:
        self.base = url.rstrip("/") + "/rest/v1"
        self.key = key
        self.headers = {
            "apikey": key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GeoStats-FAOSTAT-Importer/12.1.1",
        }
        # Supabase's current sb_secret_ keys are API keys, not JWTs, and must
        # not be sent as Authorization bearer tokens. Legacy service_role keys
        # are JWTs and continue to use both headers.
        if not key.startswith("sb_secret_"):
            self.headers["Authorization"] = f"Bearer {key}"

    def request(
        self,
        method: str,
        path: str,
        payload: Any | None = None,
        *,
        prefer: str | None = None,
        timeout: int = 120,
    ) -> Any:
        url = self.base + path
        body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        last_error: Exception | None = None
        for attempt in range(5):
            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    raw = response.read()
                    return json.loads(raw) if raw else None
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")
                if exc.code in {429, 500, 502, 503, 504} and attempt < 4:
                    last_error = RuntimeError(f"Supabase HTTP {exc.code}: {detail}")
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"Supabase HTTP {exc.code}: {detail}") from exc
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
                if attempt < 4:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"Supabase request failed: {exc}") from exc
        raise RuntimeError(str(last_error or "Supabase request failed"))

    def insert(self, table: str, rows: Any, returning: bool = False) -> Any:
        prefer = "return=representation" if returning else "return=minimal"
        return self.request("POST", f"/{table}", rows, prefer=prefer)

    def upsert(self, table: str, rows: Any, conflict: str) -> Any:
        query = urllib.parse.urlencode({"on_conflict": conflict})
        return self.request(
            "POST",
            f"/{table}?{query}",
            rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def patch(self, table: str, filters: str, values: Mapping[str, Any]) -> Any:
        return self.request("PATCH", f"/{table}?{filters}", dict(values), prefer="return=minimal")

    def select(self, table: str, query: str) -> list[dict[str, Any]]:
        result = self.request("GET", f"/{table}?{query}")
        return result or []

    def rpc(self, function: str, args: Mapping[str, Any]) -> Any:
        return self.request("POST", f"/rpc/{function}", dict(args), prefer="return=representation")


@dataclass(frozen=True)
class ColumnMap:
    area_m49: str
    area: str
    item_code: str
    item: str
    element_code: str
    element: str
    year: str
    unit: str
    value: str
    flag: str | None
    flag_description: str | None
    note: str | None


def find_column(headers: Sequence[str], *candidates: str, required: bool = True) -> str | None:
    normalized = {normalize_header(header): header for header in headers}
    for candidate in candidates:
        if normalize_header(candidate) in normalized:
            return normalized[normalize_header(candidate)]
    for key, header in normalized.items():
        if any(normalize_header(candidate) in key for candidate in candidates):
            return header
    if required:
        raise RuntimeError(f"Could not find required FAOSTAT column among: {', '.join(candidates)}")
    return None


def column_map(headers: Sequence[str]) -> ColumnMap:
    return ColumnMap(
        area_m49=find_column(headers, "Area Code (M49)", "M49 Code", "Area Code M49"),
        area=find_column(headers, "Area"),
        item_code=find_column(headers, "Item Code (CPC)", "Item Code"),
        item=find_column(headers, "Item"),
        element_code=find_column(headers, "Element Code"),
        element=find_column(headers, "Element"),
        year=find_column(headers, "Year"),
        unit=find_column(headers, "Unit"),
        value=find_column(headers, "Value"),
        flag=find_column(headers, "Flag", required=False),
        flag_description=find_column(headers, "Flag Description", required=False),
        note=find_column(headers, "Note", required=False),
    )


def locate_qcl_zip(catalog: Any) -> str:
    """Return the normalized QCL production archive, never a similarly named trade file.

    FAOSTAT's catalog contains both production and trade datasets whose descriptions
    include the words "crops" and "livestock". The earlier fuzzy search inherited
    text from parent catalog nodes and could select Trade_CropsLivestockIndicators.
    This matcher scores only each URL and its own record, explicitly rejects trade
    archives, and requires the production/QCL filename pattern.
    """
    matches: list[tuple[int, str]] = []

    def consider(record: Mapping[str, Any]) -> None:
        record_text = " ".join(str(v) for v in record.values() if isinstance(v, (str, int, float))).lower()
        for value in record.values():
            if not isinstance(value, str):
                continue
            url = value.strip()
            lower_url = url.lower()
            if not lower_url.startswith("http") or ".zip" not in lower_url:
                continue
            filename = urllib.parse.unquote(lower_url.rsplit("/", 1)[-1])
            # Never accept the separate crops/livestock trade-indicators dataset.
            if "trade_" in filename or "trade crops" in record_text or "trade_crops" in filename:
                continue
            score = 0
            if "production_crops_livestock" in filename:
                score += 100
            if "qcl" in filename or " qcl" in record_text:
                score += 80
            if "crops and livestock products" in record_text:
                score += 60
            if "normalized" in filename:
                score += 20
            if "all_data" in filename or "all data" in record_text:
                score += 10
            if score >= 80:
                matches.append((score, url))

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            consider(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(catalog)
    matches.sort(key=lambda pair: pair[0], reverse=True)
    return matches[0][1] if matches else FALLBACK_ZIP_URL


def download(url: str, target: Path) -> None:
    log(f"Downloading {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "GeoStats-FAOSTAT-Importer/12.1.1"})
    with urllib.request.urlopen(request, timeout=180) as response, target.open("wb") as handle:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            handle.write(block)
    log(f"Downloaded {target.stat().st_size / 1024 / 1024:.1f} MB")


def get_zip_url() -> str:
    try:
        request = urllib.request.Request(CATALOG_URL, headers={"User-Agent": "GeoStats-FAOSTAT-Importer/12.1.1"})
        with urllib.request.urlopen(request, timeout=60) as response:
            catalog = json.load(response)
        url = locate_qcl_zip(catalog)
        log(f"FAOSTAT catalog selected: {url}")
        return url
    except Exception as exc:
        log(f"Catalog lookup failed ({exc}); using the official QCL normalized-file URL.")
        return FALLBACK_ZIP_URL


def select_csv_member(archive: zipfile.ZipFile) -> str:
    candidates = [name for name in archive.namelist() if name.lower().endswith(".csv")]
    if not candidates:
        raise RuntimeError("The FAOSTAT archive contains no CSV file.")
    candidates.sort(
        key=lambda name: (
            "normalized" in name.lower(),
            "all_data" in name.lower() or "all data" in name.lower(),
            archive.getinfo(name).file_size,
        ),
        reverse=True,
    )
    selected = candidates[0]
    log(f"Using archive member {selected}")
    return selected


def m49_to_iso3(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return None
    try:
        country = pycountry.countries.get(numeric=f"{int(digits):03d}")
    except (LookupError, ValueError):
        country = None
    if not country:
        return None
    iso3 = str(country.alpha_3).upper()
    return iso3 if iso3 in UN_ISO3 else None


def normalize_element(element: str) -> str:
    return re.sub(r"\s+", " ", element.lower().strip())


def element_allowed(element: str) -> bool:
    """Only absolute total production is eligible for import."""
    return normalize_element(element) in ALLOWED_PRODUCTION_ELEMENTS


def element_retired_by_gameplay_policy(element: str) -> bool:
    lower = normalize_element(element)
    return any(pattern in lower for pattern in RETIRED_AGRICULTURAL_MEASURE_PATTERNS)


def category_key(item_code: str, element_code: str, unit: str) -> str:
    return f"{item_code.strip()}|{element_code.strip()}|{unit.strip()}"


def category_id(item_code: str, element_code: str, item: str, element: str, unit: str) -> str:
    stable = f"{slug(item_code, 18)}-{slug(element_code, 18)}-{slug(unit, 18)}"
    readable = f"{slug(item, 34)}-{slug(element, 28)}"
    return f"faostat-qcl-{readable}-{stable}"[:180].rstrip("-")


def category_title(item: str, element: str) -> str:
    item_clean = item.strip()
    if element_allowed(element):
        return f"Most {item_clean} produced"
    return f"{item_clean} ({element.strip()})"


def category_family(item: str, element: str) -> str:
    text = f"{item} {element}".lower()
    groups = [
        ("Livestock", ("cattle", "buffalo", "sheep", "goat", "pig", "swine", "chicken", "poultry", "duck", "turkey", "camel", "horse", "rabbit", "animal", "meat")),
        ("Dairy", ("milk", "cheese", "butter", "cream")),
        ("Fruit", ("fruit", "apple", "banana", "orange", "grape", "mango", "berry", "lemon", "lime", "pineapple", "avocado")),
        ("Vegetables", ("vegetable", "tomato", "onion", "cabbage", "carrot", "cucumber", "pepper")),
        ("Crops", ("wheat", "rice", "maize", "corn", "barley", "cereal", "crop", "potato", "cassava", "soy", "bean", "coffee", "cocoa", "tea", "sugar", "cotton")),
    ]
    for family, tokens in groups:
        if any(token in text for token in tokens):
            return family
    return "Agriculture"


def element_class(element: str) -> str:
    lower = element.lower().strip()
    if "area harvested" in lower:
        return "harvested-area"
    if "yield" in lower:
        return "yield"
    if "producing animals" in lower:
        return "producing-animals"
    if "animals slaughtered" in lower or "slaughter" in lower:
        return "animals-slaughtered"
    if "milk animals" in lower:
        return "milk-animals"
    if "laying" in lower:
        return "laying-animals"
    if "stocks" in lower:
        return "stocks"
    if "production" in lower:
        return "production"
    return slug(lower, 32)


def faostat_concept_group(item: str, element: str) -> str:
    """Group exact semantic duplicates while keeping distinct measures playable."""
    item_slug = slug(item, 70)
    measure = element_class(element)
    normalized_item = re.sub(r"[^a-z0-9]+", " ", item.lower()).strip()
    # Prefer the direct FAOSTAT series over World Bank's republished cereal series.
    if normalized_item in {"cereals primary", "cereals primary total", "cereals"}:
        if measure == "production":
            return "cerealProduction"
        if measure == "yield":
            return "cerealYield"
    return f"faostat-qcl-{item_slug}-{measure}"



def faostat_semantic_family(element: str) -> str:
    normalized = element.strip().lower()
    if "yield" in normalized:
        return "crop-yield"
    if "production" in normalized:
        return "crop-production"
    if "area harvested" in normalized or "harvested area" in normalized:
        return "crop-harvested-area"
    return "faostat-" + slug(normalized, 48)

def value_type(unit: str) -> str:
    lower = unit.lower()
    if "%" in unit or "percent" in lower:
        return "percentage"
    if "per " in lower or "/cap" in lower or "per capita" in lower:
        return "rate"
    return "total"


def classify_flag(flag: str, description: str) -> str:
    """Classify FAOSTAT flags without treating transparent estimates as bad data.

    GeoStats distinguishes official national-statistical records from FAO estimates and
    imputations, but both are documented evidence classes. Blank or unrecognized flags
    remain unknown and can prevent automatic approval.
    """
    code = (flag or "").strip().upper()
    text = (description or "").lower()
    if code in {"M", "O"} or "missing" in text:
        return "missing"
    if code == "A" or "official data" in text:
        return "official"
    if code in {"E", "I", "X"} or any(
        token in text
        for token in (
            "estimate",
            "imput",
            "calculated",
            "model",
            "forecast",
            "international organization",
        )
    ):
        return "modeled"
    return "other"


def ranks(values: Mapping[str, float]) -> dict[str, float]:
    ordered = sorted(values.items(), key=lambda pair: pair[1])
    output: dict[str, float] = {}
    index = 0
    while index < len(ordered):
        end = index + 1
        while end < len(ordered) and ordered[end][1] == ordered[index][1]:
            end += 1
        average_rank = (index + 1 + end) / 2
        for key, _ in ordered[index:end]:
            output[key] = average_rank
        index = end
    return output


def spearman(left: Mapping[str, float], right: Mapping[str, float]) -> float | None:
    common = sorted(set(left) & set(right))
    if len(common) < 30:
        return None
    lr = ranks({key: left[key] for key in common})
    rr = ranks({key: right[key] for key in common})
    lx = [lr[key] for key in common]
    rx = [rr[key] for key in common]
    lmean = statistics.fmean(lx)
    rmean = statistics.fmean(rx)
    numerator = sum((a - lmean) * (b - rmean) for a, b in zip(lx, rx))
    denominator = math.sqrt(sum((a - lmean) ** 2 for a in lx) * sum((b - rmean) ** 2 for b in rx))
    return numerator / denominator if denominator else None


def clustering_score(values: Sequence[float]) -> int:
    if len(values) < 10:
        return 0
    rounded = [round(value, 8) for value in values]
    counts = Counter(rounded)
    largest_tie = max(counts.values()) / len(rounded)
    distinct_ratio = len(counts) / len(rounded)
    sorted_values = sorted(rounded)
    low = sorted_values[max(0, int(len(sorted_values) * 0.1) - 1)]
    high = sorted_values[min(len(sorted_values) - 1, int(len(sorted_values) * 0.9))]
    full_range = max(sorted_values) - min(sorted_values)
    central_spread = (high - low) / full_range if full_range else 0
    raw = 100 * (
        0.55 * max(0.0, 1 - largest_tie)
        + 0.30 * min(1.0, distinct_ratio / 0.85)
        + 0.15 * min(1.0, central_spread / 0.35)
    )
    return max(0, min(100, round(raw)))


def score_candidate(
    *,
    common_coverage: int,
    max_coverage: int,
    common_year: int,
    official_share: float,
    modeled_share: float,
    cluster: int,
    stability: int,
    stability_comparison_year: int | None,
) -> tuple[int, bool, dict[str, Any]]:
    """Score FAOSTAT using an agriculture-specific, evidence-aware gate.

    Commodity statistics should not be expected to cover all 195 countries. Coverage is
    therefore scored against 100 countries and has a 60-country hard floor. Transparent
    FAO estimates and imputations count as documented evidence; only unknown/unclassified
    reporting is treated as a provenance weakness.
    """
    current_year = datetime.now(timezone.utc).year
    age = max(0, current_year - common_year)
    alignment_ratio = common_coverage / max_coverage if max_coverage else 0
    documented_share = min(1.0, official_share + modeled_share)
    unknown_share = max(0.0, 1.0 - documented_share)

    coverage_points = 25 * min(1, common_coverage / 100)
    freshness_points = 15 * max(0, 1 - max(0, age - 1) / 5)
    alignment_points = 15 * min(1, alignment_ratio)
    evidence_points = 15 * documented_share + 5 * official_share
    cluster_points = 15 * cluster / 100
    stability_points = 10 * stability / 100
    score = round(
        coverage_points
        + freshness_points
        + alignment_points
        + evidence_points
        + cluster_points
        + stability_points
    )

    checks = {
        "qualityScore": score >= QUALITY_SCORE_THRESHOLD,
        "coverage": common_coverage >= MIN_PLAYABLE_COVERAGE,
        "freshness": age <= MAX_COMMON_YEAR_AGE,
        "commonYearAlignment": alignment_ratio >= MIN_COMMON_YEAR_ALIGNMENT,
        "documentedEvidence": documented_share >= MIN_DOCUMENTED_SHARE,
        "distribution": cluster >= MIN_CLUSTERING_SCORE,
        "stability": stability >= MIN_STABILITY_SCORE,
    }
    auto = all(checks.values())
    failed_checks = [name for name, passed in checks.items() if not passed]
    details = {
        "standard": QUALITY_VERSION,
        "score": score,
        "autoQualified": auto,
        "thresholds": {
            "score": QUALITY_SCORE_THRESHOLD,
            "coverage": MIN_PLAYABLE_COVERAGE,
            "coverageScoreFullCredit": 100,
            "maximumCommonYearAgeYears": MAX_COMMON_YEAR_AGE,
            "minimumCommonYearAlignment": MIN_COMMON_YEAR_ALIGNMENT,
            "minimumDocumentedObservationShare": MIN_DOCUMENTED_SHARE,
            "minimumClusteringScore": MIN_CLUSTERING_SCORE,
            "minimumStabilityScore": MIN_STABILITY_SCORE,
            "maximumModeledShare": None,
        },
        "components": {
            "coverage": round(coverage_points, 1),
            "freshness": round(freshness_points, 1),
            "commonYearAlignment": round(alignment_points, 1),
            "documentedEvidence": round(evidence_points, 1),
            "distribution": round(cluster_points, 1),
            "stability": round(stability_points, 1),
        },
        "commonYearAlignment": round(alignment_ratio, 4),
        "documentedObservationShare": round(documented_share, 6),
        "unknownObservationShare": round(unknown_share, 6),
        "officialObservationShare": round(official_share, 6),
        "modeledObservationShare": round(modeled_share, 6),
        "stabilityComparisonYear": stability_comparison_year,
        "checks": checks,
        "failedChecks": failed_checks,
    }
    return score, auto, details


def build_sqlite(zip_path: Path, database_path: Path) -> tuple[sqlite3.Connection, int]:
    connection = sqlite3.connect(database_path)
    connection.execute("pragma journal_mode=WAL")
    connection.execute("pragma synchronous=NORMAL")
    connection.execute(
        """
        create table observations (
          category_key text not null,
          item_code text not null,
          item text not null,
          element_code text not null,
          element text not null,
          unit text not null,
          iso3 text not null,
          country_name text not null,
          year integer not null,
          value real not null,
          flag text,
          flag_description text,
          note text,
          primary key(category_key, iso3, year)
        ) without rowid
        """
    )
    minimum_year = datetime.now(timezone.utc).year - RECENT_YEAR_WINDOW
    accepted = 0
    with zipfile.ZipFile(zip_path) as archive:
        member = select_csv_member(archive)
        with archive.open(member) as binary:
            wrapper = io.TextIOWrapper(binary, encoding="utf-8-sig", errors="replace", newline="")
            reader = csv.DictReader(wrapper)
            if not reader.fieldnames:
                raise RuntimeError("FAOSTAT CSV has no header row.")
            columns = column_map(reader.fieldnames)
            batch: list[tuple[Any, ...]] = []
            for row_number, row in enumerate(reader, start=2):
                try:
                    year = int(float(row[columns.year]))
                except (TypeError, ValueError):
                    continue
                if year < minimum_year:
                    continue
                element = (row.get(columns.element) or "").strip()
                if not element_allowed(element):
                    continue
                iso3 = m49_to_iso3(row.get(columns.area_m49, ""))
                if not iso3:
                    continue
                value = finite_float(row.get(columns.value))
                if value is None:
                    continue
                flag = (row.get(columns.flag) if columns.flag else "") or ""
                flag_description = (row.get(columns.flag_description) if columns.flag_description else "") or ""
                if classify_flag(flag, flag_description) == "missing":
                    continue
                item_code = (row.get(columns.item_code) or "").strip()
                item = (row.get(columns.item) or "").strip()
                element_code = (row.get(columns.element_code) or "").strip()
                unit = (row.get(columns.unit) or "").strip()
                if not item_code or not item or not element_code or not unit:
                    continue
                key = category_key(item_code, element_code, unit)
                batch.append(
                    (
                        key,
                        item_code,
                        item,
                        element_code,
                        element,
                        unit,
                        iso3,
                        (row.get(columns.area) or iso3).strip(),
                        year,
                        value,
                        flag.strip(),
                        flag_description.strip(),
                        ((row.get(columns.note) if columns.note else "") or "").strip(),
                    )
                )
                if len(batch) >= 5000:
                    connection.executemany(
                        "insert or replace into observations values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        batch,
                    )
                    connection.commit()
                    accepted += len(batch)
                    batch.clear()
                    if accepted % 100000 < 5000:
                        log(f"Staged {accepted:,} recent observations")
            if batch:
                connection.executemany(
                    "insert or replace into observations values (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    batch,
                )
                connection.commit()
                accepted += len(batch)
    connection.execute("create index observations_category_year_idx on observations(category_key, year)")
    connection.commit()
    log(f"Staged {accepted:,} recent, non-missing observations")
    return connection, accepted


def category_candidates(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    category_rows = connection.execute(
        """
        select category_key, item_code, item, element_code, element, unit,
               max(year) as latest_year, count(distinct iso3) as all_recent_coverage
        from observations
        group by category_key, item_code, item, element_code, element, unit
        having count(distinct iso3) >= ?
        order by item, element, unit
        """,
        (MIN_CANDIDATE_COVERAGE,),
    ).fetchall()
    log(f"Auditing {len(category_rows):,} FAOSTAT item/element candidates")

    for index, row in enumerate(category_rows, start=1):
        key, item_code, item, element_code, element, unit, latest_year, _ = row
        year_counts = connection.execute(
            "select year, count(distinct iso3) from observations where category_key=? group by year order by year desc",
            (key,),
        ).fetchall()
        max_coverage = max(count for _, count in year_counts)
        required_common_coverage = (
            max(MIN_PLAYABLE_COVERAGE, math.ceil(max_coverage * MIN_COMMON_YEAR_ALIGNMENT))
            if max_coverage >= MIN_PLAYABLE_COVERAGE
            else max(1, math.ceil(max_coverage * MIN_COMMON_YEAR_ALIGNMENT))
        )
        eligible_years = [(year, count) for year, count in year_counts if count >= required_common_coverage]
        common_year, common_coverage = max(eligible_years or year_counts, key=lambda pair: pair[0])
        common_rows = connection.execute(
            "select iso3, country_name, value, flag, flag_description, note from observations where category_key=? and year=?",
            (key, common_year),
        ).fetchall()
        values = [float(observation[2]) for observation in common_rows]
        classifications = [classify_flag(observation[3] or "", observation[4] or "") for observation in common_rows]
        official_share = classifications.count("official") / len(classifications) if classifications else 0
        modeled_share = classifications.count("modeled") / len(classifications) if classifications else 0
        cluster = clustering_score(values)

        previous_year_row = connection.execute(
            """
            select year, count(distinct iso3) as coverage
            from observations
            where category_key=? and year<?
            group by year
            having count(distinct iso3)>=30
            order by year desc
            limit 1
            """,
            (key, common_year),
        ).fetchone()
        stability_comparison_year = int(previous_year_row[0]) if previous_year_row else None
        previous_rows = (
            connection.execute(
                "select iso3, value from observations where category_key=? and year=?",
                (key, stability_comparison_year),
            ).fetchall()
            if stability_comparison_year is not None
            else []
        )
        correlation = spearman(
            {observation[0]: float(observation[2]) for observation in common_rows},
            {observation[0]: float(observation[1]) for observation in previous_rows},
        )
        # Neutral-but-passing fallback when no comparable earlier year exists. This does
        # not add confidence, but it also avoids rejecting a broad new series solely for
        # lacking a predecessor year.
        stability = 55 if correlation is None else max(0, min(100, round((correlation + 1) * 50)))
        quality_score, auto_qualified, quality_details = score_candidate(
            common_coverage=common_coverage,
            max_coverage=max_coverage,
            common_year=int(common_year),
            official_share=official_share,
            modeled_share=modeled_share,
            cluster=cluster,
            stability=stability,
            stability_comparison_year=stability_comparison_year,
        )
        documented_share = min(1.0, official_share + modeled_share)
        unknown_share = max(0.0, 1.0 - documented_share)
        evidence_tier = (
            "A"
            if documented_share >= 0.95 and official_share >= 0.40
            else "B"
            if documented_share >= MIN_DOCUMENTED_SHARE
            else "C"
        )
        cat_id = category_id(item_code, element_code, item, element, unit)
        candidates.append(
            {
                "id": cat_id,
                "source_key": key,
                "item_code": item_code,
                "item": item,
                "element_code": element_code,
                "element": element,
                "unit": unit,
                "title": category_title(item, element),
                "description": (
                    f"Total national production of {item}, ranked across UN-recognized countries "
                    f"using a broadly covered common year. Missing reports are not treated as zero."
                ),
                "family": category_family(item, element),
                "value_type": value_type(unit),
                "latest_year": int(latest_year),
                "common_year": int(common_year),
                "coverage": int(common_coverage),
                "max_coverage": int(max_coverage),
                "official_share": official_share,
                "modeled_share": modeled_share,
                "documented_share": documented_share,
                "unknown_share": unknown_share,
                "cluster": cluster,
                "stability": stability,
                "stability_comparison_year": stability_comparison_year,
                "quality_score": quality_score,
                "auto_qualified": auto_qualified,
                "evidence_tier": evidence_tier,
                "quality_details": quality_details,
                "provenance_status": "approved" if documented_share >= MIN_DOCUMENTED_SHARE else "uncertain",
                "provenance_class": "internationally_harmonized_fao_production_statistics",
                "provenance_reason": (
                    "FAOSTAT QCL uses standardized definitions and validation flags. Official records and transparent FAO estimates or imputations count as documented evidence; missing or unclassified records do not. Unsupported political assertions alone are never sufficient."
                    if documented_share >= MIN_DOCUMENTED_SHARE
                    else "Too much of the common-year snapshot has missing or unclassified provenance for automatic approval."
                ),
                "methodology_url": "https://www.fao.org/faostat/en/#definitions",
                "concept_group": faostat_concept_group(item, element),
            }
        )
        if index % 100 == 0:
            log(f"Audited {index:,}/{len(category_rows):,} candidates")
    return candidates


def fetch_existing_reviews(client: SupabaseRest) -> dict[str, dict[str, Any]]:
    rows = client.select(
        "stat_categories",
        urllib.parse.urlencode(
            {
                "select": "id,review_status,content_review_status,content_review_reason,content_review_version,immediate_comprehension_score,gameplay_interest_score,uniqueness_score,player_source_url,player_source_status,player_source_reason,player_source_checked_at,link_quality_score",
                "source_organization": f"eq.{SOURCE_ORG}",
                "source_dataset": f"eq.{SOURCE_DATASET}",
            }
        ),
    )
    return {str(row["id"]): dict(row) for row in rows}


def import_candidates(client: SupabaseRest, connection: sqlite3.Connection, candidates: list[dict[str, Any]], run_id: int, validation_run_id: int, bulk_download_url: str) -> tuple[int, int, int, int]:
    existing_reviews = fetch_existing_reviews(client)
    category_rows: list[dict[str, Any]] = []
    candidate_ids: set[str] = set()
    for candidate in candidates:
        candidate_ids.add(candidate["id"])
        existing = existing_reviews.get(candidate["id"], {})
        previous_review = str(existing.get("review_status") or "candidate")
        governance_pass = candidate["auto_qualified"] and candidate["provenance_status"] == "approved"
        if previous_review == "rejected":
            review_status = "rejected"
            enabled = False
            eligible_daily = False
        elif governance_pass:
            review_status = "approved"
            enabled = False
            eligible_daily = False
        else:
            review_status = "needs_review" if candidate["auto_qualified"] else "candidate"
            enabled = False
            eligible_daily = False
        category_rows.append(
            {
                "id": candidate["id"],
                "title": candidate["title"],
                "short_title": candidate["title"][:70],
                "description": candidate["description"],
                "icon": "🌾",
                "unit": candidate["unit"],
                "value_type": candidate["value_type"],
                "ranking_direction": "high",
                "family": candidate["family"],
                "source_organization": SOURCE_ORG,
                "source_dataset": SOURCE_DATASET,
                "source_indicator_code": f"QCL:{candidate['item_code']}:{candidate['element_code']}",
                "source_url": SOURCE_URL,
                "source_page_url": SOURCE_URL,
                "player_source_url": existing.get("player_source_url") if existing.get("player_source_status") == "exact" else None,
                "player_source_status": "exact" if existing.get("player_source_status") == "exact" and existing.get("player_source_url") else "needs_exact_url",
                "player_source_reason": existing.get("player_source_reason") if existing.get("player_source_status") == "exact" and existing.get("player_source_url") else "FAOSTAT bulk and dataset landing pages do not preserve the exact item, element, and year as a human-readable deep link.",
                "player_source_checked_at": existing.get("player_source_checked_at") if existing.get("player_source_status") == "exact" else None,
                "link_quality_score": int(existing.get("link_quality_score") or 0) if existing.get("player_source_status") == "exact" else 0,
                "content_review_status": existing.get("content_review_status") if existing.get("content_review_status") in {"approved", "excluded"} else "pending",
                "content_review_reason": existing.get("content_review_reason") if existing.get("content_review_status") in {"approved", "excluded"} else "New FAOSTAT categories require explicit comprehension and gameplay review.",
                "content_review_version": existing.get("content_review_version") if existing.get("content_review_status") in {"approved", "excluded"} else "geostats-v14.4-content-review-v1",
                "immediate_comprehension_score": int(existing.get("immediate_comprehension_score") or candidate.get("recognizability_score") or 85),
                "gameplay_interest_score": int(existing.get("gameplay_interest_score") or candidate.get("specificity_score") or 80),
                "uniqueness_score": int(existing.get("uniqueness_score") or 80),
                "exact_query_url": None,
                "download_url": bulk_download_url,
                "api_url": CATALOG_URL,
                "dataset_release": f"FAOSTAT QCL bulk archive retrieved {datetime.now(timezone.utc).date().isoformat()}",
                "retrieved_at": utc_now(),
                "source_query": {
                    "domainCode": "QCL",
                    "itemCode": candidate["item_code"],
                    "item": candidate["item"],
                    "elementCode": candidate["element_code"],
                    "element": candidate["element"],
                    "year": candidate["common_year"],
                    "unit": candidate["unit"],
                    "countryUniverse": "UN-recognized countries",
                },
                "validation_status": "pending",
                "validation_version": VALIDATION_VERSION,
                "validation_reason": "Awaiting end-to-end comparison with the official FAOSTAT QCL bulk snapshot.",
                "validation_mismatch_count": 0,
                "validation_ranking_mismatch_count": 0,
                "enabled": enabled,
                "minimum_year": max(2020, candidate["common_year"] - 4),
                "latest_available_year": candidate["latest_year"],
                "country_coverage": candidate["coverage"],
                "quality_score": candidate["quality_score"],
                "eligible_daily": eligible_daily,
                "quality_details": candidate["quality_details"],
                "review_status": review_status,
                "evidence_tier": candidate["evidence_tier"],
                "auto_qualified": governance_pass,
                "common_year": candidate["common_year"],
                "common_year_coverage": candidate["coverage"],
                "official_observation_share": round(candidate["official_share"], 6),
                "modeled_observation_share": round(candidate["modeled_share"], 6),
                "clustering_score": candidate["cluster"],
                "stability_score": candidate["stability"],
                "methodology_notes": "Absolute national production quantity from FAOSTAT QCL. Yield, harvested area, animal counts, slaughter counts and other normalized efficiency measures are intentionally excluded from GeoStats gameplay. National reporting flags are retained. Official observations and transparent FAO estimates/imputations are distinguished but both count as documented evidence. Missing observations remain missing and are never inferred as zero. " + candidate["provenance_reason"],
                "quality_standard_version": QUALITY_VERSION,
                "provenance_status": candidate["provenance_status"],
                "provenance_class": candidate["provenance_class"],
                "provenance_reason": candidate["provenance_reason"],
                "methodology_url": candidate["methodology_url"],
                "independent_validation": candidate["provenance_status"] == "approved",
                "government_assertion_risk": "low" if candidate["provenance_status"] == "approved" else "unknown",
                "concept_group": candidate["concept_group"],
                "semantic_family": faostat_semantic_family(candidate["element"]),
                "semantic_topic": candidate["concept_group"],
                "governance_priority": 11,
                "governance_version": FAOSTAT_GOVERNANCE_VERSION,
                "duplicate_status": "pending",
                "auto_decision_reason": (
                    "Automatically approved under the FAOSTAT adaptive quality and documented-evidence gates; duplicate arbitration may still supersede it."
                    if governance_pass
                    else "Quarantined: " + ", ".join(candidate["quality_details"].get("failedChecks") or ["provenanceEvidence"])
                ),
                "metadata": {
                    "domainCode": "QCL",
                    "itemCode": candidate["item_code"],
                    "item": candidate["item"],
                    "elementCode": candidate["element_code"],
                    "element": candidate["element"],
                    "unit": candidate["unit"],
                    "generatedCandidate": True,
                    "reviewRequired": False,
                    "governanceVersion": FAOSTAT_GOVERNANCE_VERSION,
                    "conceptGroup": candidate["concept_group"],
                    "semanticFamily": faostat_semantic_family(candidate["element"]),
                    "semanticTopic": candidate["concept_group"],
                    "maximumRecentCoverage": candidate["max_coverage"],
                    "coverageFloor": MIN_PLAYABLE_COVERAGE,
                    "documentedObservationShare": round(candidate["documented_share"], 6),
                    "unknownObservationShare": round(candidate["unknown_share"], 6),
                    "stabilityComparisonYear": candidate["stability_comparison_year"],
                    "adaptiveFaostatGate": True,
                    "sourceIntegrityVersion": VALIDATION_VERSION,
                    "bulkDownloadUrl": bulk_download_url,
                    "measureClass": "absolute-total",
                    "normalizationBasis": "none",
                    "normalizationApproved": True,
                    "gameplayMeasurePolicy": "total-production-only",
                },
            }
        )

    log(f"Upserting {len(category_rows):,} candidate category records")
    for batch in chunked(category_rows):
        client.upsert("stat_categories", batch, "id")

    stale_ids = sorted(set(existing_reviews) - candidate_ids)
    for stale_id in stale_ids:
        encoded = urllib.parse.quote(stale_id, safe="")
        client.patch(
            "stat_categories",
            f"id=eq.{encoded}",
            {
                "enabled": False,
                "eligible_daily": False,
                "auto_qualified": False,
                "review_status": "candidate",
                "quality_details": {"error": "Category was not present in the latest qualifying FAOSTAT candidate snapshot."},
            },
        )

    removed = client.rpc(
        "clear_stat_source_observations",
        {"p_source_organization": SOURCE_ORG, "p_source_dataset": SOURCE_DATASET},
    )
    log(f"Cleared prior FAOSTAT snapshot ({removed or 0} observations)")

    candidate_by_key = {candidate["source_key"]: candidate for candidate in candidates}
    observation_rows: list[dict[str, Any]] = []
    inserted = 0
    cursor = connection.execute(
        "select category_key, iso3, country_name, year, value, flag, flag_description, note from observations order by category_key, year, iso3"
    )
    for key, iso3, country_name, year, value, flag, flag_description, note in cursor:
        candidate = candidate_by_key.get(key)
        if not candidate:
            continue
        observation_rows.append(
            {
                "category_id": candidate["id"],
                "country_iso3": iso3,
                "country_name": canonical_country_name(iso3, country_name),
                "data_year": int(year),
                "value": float(value),
                "source_url": SOURCE_URL,
                "source_record_id": f"QCL:{candidate['item_code']}:{candidate['element_code']}:{iso3}:{year}",
                "metadata": {
                    "sourceCountryName": country_name,
                    "flag": flag or None,
                    "flagDescription": flag_description or None,
                    "note": note or None,
                    "reportingClass": classify_flag(flag or "", flag_description or ""),
                    "unit": candidate["unit"],
                },
            }
        )
        if len(observation_rows) >= BATCH_SIZE:
            client.upsert("stat_observations", observation_rows, "category_id,country_iso3,data_year")
            inserted += len(observation_rows)
            observation_rows.clear()
            if inserted % 20000 < BATCH_SIZE:
                log(f"Uploaded {inserted:,} observations")
    if observation_rows:
        client.upsert("stat_observations", observation_rows, "category_id,country_iso3,data_year")
        inserted += len(observation_rows)
    verified, failed = validate_faostat_categories(client, connection, candidates, validation_run_id)
    return len(category_rows), inserted, verified, failed



def _faostat_stored_rows(client: SupabaseRest, category_id_value: str, year: int) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({
        "select": "country_iso3,country_name,data_year,value,source_url,source_record_id,metadata",
        "category_id": f"eq.{category_id_value}",
        "data_year": f"eq.{year}",
        "limit": 500,
    })
    return client.select("stat_observations", query)


def validate_faostat_categories(
    client: SupabaseRest,
    connection: sqlite3.Connection,
    candidates: list[dict[str, Any]],
    validation_run_id: int,
) -> tuple[int, int]:
    verified = 0
    failed = 0
    for candidate in candidates:
        if not candidate["auto_qualified"] or candidate["provenance_status"] != "approved":
            continue
        category_id_value = str(candidate["id"])
        year = int(candidate["common_year"])
        official = {
            str(iso3): float(value)
            for iso3, value in connection.execute(
                "select iso3,value from observations where category_key=? and year=? order by iso3",
                (candidate["source_key"], year),
            )
        }
        stored_rows = _faostat_stored_rows(client, category_id_value, year)
        stored = {
            str(row.get("country_iso3")): float(row.get("value"))
            for row in stored_rows
            if row.get("country_iso3") and finite_float(row.get("value")) is not None
        }
        category_query = urllib.parse.urlencode({"select": "*", "id": f"eq.{category_id_value}", "limit": 1})
        category_rows = client.select("stat_categories", category_query)
        category_row = category_rows[0] if category_rows else {}
        official_ids = set(official)
        stored_ids = set(stored)
        missing = sorted(official_ids - stored_ids)
        extra = sorted(stored_ids - official_ids)
        mismatches = [iso3 for iso3 in sorted(official_ids & stored_ids) if not values_match(official[iso3], stored[iso3])]
        official_ranks = competition_ranks(official, "high")
        stored_ranks = competition_ranks(stored, "high")
        rank_mismatches = [iso3 for iso3 in sorted(official_ids & stored_ids) if official_ranks[iso3] != stored_ranks[iso3]]
        source_checksum = snapshot_checksum(official)
        stored_checksum = snapshot_checksum(stored)
        source_query = category_row.get("source_query") or {}
        official_title = category_title(candidate["item"], candidate["element"])
        element_lower = str(candidate["element"]).lower()
        title_lower = str(category_row.get("title") or "").lower()
        unit_lower = str(candidate["unit"] or "").lower()
        measure_semantics = True
        if "yield" in element_lower:
            measure_semantics = "yield" in title_lower and ("/ha" in unit_lower or "hectare" in unit_lower)
        elif "production" in element_lower:
            measure_semantics = "production" in title_lower and "yield" not in title_lower
        elif "area harvested" in element_lower:
            measure_semantics = "harvested area" in title_lower
        metadata_checks = {
            "source_organization": category_row.get("source_organization") == SOURCE_ORG,
            "source_dataset": category_row.get("source_dataset") == SOURCE_DATASET,
            "source_indicator_code": str(category_row.get("source_indicator_code") or "") == f"QCL:{candidate['item_code']}:{candidate['element_code']}",
            "domain_code": str(source_query.get("domainCode") or "") == "QCL",
            "item_code": str(source_query.get("itemCode") or "") == str(candidate["item_code"]),
            "element_code": str(source_query.get("elementCode") or "") == str(candidate["element_code"]),
            "query_year": int(source_query.get("year") or 0) == year,
            "query_unit": str(source_query.get("unit") or "") == str(candidate["unit"]),
            "official_title": str(category_row.get("title") or "") == official_title,
            "measure_semantics": measure_semantics,
            "unit": str(category_row.get("unit") or "") == str(candidate["unit"]),
            "common_year": int(category_row.get("common_year") or 0) == year,
            "declared_coverage": int(category_row.get("common_year_coverage") or 0) == len(official),
            "bulk_download_present": bool(category_row.get("download_url")),
            "source_records_present": all(row.get("source_record_id") and row.get("source_url") for row in stored_rows),
        }
        metadata_failures = [key for key, value in metadata_checks.items() if not value]
        reasons: list[str] = []
        if metadata_failures:
            reasons.append("metadata checks failed: " + ", ".join(metadata_failures))
        if missing:
            reasons.append(f"{len(missing)} official countries missing")
        if extra:
            reasons.append(f"{len(extra)} unexpected stored countries")
        if mismatches:
            reasons.append(f"{len(mismatches)} value mismatches")
        if rank_mismatches:
            reasons.append(f"{len(rank_mismatches)} ranking mismatches")
        if source_checksum != stored_checksum:
            reasons.append("source and stored checksums differ")
        status = "verified" if not reasons else "failed"
        client.rpc("record_category_validation", {
            "p_category_id": category_id_value,
            "p_status": status,
            "p_validation_version": VALIDATION_VERSION,
            "p_common_year": year,
            "p_expected_count": len(official),
            "p_stored_count": len(stored),
            "p_compared_count": len(official_ids & stored_ids),
            "p_value_mismatch_count": len(missing) + len(extra) + len(mismatches),
            "p_ranking_mismatch_count": len(rank_mismatches),
            "p_source_checksum": source_checksum,
            "p_stored_checksum": stored_checksum,
            "p_metadata_checks": metadata_checks,
            "p_failure_reason": "; ".join(reasons) if reasons else None,
            "p_details": {
                "domainCode": "QCL",
                "itemCode": candidate["item_code"],
                "elementCode": candidate["element_code"],
                "item": candidate["item"],
                "element": candidate["element"],
                "unit": candidate["unit"],
                "missingCountries": missing[:50],
                "extraCountries": extra[:50],
                "valueMismatchCountries": mismatches[:50],
                "rankingMismatchCountries": rank_mismatches[:50],
            },
            "p_validation_run_id": validation_run_id,
        })
        if status == "verified":
            verified += 1
        else:
            failed += 1
            log(f"Quarantined {candidate['title']}: {'; '.join(reasons)}")
    return verified, failed

def run() -> None:
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY repository secrets are required.")
    client = SupabaseRest(supabase_url, supabase_key)
    run_rows = client.insert(
        "stat_import_runs",
        {
            "source_organization": SOURCE_ORG,
            "source_dataset": SOURCE_DATASET,
            "status": "running",
            "details": {
                "qualityStandard": QUALITY_VERSION,
                "automaticGovernance": True,
                "faostatAdaptiveCoverageFloor": MIN_PLAYABLE_COVERAGE,
                "documentedEstimatesAllowed": True,
                "missingValuesBecomeZero": False,
                "countryUniverse": "193 UN members plus two UN observer states",
                "trigger": "GitHub Actions",
            },
        },
        returning=True,
    )
    if not run_rows:
        raise RuntimeError("Could not create FAOSTAT import-run record.")
    run_id = int(run_rows[0]["id"])
    validation_rows = client.insert(
        "stat_validation_runs",
        {
            "source_organization": SOURCE_ORG,
            "status": "running",
            "validation_version": VALIDATION_VERSION,
            "details": {"auditMode": "official-FAOSTAT-QCL-bulk", "trigger": "FAOSTAT import"},
        },
        returning=True,
    )
    if not validation_rows:
        raise RuntimeError("Could not create FAOSTAT validation-run record.")
    validation_run_id = int(validation_rows[0]["id"])
    client.patch("data_sources", "id=eq.faostat", {"status": "importing"})
    try:
        with tempfile.TemporaryDirectory(prefix="geostats-faostat-") as temporary:
            directory = Path(temporary)
            zip_path = directory / "qcl.zip"
            database_path = directory / "qcl.sqlite"
            bulk_download_url = get_zip_url()
            download(bulk_download_url, zip_path)
            connection, staged = build_sqlite(zip_path, database_path)
            candidates = category_candidates(connection)
            qualified = sum(1 for candidate in candidates if candidate["auto_qualified"])
            log(f"Adaptive gate result: {qualified:,} pass numerical review; {len(candidates) - qualified:,} fail the numerical gate")
            category_count, observation_count, integrity_verified, integrity_failed = import_candidates(client, connection, candidates, run_id, validation_run_id, bulk_download_url)
            connection.close()
        completed = utc_now()
        client.patch(
            "stat_import_runs",
            f"id=eq.{run_id}",
            {
                "status": "completed",
                "completed_at": completed,
                "categories_processed": category_count,
                "observations_inserted": observation_count,
                "details": {
                    "qualityStandard": QUALITY_VERSION,
                    "automaticGovernance": True,
                    "faostatAdaptiveCoverageFloor": MIN_PLAYABLE_COVERAGE,
                    "documentedEstimatesAllowed": True,
                    "missingValuesBecomeZero": False,
                    "stagedObservations": staged,
                    "candidateCategories": category_count,
                    "numericallyQualified": qualified,
                    "automaticApprovalEnabled": True,
                    "sourceIntegrityVersion": VALIDATION_VERSION,
                    "sourceIntegrityVerified": integrity_verified,
                    "sourceIntegrityFailed": integrity_failed,
                },
            },
        )
        client.patch(
            "stat_validation_runs",
            f"id=eq.{validation_run_id}",
            {
                "status": "completed",
                "completed_at": completed,
                "categories_selected": qualified,
                "categories_verified": integrity_verified,
                "categories_failed": integrity_failed,
                "categories_unable": 0,
                "details": {
                    "auditMode": "official-FAOSTAT-QCL-bulk",
                    "candidateCategories": category_count,
                    "numericallyQualified": qualified,
                },
            },
        )
        client.patch("data_sources", "id=eq.faostat", {"status": "active", "last_import_at": completed})
        log(f"Completed: {category_count:,} candidates and {observation_count:,} observations imported")
    except Exception as exc:
        completed = utc_now()
        client.patch(
            "stat_import_runs",
            f"id=eq.{run_id}",
            {"status": "failed", "completed_at": completed, "error_message": str(exc)[:2000]},
        )
        client.patch(
            "stat_validation_runs",
            f"id=eq.{validation_run_id}",
            {"status": "failed", "completed_at": completed, "error_message": str(exc)[:2000]},
        )
        client.patch("data_sources", "id=eq.faostat", {"status": "error"})
        raise


if __name__ == "__main__":
    run()
