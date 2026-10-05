#!/usr/bin/env python3
"""Collect Wikimedia Commons photo candidates with license metadata for manual review."""
import concurrent.futures
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "animalstats"
DATA = json.loads((OUT / "pilot.json").read_text())
HEADERS = {"User-Agent": "AnimalStatsPrototype/0.1"}
API = "https://commons.wikimedia.org/w/api.php?"
ALLOWED = {"CC BY 4.0", "CC BY 3.0", "CC BY 2.0", "CC BY-SA 4.0", "CC BY-SA 3.0", "CC BY-SA 2.0", "CC0", "Public domain"}

def clean(markup):
    return re.sub(r"<[^>]+>", "", html.unescape(markup)).strip()

def find_photo(animal):
    query = urllib.parse.urlencode(dict(action="query", generator="search",
        gsrsearch=f'filetype:bitmap "{animal["scientificName"]}"', gsrnamespace=6,
        gsrlimit=30, prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=480, format="json"))
    request = urllib.request.Request(API + query, headers=HEADERS)
    for attempt in range(4):
        try:
            pages = json.load(urllib.request.urlopen(request, timeout=40)).get("query", {}).get("pages", {}).values()
            break
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    for page in sorted(pages, key=lambda p: p.get("index", 99)):
        title = page["title"]
        if animal["id"] in {"sus_scrofa", "rattus_norvegicus"} and animal["scientificName"].lower().replace(" ", "_") not in title.lower().replace(" ", "_"):
            continue
        if any(term in title.lower() for term in ("skull", "skeleton", "drawing", "museum", "map", "cub", "juvenile", "egg", "footprint", "suffrage", "program", "mascot", "mammalia", "sow", "piglet", "corpse", "sculpture", "statue", "engraving", "illustration", "painting")):
            continue
        info = page.get("imageinfo", [{}])[0]
        meta = info.get("extmetadata", {})
        field = lambda key: meta.get(key, {}).get("value", "")
        license_name = clean(field("LicenseShortName"))
        if license_name not in ALLOWED or not info.get("thumburl"):
            continue
        creator = clean(field("Artist"))
        if not creator:
            continue
        return dict(animalId=animal["id"], assetUrl=info["thumburl"],
                    originalUrl=info["descriptionurl"], creator=creator, license=license_name,
                    attribution=f'{creator} / Wikimedia Commons / {license_name}', approved=False)
    return None

def main():
    existing = {p["animalId"]: p for p in json.loads((OUT / "photos.json").read_text())} if (OUT / "photos.json").exists() else {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {pool.submit(find_photo, animal): animal for animal in DATA["animals"] if animal["id"] not in existing}
        for future in concurrent.futures.as_completed(jobs):
            animal = jobs[future]
            try:
                photo = future.result()
                if photo:
                    existing[animal["id"]] = photo
                    print(animal["commonName"], photo["license"])
                else:
                    print(animal["commonName"], "NO LICENSED PHOTO")
            except Exception as error:
                print(animal["commonName"], "ERROR", str(error)[:100])
    (OUT / "photos.json").write_text(json.dumps(list(existing.values()), indent=2, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    main()
