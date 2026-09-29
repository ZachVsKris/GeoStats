#!/usr/bin/env python3
"""Produce numerical candidate boards, never human-approved boards."""
import collections
import itertools
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "animalstats"
DATA = json.loads((OUT / "pilot.json").read_text())
VALUES = {(row["animalId"], row["traitId"]): row["valueNumeric"] for row in DATA["values"] if row["confidence"] == "approved"}
ANIMALS = {row["id"]: row for row in DATA["animals"]}
PHOTOS = {row["animalId"] for row in DATA["photos"] if row["approved"]}
TRAITS = {row["id"]: row for row in DATA["traits"]}
MODES = {"easy": (4, 4), "normal": (6, 4), "expert": (8, 6)}
SIMILAR = ({"female_maturity", "male_maturity"}, {"litters_per_year", "interbirth_interval"},
           {"bird_wing_length", "bird_secondary_length", "bird_kipps_distance"},
           {"adult_body_mass", "bird_mass"})

def kind(ids):
    groups = {ANIMALS[aid]["taxonomicGroup"] for aid in ids}
    if len(groups) == 1:
        return "themed"
    if groups <= {"carnivore", "bear"} or groups == {"marine-mammal"}:
        return "clustered"
    return "cross-animal"

def valid_traits(ids, trait_pool, rejected):
    result = []
    for tid in trait_pool:
        vals = [VALUES.get((aid, tid)) for aid in ids]
        if any(value is None for value in vals):
            rejected["missing observation"] += 1
            continue
        ranked = sorted(vals, reverse=True)
        if any(ranked[i] / ranked[i + 1] < 1.05 - 1e-12 for i in range(len(ranked) - 1)):
            rejected["rank gap below 5%"] += 1
            continue
        result.append((tid, ids[vals.index(max(vals))]))
    return result

def generate(mode, target=10):
    n, k = MODES[mode]
    rng = random.Random("animalstats-pilot-2026-09-29:" + mode)
    pools = {
        "birds": sorted(aid for aid in PHOTOS if ANIMALS[aid]["taxonomicGroup"] == "bird"),
        "mammals": sorted(aid for aid in PHOTOS if ANIMALS[aid]["taxonomicGroup"] != "bird"),
        "predators": sorted(aid for aid in PHOTOS if ANIMALS[aid]["taxonomicGroup"] in ("carnivore", "bear")),
    }
    bird_specific = {"incubation", "clutch_size", "clutches_per_year", "hatching_mass",
                     "adult_body_mass", "female_maturity", "maximum_documented_lifespan"}
    trait_pools = {"birds": [tid for tid in TRAITS if tid.startswith("bird_") or tid in bird_specific],
                   "mammals": [tid for tid in TRAITS if not tid.startswith("bird_")],
                   "predators": [tid for tid in TRAITS if not tid.startswith("bird_")]}
    candidates = []
    rejected = collections.Counter()
    seen = set()
    for attempt in range(800_000):
        if len(candidates) >= target:
            break
        pool_name = "birds" if mode == "expert" else ("birds", "mammals", "predators")[attempt % 3]
        pool = pools[pool_name]
        if len(pool) < n:
            continue
        ids = rng.sample(pool, n)
        valid = valid_traits(ids, trait_pools[pool_name], rejected)
        if len(valid) < k:
            rejected["too few comparable traits"] += 1
            continue
        rng.shuffle(valid)
        for combo in itertools.combinations(valid, k):
            trait_ids = [entry[0] for entry in combo]
            if len({entry[1] for entry in combo}) < k:
                rejected["repeated category winner"] += 1
                continue
            if any(len(concept & set(trait_ids)) > 1 for concept in SIMILAR):
                rejected["similar traits"] += 1
                continue
            signature = (tuple(sorted(ids)), tuple(sorted(trait_ids)))
            if signature in seen:
                continue
            board_type = kind(ids)
            if mode != "expert" and sum(board["boardType"] == board_type for board in candidates) >= 4:
                continue
            if any(len(set(board["animalIds"]) & set(ids)) > (6 if mode == "expert" else n - 1) and
                   len(set(board["traitIds"]) & set(trait_ids)) > (4 if mode == "expert" else k - 1)
                   for board in candidates):
                continue
            seen.add(signature)
            candidates.append(dict(mode=mode, boardType=board_type, animalIds=ids, traitIds=trait_ids))
            break
    print(mode, len(candidates), "candidates", attempt + 1, "attempts", collections.Counter(c["boardType"] for c in candidates))
    return candidates, dict(rejected.most_common(10))

def main():
    boards, diagnostics = [], {}
    for mode in MODES:
        result, rejected = generate(mode)
        boards.extend(result)
        diagnostics[mode] = rejected
    (OUT / "candidates.json").write_text(json.dumps(dict(boards=boards, rejectionReasons=diagnostics), indent=2) + "\n")
    if len(boards) < 30:
        raise SystemExit("Fewer than 30 numerical candidate boards; do not claim pilot acceptance")

if __name__ == "__main__":
    main()
