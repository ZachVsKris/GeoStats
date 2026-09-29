#!/usr/bin/env python3
"""Rebuild the AnimalStats pilot from the pinned AnAge export and reviewed photo manifest."""
import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "animalstats"
ARCHIVE_URL = "https://genomics.senescence.info/species/dataset.zip"
ARCHIVE = OUT / "source" / "anage-build-15.zip"

# Familiar species only. The scientific name avoids ambiguous common-name matches.
PILOT = {
    "Panthera leo": ("Lion", "carnivore", "core"),
    "Panthera tigris": ("Tiger", "carnivore", "core"),
    "Panthera pardus": ("Leopard", "carnivore", "core"),
    "Acinonyx jubatus": ("Cheetah", "carnivore", "core"),
    "Canis lupus": ("Gray wolf", "carnivore", "core"),
    "Vulpes vulpes": ("Red fox", "carnivore", "core"),
    "Ursus maritimus": ("Polar bear", "bear", "core"),
    "Ursus arctos": ("Brown bear", "bear", "core"),
    "Ursus americanus": ("American black bear", "bear", "familiar"),
    "Ailuropoda melanoleuca": ("Giant panda", "bear", "core"),
    "Loxodonta africana": ("African bush elephant", "large-mammal", "core"),
    "Giraffa camelopardalis": ("Giraffe", "large-mammal", "core"),
    "Hippopotamus amphibius": ("Hippopotamus", "large-mammal", "core"),
    "Ceratotherium simum": ("White rhinoceros", "large-mammal", "familiar"),
    "Bison bison": ("American bison", "large-mammal", "core"),
    "Equus quagga": ("Plains zebra", "large-mammal", "core"),
    "Equus asinus": ("Donkey", "large-mammal", "core"),
    "Gorilla gorilla": ("Gorilla", "primate", "core"),
    "Pan troglodytes": ("Chimpanzee", "primate", "core"),
    "Pongo pygmaeus": ("Orangutan", "primate", "core"),
    "Macaca mulatta": ("Rhesus macaque", "primate", "familiar"),
    "Phascolarctos cinereus": ("Koala", "marsupial", "core"),
    "Macropus rufus": ("Red kangaroo", "marsupial", "core"),
    "Hydrochoerus hydrochaeris": ("Capybara", "rodent", "core"),
    "Castor canadensis": ("American beaver", "rodent", "core"),
    "Enhydra lutris": ("Sea otter", "marine-mammal", "core"),
    "Tursiops truncatus": ("Bottlenose dolphin", "marine-mammal", "core"),
    "Orcinus orca": ("Orca", "marine-mammal", "core"),
    "Balaenoptera musculus": ("Blue whale", "marine-mammal", "core"),
    "Megaptera novaeangliae": ("Humpback whale", "marine-mammal", "core"),
}

# AnAge's release is a compiled comparative dataset, not one individual measurement.
# Gestation/litter measurements are mammal-specific in this pilot; no bird incubation mixing.
TRAITS = {
    "adult_body_mass": ("Adult body mass", "Adult weight (g)", "g", "Typical adult body weight compiled by AnAge", "higher_wins"),
    "maximum_documented_lifespan": ("Longest recorded lifespan", "Maximum longevity (yrs)", "years", "Maximum recorded lifespan for captive specimens in AnAge", "higher_wins"),
    "gestation": ("Gestation period", "Gestation/Incubation (days)", "days", "Gestation length for this mammal, compiled by AnAge", "higher_wins"),
    "litter_size": ("Young per birth", "Litter/Clutch size", "offspring", "Typical litter size for this mammal, compiled by AnAge", "higher_wins"),
    "female_maturity": ("Age at female maturity", "Female maturity (days)", "days", "Age at female sexual maturity, compiled by AnAge", "higher_wins"),
    "male_maturity": ("Age at male maturity", "Male maturity (days)", "days", "Age at male sexual maturity, compiled by AnAge", "higher_wins"),
    "weaning_age": ("Time until weaning", "Weaning (days)", "days", "Age at weaning, compiled by AnAge", "higher_wins"),
    "birth_weight": ("Newborn body mass", "Birth weight (g)", "g", "Typical birth weight, compiled by AnAge", "higher_wins"),
    "litters_per_year": ("Litters per year", "Litters/Clutches per year", "litters/year", "Typical annual litter frequency, compiled by AnAge", "higher_wins"),
    "interbirth_interval": ("Time between births", "Inter-litter/Interbirth interval", "days", "Typical interbirth interval in days, compiled by AnAge", "higher_wins"),
}

def slug(name):
    return name.lower().replace(" ", "_")

def main():
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        print(f"Downloading {ARCHIVE_URL}", file=sys.stderr)
        urllib.request.urlretrieve(ARCHIVE_URL, ARCHIVE)
    with zipfile.ZipFile(ARCHIVE) as z:
        rows = list(csv.DictReader(io.TextIOWrapper(z.open("anage_data.txt")), delimiter="\t"))
        release = z.read("release.html").decode("utf-8", "replace")
    if "Build 15" not in release:
        raise SystemExit("Unexpected AnAge release; review the data before importing")
    lookup = {f"{r['Genus']} {r['Species']}": r for r in rows}
    missing = set(PILOT) - set(lookup)
    if missing:
        raise SystemExit(f"Missing species: {sorted(missing)}")
    animals, values = [], []
    for scientific, (common, group, tier) in PILOT.items():
        row = lookup[scientific]
        aid = slug(scientific)
        animals.append(dict(id=aid, commonName=common, scientificName=scientific,
                            taxonomicGroup=group, familiarityTier=tier, active=True))
        for tid, (_, column, unit, basis, _) in TRAITS.items():
            raw = row[column]
            if not raw or row["Data quality"] not in ("high", "acceptable"):
                continue
            # Captive and wild lifespan records must never share one category.
            if tid == "maximum_documented_lifespan" and row["Specimen origin"] != "captivity":
                continue
            try:
                number = float(raw)
            except ValueError:
                continue
            if number <= 0:
                continue
            values.append(dict(animalId=aid, traitId=tid, valueNumeric=number, unit=unit,
                               sex="female" if tid == "female_maturity" else "male" if tid == "male_maturity" else "species-level",
                               lifeStage="newborn" if tid == "birth_weight" else "adult" if tid == "adult_body_mass" else "species-level",
                               measurementBasis=basis, sourceId="anage-15", observationType="compiled",
                               confidence="approved", notes=f"HAGRID {row['HAGRID']}; AnAge references {row['References']}; longevity origin {row['Specimen origin']}; quality {row['Data quality']}"))
    traits = [dict(id=tid, displayName=name, definition=basis, direction=direction, unit=unit,
                   eligibilityGroups=[], canonicalSourceId="anage-15", separationMethod="positive_ratio_5_percent",
                   measurementBasis=basis) for tid, (name, _, unit, basis, direction) in TRAITS.items()]
    source = dict(id="anage-15", name="AnAge animal ageing and longevity database", sourceClass="curated-trait-database",
                  url=ARCHIVE_URL, versionYear="Build 15 (2023)", retrievedAt=date.today().isoformat(),
                  license="CC BY 3.0; cite HAGR / Tacutu et al. 2018")
    photo_manifest = OUT / "photos.json"
    photos = json.loads(photo_manifest.read_text()) if photo_manifest.exists() else []
    dataset = dict(animals=animals, traits=traits, sources=[source], photos=photos, values=values)
    (OUT / "pilot.json").write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(animals)} animals, {len(traits)} traits, {len(values)} observations, {len(photos)} photo records")

if __name__ == "__main__":
    main()
