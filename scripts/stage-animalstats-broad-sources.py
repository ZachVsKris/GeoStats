#!/usr/bin/env python3
"""Stage reproducible research candidates. Never modifies playable data."""
import csv
import hashlib
import json
from pathlib import Path

import openpyxl
import pyreadr

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'data/animalstats'
pilot = json.loads((BASE / 'pilot.json').read_text())
animals = {a['scientificName']: a['id'] for a in pilot['animals']
           if not a['id'].startswith(('dog_', 'cat_'))}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def number(value):
    try:
        result = float(value)
        return result if result >= 0 and result < float('inf') else None
    except (ValueError, TypeError):
        return None


brain_path = BASE / 'source/mammal-brain-body-2024.xlsx'
workbook = openpyxl.load_workbook(brain_path, data_only=True)
references = {str(r[0]): r[1] for r in workbook['References'].values if r[0]}
rows = list(workbook['Mammal-Brains'].values)
brain_candidates = []
for row_number, row in enumerate(rows[1:], 2):
    record = dict(zip(rows[0], row))
    name = str(record['Species_Original']).replace('_', ' ')
    brain = number(record['BrainMass_g'])
    body = number(record['BodyMass_g'])
    if name not in animals or brain is None or body is None or brain <= 0 or body <= 0:
        continue
    reference_ids = str(record['Reference']).split(';')
    brain_candidates.append({
        'animalId': animals[name], 'scientificName': name,
        'brainMassGrams': brain, 'bodyMassGrams': body,
        'brainPercentOfBody': 100 * brain / body,
        'worksheet': 'Mammal-Brains', 'worksheetRow': row_number,
        'references': [references.get(r, 'unresolved') for r in reference_ids],
        'confidence': 'research-candidate',
        'holdReason': 'Original source must establish measured mass versus converted volume, age/sex and whether brain/body masses share individuals. No intelligence inference.'
    })

marine_dir = BASE / 'source/pelagic-species'
habitat_path = marine_dir / '3_habitat_behavior_traits.csv'
habitat = list(csv.DictReader(habitat_path.open(encoding='utf-8-sig'), delimiter='\t'))
adult = [r for r in habitat if r['tax_level'] == 'species' and r['life_stage'] == 'adult']
marine_traits = []
for field, labels, unit in [
    ('depth_max', ['Deepest habitat', 'Shallowest maximum depth'], 'm'),
    ('temp_min', ['Coldest habitat', 'Warmest minimum temperature'], '°C'),
    ('temp_max', ['Warmest habitat', 'Coldest maximum temperature'], '°C'),
]:
    valid = [r for r in adult if number(r[field]) is not None]
    # Negative temperatures can be real. Preserve them while rejecting sentinels.
    if field.startswith('temp'):
        valid = []
        for r in adult:
            try:
                v = float(r[field])
                if -5 <= v <= 60:
                    valid.append(r)
            except (TypeError, ValueError):
                pass
    records = [{
        'scientificName': r['sci_name'], 'animalId': animals.get(r['sci_name']),
        'value': float(r[field]), 'unit': unit,
        'lifeStage': 'adult', 'confidence': 'research-candidate',
        'sourceReferences': [r[k] for k in ('habitat_ref', 'habitat_ref2', 'habitat_ref3', 'habitat_ref4') if r[k] not in ('', 'NA')],
        'sourceUrls': [r[k] for k in ('habitat_url', 'habitat_url2', 'habitat_url3', 'habitat_url4') if r[k] not in ('', 'NA')],
        'sourceNotes': r['trait_note'], 'habitatNotes': r['habitat_note'],
    } for r in valid]
    marine_traits.append({
        'sourceField': field, 'proposedPairedLabels': labels,
        'adultSpeciesWithValues': len({r['scientificName'] for r in records}),
        'currentRosterMatches': len({r['animalId'] for r in records if r['animalId']}),
        'holdReason': 'Too few current roster matches; audit observed versus inferred habitat values and publication scope before importing.',
        'records': records,
    })

