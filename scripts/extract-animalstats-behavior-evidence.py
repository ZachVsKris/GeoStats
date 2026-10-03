#!/usr/bin/env python3
"""Preserve candidate observations and protocols; never certify gameplay."""
import collections
import csv
import gzip
import hashlib
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / 'data/animalstats/source'
R = ROOT / 'data/animalstats/research'
records = []

def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None

def add(concept, species, value, unit, filename, row, reference, context, gate):
    n = number(value)
    if n is None or not species or not reference:
        return
    records.append(dict(concept=concept, species=species, value=n, unit=unit,
                        file=filename, row=row, reference=reference, conditions=context,
                        gate=gate, review_status='pending', game_approved=False))

# Table 1 contains reported species values. Table 2's adjusted/model means are
# deliberately excluded. Daily torpor is not relabeled whole-season hibernation.
p = S / 'torpor-direct-table.csv'
for i, row in enumerate(csv.DictReader(p.open()), 2):
    if not re.fullmatch(r'[A-Z][a-z]+ [a-z]+', row['Taxon']):
        continue
    for column, concept, unit in [('TBD max', 'torpor-bout-duration', 'hours'),
                                   ('Tb min', 'torpor-body-temperature', '°C')]:
        add(concept, row['Taxon'], row[column], unit, p.name, i, row['Source'],
            {'torpor_type': row['T'], 'table': 'Ruf & Geiser 2015 Table 1',
             'statistic': 'maximum bout' if column == 'TBD max' else 'minimum body temperature'},
            'Check original reference, conditions and uncertainty. Keep daily torpor and hibernation separate; no adjusted means.')

# Axial and transverse eye measurements remain separate, with original study
# references and taxonomic group. No residuals or phylogenetic proxies imported.
p = S / 'eyes-vertebrates.csv'
for i, row in enumerate(csv.DictReader(p.open(encoding='utf-8-sig')), 2):
    for column, concept in [('Axial_diameter_mm', 'eye-axial-size'),
                             ('Trans_diameter_mm', 'eye-transverse-size')]:
        add(concept, row['Dataset_name'], row[column], 'mm', p.name, i, row['Reference'],
            {'group': row['Group'], 'anatomical_endpoint': column},
            'Trace original morphological study. Separate specimen vs species averages, preservation and adult stage. Select one broadly understandable eye-size category after method review, not duplicate labels for axes.')

# Subject-level cognition accuracy is test performance, never general intelligence.
for suffix, concept, column in [('AnotB', 'self-control-a-not-b', 'Test Accuracy'),
                                 ('Cylinder', 'self-control-cylinder', 'Test % Correct')]:
    p = S / f'cognition-MacLean_et_al_PNAS_2014_Self_Control_{suffix}.csv'
    for i, row in enumerate(csv.DictReader(p.open(encoding='utf-8-sig')), 2):
        add(concept, row['Species'], row[column], 'source accuracy scale', p.name, i,
            'https://doi.org/10.6084/m9.figshare.5579335', row,
            'Audit accuracy scale, task protocol, subjects, populations and training. Subject-level observations cannot be ranked as species scores without justified aggregation and uncertainty; never label smartest.')

# Keep reported dive durations and study contexts. No inferred maxima and no
# assertion that a study observation is the physiological limit of the species.
p = S / 'diving-comparative.csv'
for i, row in enumerate(csv.DictReader(p.open(encoding='latin1')), 2):
    add('dive-duration', row['Species'], row['Maximum.dive.duration..min.'], 'minutes',
        p.name, i, row['Literature.source'], row,
        'Check primary citation and observation versus inferred value, recorder/sample effort, wild/captive and actual dive definition. Study maximum does not prove universal maximum.')

# Marine records are retained verbatim with taxonomy. Width/diameter and height
# cannot be merged into length; colony, polyp, zooid and individual must separate.
p = S / 'expansion-mobs-v1.csv'
marine_rows = list(csv.DictReader(p.open()))
with gzip.open(R / 'mobs-v1.jsonl.gz', 'wt') as output:
    for row in marine_rows:
        output.write(json.dumps(row) + '\n')
non_animal_or_unknown = {'NA', 'Foraminifera', 'Ciliophora', 'Ochrophyta', 'Rhodophyta', 'Myzozoa', 'Amoebozoa', 'Euglenozoa'}
for i, row in enumerate(marine_rows, 2):
    if row['phylum'] in non_animal_or_unknown:
        continue
    for column, concept in [('length_cm', 'marine-body-length'),
                             ('diameter_width_cm', 'marine-body-width'),
                             ('height_cm', 'marine-body-height')]:
        if re.search(r'estimat|predict|approx|colon|zooid|polyp', row['Notes'], re.I):
            continue
        add(concept, row['scientificName'], row[column], 'cm', p.name, i, row['Size_Ref'],
            {'phylum': row['phylum'], 'class': row['class'], 'notes': row['Notes'],
             'aphia_id': row['valid_aphiaID']},
            'MOBS 1.0 lacks biological-unit and sex fields available in v2. Verify individual vs colony, anatomy, original reference, stage, statistical endpoint and reuse rights before gameplay. Diameter/width are not interchangeable by default.')

p = S / 'expansion-chewing-records.json'
for row in json.loads(p.read_text()):
    species = row['genus'] + ' ' + row['species']
    if not re.fullmatch(r'[A-Z][a-z]+ [a-z]+', species):
        continue
    raw = row['chewing_cycle_ms_raw'].replace(',', '')
    if not raw.isdigit():
        continue
    add('chewing-rate', species, raw, 'milliseconds/chew', p.name, row['table_row'],
        'https://doi.org/10.1644/07-MAMM-A-188.1', row,
        'Paper sampled roughly one animal for about 120 species, 10–30 chews/animal; some means have 2–7 animals and 34 literature cases. Food, sex, stage, contexts and uncertainty require audit; exclude incising; no allometric predictions or automatic species generalization.')

with gzip.open(R / 'behavior-evidence-records.jsonl.gz', 'wt') as output:
    for row in records:
        output.write(json.dumps(row) + '\n')
summary = []
for concept in sorted({r['concept'] for r in records}):
    rows = [r for r in records if r['concept'] == concept]
    summary.append(dict(concept=concept, numeric_rows=len(rows),
                        source_taxon_labels=len({r['species'] for r in rows}),
                        files=sorted({r['file'] for r in rows}),
                        new_playable_approvals=0))
report = dict(extracted_numeric_rows=len(records), endpoints=summary,
              marine_raw_rows=len(marine_rows),
              marine_aphia_ids=len({r['valid_aphiaID'] for r in marine_rows}),
              new_playable_approvals=0,
              source_hashes={name: hashlib.sha256((S / name).read_bytes()).hexdigest()
                             for name in {r['file'] for r in records}})
(R / 'behavior-evidence-summary.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
