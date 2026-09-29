#!/usr/bin/env python3
"""Append directly measured AVONET bird traits to the AnAge mammal pilot."""
import json
import math
import urllib.request
import csv
import io
import zipfile
from datetime import date
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "animalstats"
WORKBOOK = OUT / "source" / "avonet-v7.xlsx"
URL = "https://ndownloader.figshare.com/files/34480856"
BIRDS = {
    "Aquila chrysaetos": "Golden eagle", "Haliaeetus leucocephalus": "Bald eagle",
    "Anas platyrhynchos": "Mallard", "Cygnus olor": "Mute swan",
    "Columba livia": "Rock pigeon", "Falco peregrinus": "Peregrine falcon",
    "Gallus gallus": "Red junglefowl", "Pavo cristatus": "Indian peafowl",
    "Cardinalis cardinalis": "Northern cardinal", "Corvus corax": "Common raven",
    "Hirundo rustica": "Barn swallow", "Pelecanus occidentalis": "Brown pelican",
    "Phoenicopterus roseus": "Greater flamingo", "Ramphastos toco": "Toco toucan",
    "Diomedea exulans": "Wandering albatross", "Phoebastria immutabilis": "Laysan albatross",
    "Cacatua galerita": "Sulphur-crested cockatoo", "Ara macao": "Scarlet macaw",
    "Aptenodytes forsteri": "Emperor penguin", "Aptenodytes patagonicus": "King penguin",
    "Eudyptula minor": "Little penguin", "Pygoscelis adeliae": "Adélie penguin",
    "Pygoscelis papua": "Gentoo penguin", "Spheniscus demersus": "African penguin",
    "Bubo virginianus": "Great horned owl", "Tyto alba": "Barn owl",
    "Dromaius novaehollandiae": "Emu", "Struthio camelus": "Ostrich",
}

METRICS = {
    "bird_mass": ("Body mass", "Mass", "g", "Mean adult mass across sexes"),
    "bird_beak_length": ("Beak length", "Beak.Length_Culmen", "mm", "Beak tip to skull base, species mean"),
    "bird_beak_width": ("Beak width", "Beak.Width", "mm", "Beak width at nostrils, species mean"),
    "bird_beak_depth": ("Beak depth", "Beak.Depth", "mm", "Beak depth at nostrils, species mean"),
    "bird_tarsus_length": ("Lower leg length", "Tarsus.Length", "mm", "Tarsus length, species mean"),
    "bird_wing_length": ("Wing length", "Wing.Length", "mm", "Unflattened wing from wrist joint to longest primary tip, species mean"),
    "bird_kipps_distance": ("Wingtip extension", "Kipps.Distance", "mm", "Longest primary tip to first secondary tip, species mean"),
    "bird_secondary_length": ("Inner wing length", "Secondary1", "mm", "Wrist joint to first secondary feather tip, species mean"),
    "bird_hand_wing_index": ("Wing shape index", "Hand-Wing.Index", "index", "100 times wingtip extension divided by wing length, species mean"),
    "bird_tail_length": ("Tail length", "Tail.Length", "mm", "Tail feather length from skin to longest tip, species mean"),
    "bird_range_area": ("Mapped breeding range", "Range.Size", "km²", "Area of mapped native/reintroduced breeding and resident range, BirdLife polygons in AVONET"),
}

ANAGE_BIRD_TRAITS = {
    "incubation": ("Time until hatching", "Gestation/Incubation (days)", "days", "Typical time from laying to hatching, compiled by AnAge"),
    "clutch_size": ("Eggs per clutch", "Litter/Clutch size", "eggs", "Typical eggs per clutch, compiled by AnAge"),
    "clutches_per_year": ("Clutches per year", "Litters/Clutches per year", "clutches/year", "Typical annual clutch frequency, compiled by AnAge"),
    "hatching_mass": ("Weight at hatching", "Birth weight (g)", "g", "Typical weight at hatching, compiled by AnAge"),
}

