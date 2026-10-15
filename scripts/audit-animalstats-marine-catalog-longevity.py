#!/usr/bin/env python3
"""Review exact catalog matches in marineSpeciesTraits; never import game facts.

Requires the frozen source and research-only pandas/rdata dependencies. Only
selected catalog longevity cells are retained, not the complete WoRMS database.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/animalstats'
EXPECTED = '864992b24c6ec0f4de7f0b9330867119b510634d08e0c29989247fa78560e6cd'
GROUPS = {'crustacean', 'cephalopod', 'echinoderm', 'cnidarian', 'bivalve', 'gastropod', 'sponge', 'chelicerate'}


def audit(frame):
    catalog = {}
    for path in sorted(DATA.glob('*.json')):
        part = json.loads(path.read_text())
        if isinstance(part, dict):
            for animal in part.get('animals', []):
                if animal.get('taxonomicGroup') in GROUPS:
                    catalog[animal['scientificName']] = animal
    accepted = frame[(frame.taxKingdom == 'Animalia') & (frame['rank'] == 'Species') & (frame.status == 'accepted')]
    rows = []
    for name, animal in sorted(catalog.items()):
        matches = accepted[accepted.scientificName == name]
        positive = matches[matches.LongevityWild.notna()]
        for _, row in positive.iterrows():
            value = float(row.LongevityWild)
            if not math.isfinite(value) or value <= 0:
                continue
            ref = row.LongevityWildRef
            reference = None if ref is None or str(ref).lower() in {'nan', '<na>', 'none', 'na'} else str(ref)
            if reference and reference.endswith('.0'):
                reference = reference[:-2]
            holds = ['Original reference, age-estimation method and wild/captive context have not been verified. The bulk field name alone is insufficient.']
            if len(matches) != 1:
                holds.append('Duplicate accepted species rows; reconcile taxonomic identity before admission.')
            if not reference:
                holds.append('Original longevity reference is missing.')
            rows.append(dict(animalId=animal['id'], scientificName=name, commonName=animal['commonName'],
                group=animal['taxonomicGroup'], aphiaId=str(row.AphiaID),
                sourceCells=dict(LongevityWild=value, LongevityWildRef=reference),
                status='research-only', holds=holds))
    return dict(source='marineSpeciesTraits, Figshare 27620676 v3 (2025-02-02)', sourceSha256=EXPECTED,
        sourceUrl='https://doi.org/10.6084/m9.figshare.27620676.v3', license='CC BY 4.0; Assis and Fragkopoulou; underlying source attribution required',
        method='Exact unmodified catalog scientific names, accepted Animalia species only. No synonym transfers, inferred lifespans or game-data mutations.',
        catalogTargets=len(catalog), candidateSpecies=len({r['scientificName'] for r in rows}), candidateRows=len(rows),
        rowsWithReference=sum(r['sourceCells']['LongevityWildRef'] is not None for r in rows),
        newPlayableLabels=0, newAdmittedValues=0, candidates=rows,
        crossChecks=[dict(scientificName='Metacarcinus magister', reference='104779',
            referenceUrl='https://www.sealifebase.org/references/FBRefSummary.php?ID=104779',
            citation='Pauley, Armstrong and Heun (1986), Species profiles: life histories and environmental requirements of coastal fishes and invertebrates (Pacific Northwest) -- Dungeness crab. U.S. Fish Wildl. Serv. Biol. Rep. 82(11.63).',
            result='SeaLifeBase summary agrees on a maximum reported age of 10 years. Original report and age-estimation method remain to be reviewed; not admitted.')],
        coverageLimit='This is a selected-cell review queue for animals already in the catalog, not a count of new categories or playable animals. Full marine database is not redistributed.')


if __name__ == '__main__':
    import rdata
    source = Path(sys.argv[1])
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED, 'Frozen source mismatch'
    result = audit(rdata.read_rda(source)['speciesList'])
    target = DATA / 'research/marine-catalog-longevity-review-20261015.json'
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k:result[k] for k in ['catalogTargets', 'candidateSpecies', 'candidateRows', 'rowsWithReference', 'newAdmittedValues']}))
