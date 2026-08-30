#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ARTICLE_API = "https://api.figshare.com/v2/articles/21789074"
NATURAL_EARTH_URL = "https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip"


def request_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "GeoStats-v16.2.8-bounded-feasibility/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def select_raster_archive(article: dict) -> dict:
    files = [row for row in article.get("files", []) if isinstance(row, dict)]
    exact = [row for row in files if str(row.get("name", "")).lower() == "koppen_geiger_tif.zip"]
    candidates = exact or [row for row in files if "koppen" in str(row.get("name", "")).lower() and str(row.get("name", "")).lower().endswith(".zip")]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one Köppen-Geiger TIFF archive, found {len(candidates)}")
    if not candidates[0].get("download_url"):
        raise RuntimeError("Figshare file metadata has no download URL")
    return candidates[0]


def download(url: str, target: Path) -> str:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "GeoStats-v16.2.8-bounded-feasibility/1.0"})
    digest = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=180) as response, target.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract(archive: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        root = target.resolve()
        for member in zipped.infolist():
            destination = (target / member.filename).resolve()
            if root not in destination.parents and destination != root:
                raise RuntimeError(f"Unsafe archive path: {member.filename}")
        zipped.extractall(target)


def choose_normal_raster(root: Path) -> Path:
    rasters = sorted([*root.rglob("*.tif"), *root.rglob("*.tiff")])
    preferred = [path for path in rasters if "1991_2020" in str(path).replace("-", "_") and "0p00833333" in path.name]
    candidates = preferred or [path for path in rasters if "1991_2020" in str(path).replace("-", "_")]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one 1991–2020 1-km raster, found {len(candidates)}")
    return candidates[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch the bounded Köppen-Geiger feasibility inputs from their public publishers")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    article = request_json(ARTICLE_API)
    raster_file = select_raster_archive(article)
    raster_zip = output / "koppen-geiger.zip"
    geometry_zip = output / "natural-earth-countries.zip"
    raster_zip_sha = download(str(raster_file["download_url"]), raster_zip)
    geometry_zip_sha = download(NATURAL_EARTH_URL, geometry_zip)

    raster_root = output / "raster"
    geometry_root = output / "countries"
    safe_extract(raster_zip, raster_root)
    safe_extract(geometry_zip, geometry_root)
    raster = choose_normal_raster(raster_root)
    shapefiles = sorted(geometry_root.rglob("ne_10m_admin_0_countries.shp"))
    if len(shapefiles) != 1:
        raise RuntimeError(f"Expected one Natural Earth country shapefile, found {len(shapefiles)}")

    stable_raster = output / "koppen-geiger-1991-2020.tif"
    stable_countries = output / "ne_10m_admin_0_countries.shp"
    shutil.copy2(raster, stable_raster)
    for component in shapefiles[0].parent.glob(f"{shapefiles[0].stem}.*"):
        shutil.copy2(component, output / component.name)

    manifest = {
        "figshare_article_id": article.get("id", 21789074),
        "figshare_version": article.get("version"),
        "figshare_modified_date": article.get("modified_date"),
        "raster_archive_name": raster_file.get("name"),
        "raster_archive_download_url": raster_file.get("download_url"),
        "raster_archive_sha256": raster_zip_sha,
        "raster_sha256": hashlib.sha256(stable_raster.read_bytes()).hexdigest(),
        "natural_earth_url": NATURAL_EARTH_URL,
        "natural_earth_archive_sha256": geometry_zip_sha,
        "country_shapefile": stable_countries.name,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"raster": str(stable_raster), "countries": str(stable_countries), "manifest": manifest}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