def main():
    if not WORKBOOK.exists():
        WORKBOOK.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL, WORKBOOK)
    data = json.loads((OUT / "pilot.json").read_text())
    book = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)
    sheet = book["AVONET1_BirdLife"]
    iterator = sheet.values
    header = next(iterator)
    index = {name: i for i, name in enumerate(header)}
    matching = {row[index["Species1"]]: row for row in iterator if row[index["Species1"]] in BIRDS}
    with zipfile.ZipFile(OUT / "source" / "anage-build-15.zip") as archive:
        anage = {f'{row["Genus"]} {row["Species"]}': row for row in
                 csv.DictReader(io.TextIOWrapper(archive.open("anage_data.txt")), delimiter="\t")}
    if set(matching) != set(BIRDS):
        raise SystemExit(f"Missing species: {set(BIRDS) - set(matching)}")
    data["sources"].append(dict(id="avonet-7", name="AVONET species means (BirdLife taxonomy)",
        sourceClass="curated-trait-database", url="https://doi.org/10.6084/m9.figshare.16586228.v7",
        versionYear="Version 7 (2022)", retrievedAt=date.today().isoformat(), license="CC BY 4.0; Tobias et al. 2022"))
    for tid, (name, column, unit, basis) in METRICS.items():
        data["traits"].append(dict(id=tid, displayName=name, definition=basis, direction="higher_wins",
            unit=unit, eligibilityGroups=["bird"], canonicalSourceId="avonet-7",
            separationMethod="positive_ratio_5_percent", measurementBasis=basis))
    for tid, (name, _, unit, basis) in ANAGE_BIRD_TRAITS.items():
        data["traits"].append(dict(id=tid, displayName=name, definition=basis, direction="higher_wins",
            unit=unit, eligibilityGroups=["bird"], canonicalSourceId="anage-15",
            separationMethod="positive_ratio_5_percent", measurementBasis=basis))
    for scientific, common in BIRDS.items():
        row = matching[scientific]
        aid = scientific.lower().replace(" ", "_")
        data["animals"].append(dict(id=aid, commonName=common, scientificName=scientific,
            taxonomicGroup="bird", familiarityTier="core" if common in {"Ostrich", "Emu", "Bald eagle", "Common raven", "Emperor penguin", "Mallard", "Rock pigeon", "Barn owl", "Peregrine falcon"} else "familiar", active=True))
        if row[index["Inference"]] != "NO" or row[index["Total.individuals"]] < 4:
            continue
        for tid, (_, column, unit, basis) in METRICS.items():
            number = row[index[column]]
            if not isinstance(number, (float, int)) or not math.isfinite(number) or number <= 0:
                continue
            data["values"].append(dict(animalId=aid, traitId=tid, valueNumeric=number, unit=unit,
                sex="mixed", lifeStage="adult", measurementBasis=basis, sourceId="avonet-7",
                observationType="compiled", confidence="approved",
                notes=f'AVONET BirdLife species mean; {row[index["Total.individuals"]]} measured individuals; inference NO; {scientific}'))
        anage_row = anage.get(scientific)
        if not anage_row or anage_row["Data quality"] not in ("acceptable", "high"):
            continue
        for tid, (_, column, unit, basis) in ANAGE_BIRD_TRAITS.items():
            try:
                number = float(anage_row[column])
            except (ValueError, TypeError):
                continue
            if number > 0:
                data["values"].append(dict(animalId=aid, traitId=tid, valueNumeric=number, unit=unit,
                    sex="species-level", lifeStage="hatchling" if tid == "hatching_mass" else "species-level",
                    measurementBasis=basis, sourceId="anage-15", observationType="compiled", confidence="approved",
                    notes=f'HAGRID {anage_row["HAGRID"]}; AnAge references {anage_row["References"]}; quality {anage_row["Data quality"]}'))
        for tid, column, unit, basis in [
            ("adult_body_mass", "Adult weight (g)", "g", "Typical adult body weight compiled by AnAge"),
            ("female_maturity", "Female maturity (days)", "days", "Age at female sexual maturity, compiled by AnAge"),
            ("maximum_documented_lifespan", "Maximum longevity (yrs)", "years", "Maximum recorded lifespan for captive specimens in AnAge"),
        ]:
            if tid == "maximum_documented_lifespan" and anage_row["Specimen origin"] != "captivity":
                continue
            try:
                number = float(anage_row[column])
            except (ValueError, TypeError):
                continue
            if number > 0:
                data["values"].append(dict(animalId=aid, traitId=tid, valueNumeric=number, unit=unit,
                    sex="female" if tid == "female_maturity" else "species-level",
                    lifeStage="adult" if tid == "adult_body_mass" else "species-level",
                    measurementBasis=basis, sourceId="anage-15", observationType="compiled", confidence="approved",
                    notes=f'HAGRID {anage_row["HAGRID"]}; AnAge references {anage_row["References"]}; origin {anage_row["Specimen origin"]}; quality {anage_row["Data quality"]}'))
    (OUT / "pilot.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(len(data["animals"]), "animals", len(data["traits"]), "traits", len(data["values"]), "values")

if __name__ == "__main__":
    main()
