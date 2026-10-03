#!/usr/bin/env python3
"""Validate the official supplement and retain measured milk endpoints only."""
import csv
import gzip
import hashlib
import io
import json
import math
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / 'data/animalstats/source'
R = ROOT / 'data/animalstats/research'
p = S / 'expansion-milk-supplements.zip'
with zipfile.ZipFile(p) as outer:
    assert outer.testzip() is None
    nested = outer.read('peerj-07-8085-s001.zip')
with zipfile.ZipFile(io.BytesIO(nested)) as inner:
    assert inner.testzip() is None
    raw = inner.read('data/milkData.csv')
(S / 'expansion-milk-data.csv').write_bytes(raw)
rows = list(csv.DictReader(io.StringIO(raw.decode())))
assert len(rows) == 124
assert sum(row['Sugar'] == 'NA' for row in rows) == 15
observations = []
for i, row in enumerate(rows, 2):
    for column, concept in [('Fat', 'milk-fat'), ('Protein', 'milk-protein'), ('Sugar', 'milk-sugar')]:
        if row[column] == 'NA':
            continue
        value = float(row[column])
        assert math.isfinite(value) and 0 <= value <= 100
        observations.append(dict(
            concept=concept, species=row['Species'], value=value, unit='g/100 g milk',
            source='https://doi.org/10.7717/peerj.8085/supp-1', file='data/milkData.csv',
            row=i, sample_size_raw=row['N'], lactation_stage_raw=row['Lactation.stage'],
            phylogenetic_name=row['phyName'], review_status='pending', game_approved=False,
            evidence_gate='Trace original milk assay and taxonomy; audit lactation stage, sample size, wild/captive and composition comparability. No model-imputed sugar, transformed life-history variables or inferred energy imported.'))
with gzip.open(R / 'milk-reported.jsonl.gz', 'wt') as out:
    for row in observations:
        out.write(json.dumps(row) + '\n')
summary = dict(
    source='https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6858816/supplementaryFiles',
    citation='Blomquist 2019, PeerJ 7:e8085, doi:10.7717/peerj.8085',
    license='CC BY 4.0; attribute author, title, publication and DOI',
    source_rows=len(rows), measured_observations=len(observations),
    endpoints={concept:sum(r['concept']==concept for r in observations)
               for concept in ('milk-fat','milk-protein','milk-sugar')},
    missing_sugar_cells_excluded=15, new_playable_approvals=0,
    archive_valid=True, sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
    raw_csv_sha256=hashlib.sha256(raw).hexdigest())
(R / 'milk-evidence-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
# An earlier download was an error document, not a supplement. Correct its
# acquisition record without deleting the audit trail.
manifest = R / 'discovery-final-downloads.json'
entries = json.loads(manifest.read_text())
for entry in entries:
    if entry.get('file') == 'discovery-milk-supplement.zip':
        entry.update(status='failed_payload_validation', valid_zip=False,
                     superseded_by='expansion-milk-supplements.zip', game_approved=False)
manifest.write_text(json.dumps(entries, indent=2) + '\n')
print(json.dumps(summary, indent=2))
