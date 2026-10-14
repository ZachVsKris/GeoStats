#!/usr/bin/env python3
"""Aggregate readiness audit of frozen MarineSpeciesTraits v3, not a data import.
Requires rdata in the research environment; never a game runtime dependency.
"""
import collections
import hashlib
import json
from pathlib import Path
import sys
import pandas as pd
import rdata

root = Path(__file__).resolve().parents[1]
research = root / 'data/animalstats/research'
source = Path(sys.argv[1])
manifest = json.loads((research / 'bulk-source-intake-20261014.json').read_text())
expected = next(s for s in manifest['sources'] if s['file'] == source.name)
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected['sha256']
frame = rdata.read_rda(source)['speciesList']
animal = frame[(frame.taxKingdom == 'Animalia') & (frame['rank'] == 'Species') & (frame.status == 'accepted')]
fields = [
 ('LongevityWild', 'LongevityWildRef', 'high', 'Lifespan', 'Confirm wild versus captive origin in original source.'),
 ('morphologySize', 'morphologySizeRef', 'high', 'Length', 'Units are ambiguously described as cm or m; resolve per original source and length convention.'),
 ('morphologyWeight', None, 'high', 'Weight', 'Units ambiguously described as grams or kilograms and no dedicated weight-reference column; original source required.'),
 ('propaguleDuration', 'propaguleDurationRef', 'occasional', 'Larval development duration', 'Confirm original observed records; exclude modelled or borrowed genus-level duration and distinguish life stages.'),
 ('habitatDepthMax', 'habitatRef', 'high', 'Deepest habitat', 'Distinguish observed water-column depth from modelled depth or seafloor bathymetry; no genus substitutions.'),
 ('fishingVulnerability', None, 'defer', 'Fishing vulnerability model', 'Modelled index is not a direct measured biological comparison.'),
 ('seTrophic', 'feedingTypeRef', 'defer', 'Trophic index', 'Modelled or ordinal index; do not present as number of food species.'),
]
results=[]
for field, ref, interest, concept, hold in fields:
 numeric = pd.to_numeric(animal[field], errors='coerce')
 mask = numeric.notna() & (numeric > 0)
 subset = animal[mask]
 referenced = subset[subset[ref].notna()] if ref else subset.iloc[0:0]
 results.append(dict(field=field, concept=concept, interest=interest,
   positiveNumericRows=int(mask.sum()), speciesWithPositiveValue=int(subset.scientificName.nunique()),
   phylumCounts={str(k):int(v) for k,v in subset.taxPhylum.value_counts().items()},
   rowsWithReferenceField=int(len(referenced)), referenceField=ref,
   status='hold-original-source-review', requiredReview=hold))
report=dict(sourceVersion='Figshare 27620676 v3, 2025-02-02', sourceSha256=expected['sha256'],
 totalRows=len(frame), kingdomRows={str(k):int(v) for k,v in frame.taxKingdom.value_counts().items()},
 acceptedAnimalSpeciesRows=len(animal), distinctAcceptedAnimalSpecies=int(animal.scientificName.nunique()),
 fields=results,newPlayableLabels=0,newAdmittedValues=0,
 identityHold='Accepted species rows exceed distinct scientific names; resolve duplicate taxonomic records before any species-level import.',
 note='Aggregate inventory only. Presence of a value or reference identifier does not establish measurement provenance, units, exact life stage or comparability. Full source is not republished.')
(research / 'marine-bulk-readiness-20261014.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['totalRows','acceptedAnimalSpeciesRows','distinctAcceptedAnimalSpecies','newPlayableLabels']}))
