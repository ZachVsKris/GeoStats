#!/usr/bin/env python3
"""Read the author's workbook without modifying it; preserve source precision."""
import gzip
import hashlib
import json
import math
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
S=ROOT/'data/animalstats/source'
R=ROOT/'data/animalstats/research'
p=S/'expansion-prey-data.xlsx'
metadata=json.loads((S/'expansion-prey-metadata.json').read_text())
assert hashlib.md5(p.read_bytes()).hexdigest()==metadata['files'][0]['computed_md5']
frame=pd.read_excel(p,sheet_name='data_DNB').fillna('')
assert len(frame)==108
assert frame['Species'].nunique()==108
references=pd.read_excel(p,sheet_name='References').fillna('').iloc[:,0].tolist()
records=[]
for index,row in frame.iterrows():
    raw=row.to_dict()
    low=float(raw['log10 Minimum Prey Mass (kg)']) if raw['log10 Minimum Prey Mass (kg)']!='' else None
    high=float(raw['log 10 Maximum Prey Mass(kg)'])
    assert math.isfinite(high)
    assert low is None or (math.isfinite(low) and low<=high)
    records.append(dict(
        concept='prey-mass', species=raw['Species'].replace('_',' '),
        value_log10_kg=high, value_kg=10**high,
        minimum_log10_kg=low, minimum_kg=10**low if low is not None else None,
        conversion='10 ** original spreadsheet log10 value; not a PDF-rounded value',
        file=p.name, sheet='data_DNB', row=int(index)+2,
        prey_references=raw['Prey Mass Souce'],diet_references=raw['Predator Diet Source'],
        environment=raw['Environment'], source='https://doi.org/10.6084/m9.figshare.999069',
        primary_paper='https://doi.org/10.1371/journal.pone.0106402',
        source_row=raw, review_status='pending', game_approved=False,
        evidence_gate='Verify cited diet study and prey mass attribution, consumption vs capture, predation vs scavenging, individual prey anatomy, study effort and taxonomy. Largest known prey is a documented diet endpoint, not physiological capacity. Reverse the same maximum endpoint if adding an opposite.'))
with gzip.open(R/'prey-reported.jsonl.gz','wt') as output:
    for row in records:output.write(json.dumps(row)+'\n')
(S/'expansion-prey-references.json').write_text(json.dumps(references,indent=2)+'\n')
summary=dict(source=metadata['url'],citation='Tucker & Rogers 2014, PLOS ONE 9:e106402',
             url='https://doi.org/10.6084/m9.figshare.999069', license=metadata['license']['name'],
             numeric_rows=len(records),source_taxon_labels=108,
             environment_counts=frame['Environment'].value_counts().to_dict(),
             original_reference_entries=len(references),
             missing_minimum_cells_excluded=sum(row['minimum_kg'] is None for row in records),
             sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
             new_playable_approvals=0,original_workbook_unchanged=True)
(R/'prey-evidence-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