report = {
    'status': 'research-only; no gameplay approvals',
    'priorityOrder': ['Familiar wild mammals', 'Marine animals', 'Insects and other invertebrates'],
    'policy': 'Do not relax broad/scoped coverage floors. Keep opposites adjacent. Reject imputation and undocumented source conversions. Familiar and intuitive facts must remain a board majority.',
    'mammals': {
        'publication': 'https://doi.org/10.1038/s41559-024-02451-3',
        'download': 'https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41559-024-02451-3/MediaObjects/41559_2024_2451_MOESM3_ESM.xlsx',
        'sha256': digest(brain_path), 'license': 'CC BY 4.0',
        'sourceSpeciesRows': len(rows) - 1, 'currentRosterMatches': len(brain_candidates),
        'proposedPairedLabels': [['Biggest brain', 'Smallest brain'], ['Biggest brain for body size', 'Smallest brain for body size']],
        'interest': 'Intuitive anatomy; explicitly not intelligence.',
        'records': brain_candidates,
    },
    'marine': {
        'publication': 'https://doi.org/10.1038/s41597-023-02689-9',
        'dataset': 'https://doi.org/10.5683/SP3/0YFJED',
        'adultSpeciesInHabitatTable': len({r['sci_name'] for r in adult}),
        'sourceFiles': {p.name: digest(p) for p in sorted(marine_dir.iterdir()) if p.is_file()},
        'candidateTraits': marine_traits,
        'nextRosterCandidates': ['Ocean sunfish', 'Sockeye salmon', 'Chinook salmon', 'Atlantic mackerel', 'Pacific herring', 'European sardine', 'Humboldt squid', 'California market squid'],
        'additionalReview': 'Raw nutrition separates wet/dry weight and methods. Morphology includes image measurements and conversions; do not import pooled values blindly.',
    },
    'insects': {
        'source': 'AnthropInsect 2.0', 'status': 'Existing archive; further source-cell verification needed.',
        'nextChecks': ['Expand familiar species roster to meet scoped coverage', 'Separate adult/larval stages, sex and social castes', 'Reject estimated and midpoint-derived values', 'Trace lifespan, egg count and generations per year to original studies'],
    },
}
archive_path = BASE / 'source/marine-species-traits-2024.RData'
marine_catalog = pyreadr.read_r(str(archive_path))['speciesList']
accepted_animals = marine_catalog[(marine_catalog.taxKingdom == 'Animalia') &
                                 (marine_catalog.status == 'accepted') &
                                 (marine_catalog['rank'] == 'Species')]
matched = accepted_animals[accepted_animals.scientificName.isin(animals)]
fields = ['scientificName', 'AphiaID', 'taxClass', 'habitatDepthMin', 'habitatDepthMax',
          'habitatDepthSource', 'habitatRef', 'LongevityWild', 'LongevityWildRef',
          'morphologyWeight', 'morphologySize', 'morphologySizeMin', 'morphologySizeMax',
          'morphologySizeLifeStage', 'morphologySizeRef', 'propaguleDuration', 'propaguleDurationRef']
report['marineCatalog'] = {
    'dataset': 'https://figshare.com/articles/dataset/_/27620676',
    'download': 'https://ndownloader.figshare.com/files/52089563',
    'sha256': digest(archive_path), 'allRows': len(marine_catalog),
    'acceptedAnimalSpeciesRows': len(accepted_animals), 'exactRosterMatches': len(matched),
    'numericCoverage': {f: {'sourceNonmissing': int(accepted_animals[f].notna().sum()),
                           'rosterNonmissing': int(matched[f].notna().sum())}
                        for f in ['habitatDepthMax', 'LongevityWild', 'morphologyWeight', 'morphologySizeMax', 'propaguleDuration']},
    'confidence': 'research-candidate',
    'holdReasons': [
        'Habitat depth is not diving depth: some whale entries reach 8,000 m and leatherback habitat reaches 9,000 m. Audit bathymetric range and underlying references before any game use.',
        'Weights lack a dedicated provenance field and are not guaranteed to share age, sex or measurement basis.',
        'Longevity source references and growth-stage distinctions require verification.',
        'Fishing vulnerability, trophic estimates and phylogenetic indices are not approved as observed intuitive facts.'
    ],
    'matchedRecords': json.loads(matched[fields].to_json(orient='records')),
}
out = BASE / 'research/broad-source-intake-20261010.json'
out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'mammalRosterMatches': len(brain_candidates), 'marineCandidateCoverage': [{k: t[k] for k in ('sourceField', 'adultSpeciesWithValues', 'currentRosterMatches')} for t in marine_traits], 'playableLabelsAdded': 0}, indent=2))
