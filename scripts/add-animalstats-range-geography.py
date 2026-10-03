#!/usr/bin/env python3
"""Exact range-map geometry; no biological estimates, longitude wraps or climate models."""
import csv
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/animalstats'
archive = OUT / 'source/pantheria-2009.zip'
with zipfile.ZipFile(archive) as z:
    raw = z.read('PanTHERIA_1-0_WR05_Aug2008.txt')
    metadata = z.read('metadata.htm').decode()
assert '26-2_GR_MaxLat_dd' in raw.decode() and '26-3_GR_MinLat_dd' in raw.decode()
assert 'Sechrest' in metadata and '2003' in metadata
data = json.loads((OUT / 'pilot.json').read_text())
animals = {a['scientificName']: a for a in data['animals']}
sid = 'pantheria-range-maps'
assert sid in {s['id'] for s in data['sources']}
metrics = {
    'mapped_north_pole_distance': ('Closest to North Pole', 'Angular distance in degrees from the North Pole to the northernmost edge of the published species range. Exactly 90 minus maximum latitude.', 'lower_wins', 'degrees from North Pole'),
    'mapped_south_pole_distance': ('Closest to South Pole', 'Angular distance in degrees from the South Pole to the southernmost edge of the published species range. Exactly 90 plus minimum latitude.', 'lower_wins', 'degrees from South Pole'),
    'mapped_latitude_span': ('Widest north–south range', 'North–south latitude span of the published species range. Exactly maximum latitude minus minimum latitude.', 'higher_wins', 'degrees of latitude'),
}
ids = {i for tid in metrics for i in (tid, tid+'__low')}
data['traits'] = [t for t in data['traits'] if t['id'] not in ids]
data['values'] = [v for v in data['values'] if v['traitId'] not in ids]
bases = {}
for tid, (label, formula, direction, unit) in metrics.items():
    bases[tid] = (formula+' Based on Sechrest 2003 digital maps of extant non-marine mammals, as published in PanTHERIA WR05 August 2008. '
                  'Historical mapped distribution, not current occupied habitat, a population center, an individual journey, or an individual home range. '
                  'Map extrema can include gaps or separated populations. No missing-coordinate substitution, modeled species location or longitude-derived distance.')
    data['traits'].append(dict(id=tid, displayName=label, unit=unit, definition=bases[tid], measurementBasis=bases[tid],
                               canonicalSourceId=sid, eligibilityGroups=[], direction=direction,
                               separationMethod='positive_ratio_5_percent', gameplayFamily='range-geography',
                               playerHint='Published range-map edges. Historical maps, not current population locations.'))
records = []
for number, row in enumerate(csv.DictReader(io.StringIO(raw.decode()), delimiter='\t'), 2):
    animal = animals.get(row['MSW05_Binomial'])
    if not animal:
        continue
    high, low = Decimal(row['26-2_GR_MaxLat_dd']), Decimal(row['26-3_GR_MinLat_dd'])
    if high == -999 or low == -999:
        continue
    assert -90 <= low <= high <= 90
    values = {'mapped_north_pole_distance': Decimal(90)-high,
              'mapped_south_pole_distance': Decimal(90)+low,
              'mapped_latitude_span': high-low}
    assert all(v > 0 for v in values.values())
    for tid, value in values.items():
        unit = metrics[tid][3]
        notes = (f'PanTHERIA WR05 row {number}; maximum latitude={high}°, minimum latitude={low}°. '+
                 metrics[tid][1]+' Exact decimal arithmetic from published coordinate bounds, not an imputed biological trait. '
                 'No km conversion or claim of fully occupied habitat. Source map resolution and taxonomic vintage constrain precision; no source uncertainty interval is provided.')
        data['values'].append(dict(animalId=animal['id'], traitId=tid, valueNumeric=float(value), unit=unit,
                                   sex='species-level', lifeStage='species-level', measurementBasis=bases[tid], sourceId=sid,
                                   observationType='compiled', confidence='approved', uncertaintyStatus='not-reported', notes=notes))
    records.append(dict(scientificName=animal['scientificName'], sourceRow=number,
                        maximumLatitude=str(high), minimumLatitude=str(low),
                        exactDerivedValues={k: str(v) for k, v in values.items()}, decision='approved-published-map-geometry'))
assert len(records) == 30
(OUT / 'pilot.json').write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')
(OUT / 'research/range-geography-gameplay-audit.json').write_text(json.dumps(dict(
    reviewedAt='2026-10-03', sourceSha256=hashlib.sha256(raw).hexdigest(), records=records,
    approvalScope='Exact coordinate arithmetic from historical published maps',
    excluded=['Missing sentinel -999', 'Geographic midpoints as population centers', 'Dateline-sensitive longitude spans',
              'Climate and human-population raster estimates', 'Body-size and other model-extrapolated traits']), indent=2)+'\n')
print(json.dumps(dict(approvedObservations=len(records)*3, proposedDirections=6)))
