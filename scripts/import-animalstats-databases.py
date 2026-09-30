#!/usr/bin/env python3
"""Import whole upstream tables into a research catalog; never auto-approve game values.
Requires pyarrow for SeaLifeBase. Run after placing pinned downloads in source/.
The catalog is deliberately outside pilot.json and the browser bundle.
"""
import collections, csv, gzip, hashlib, json, math
from pathlib import Path
import pyarrow.parquet as pq
ROOT = Path(__file__).resolve().parents[1] / 'data/animalstats'
SOURCE = ROOT / 'source'
OUT = ROOT / 'research'
OUT.mkdir(exist_ok=True)
manifest = []
summary = {}

def rows(name, encoding='utf8'):
    path = SOURCE / name
    manifest.append({'file': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size})
    if name.endswith('.parquet'):
        return pq.read_table(path).to_pylist()
    with path.open(encoding=encoding, newline='') as f:
        return list(csv.DictReader(f))

def number(value):
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (ValueError, TypeError):
        return None

def write(name, records, metadata):
    # Deterministic gzip makes repeated imports byte-identical.
    body = ''.join(json.dumps(r, ensure_ascii=False, allow_nan=False, sort_keys=True) + '\n' for r in records).encode()
    (OUT / (name + '.jsonl.gz')).write_bytes(gzip.compress(body, mtime=0))
    groups = collections.Counter(r['group'] for r in records)
    fields = collections.Counter(k for r in records for k, v in r['measurements'].items() if number(v) is not None)
    summary[name] = {**metadata, 'records': len(records), 'groups': dict(sorted(groups.items())), 'numericCoverage': dict(sorted(fields.items())), 'gameApproved': 0}

slb = rows('slb-v26.06-species.parquet')
fields = ['Length', 'LengthFemale', 'CommonLength', 'Weight', 'WeightFemale', 'LongevityWild', 'LongevityCaptive', 'DepthRangeShallow', 'DepthRangeDeep']
records = []
for r in slb:
    hierarchy = (r.get('Sp2000_HierarchyCode') or '').split('-')
    if not hierarchy or hierarchy[0] != 'Animalia':
        continue
    values = {k: number(r.get(k)) for k in fields if number(r.get(k)) is not None}
    records.append({'species': f"{r['Genus']} {r['Species']}", 'group': hierarchy[2] if len(hierarchy) > 2 else 'unresolved', 'sourceRow': r['SpecCode'], 'measurements': values,
      'context': {k: r.get(k) for k in ['FBname','FamCode','LTypeMaxM','LTypeMaxF','LTypeComM','MaxLengthRef','MaxWeightRef','LongevityWildRef','LongevityCapRef','DepthRangeRef']},
      'review': 'hold: verify measurement type, provenance and wild/captive basis'})
write('sealifebase', records, {'version': '26.06', 'upstreamRows': len(slb), 'url': 'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/cboettig/fishbase/slb/v26.06/parquet/species.parquet', 'caution': 'Length types are kept separately. Depth ranges are habitat limits, not measured dive performance.'})

at = rows('animaltraits-v1.0.7-observations.csv')
write('animaltraits', [{'species': f"{r['genus']} {r['specificEpithet']}", 'group': r['class'], 'sourceRow': i + 2,
 'measurements': {k: number(r[k]) for k in ['body mass','metabolic rate','brain size'] if number(r[k]) is not None},
 'context': {k: v for k, v in r.items() if k not in ['body mass','metabolic rate','brain size'] and v}, 'review': 'hold: match sex, sample size, metabolic protocol and brain measurement method'} for i, r in enumerate(at)],
 {'version': '1.0.7', 'url': 'https://zenodo.org/records/6468938', 'license': 'CC0', 'caution': 'Repeated studies are separate observations; converted brain volume is not a directly weighed brain.'})

bite = rows('insect-bite-v1-table.csv')
by_species = collections.defaultdict(list)
for r in bite:
    by_species[r['ID']].append(r)
records = []
for species, observations in sorted(by_species.items()):
    r = observations[0]
    n = len({v['specimen'] for v in observations})
    measurements = {k: number(r.get(k)) for k in ['mean.bf.ID.geom','mean.ID.body.l.geom','mean.ID.head.w.geom','mean.ID.wing.l.geom'] if number(r.get(k)) is not None}
    records.append({'species': species.replace('_',' '), 'group': r['order'], 'sourceRow': [v['iBite'] for v in observations], 'measurements': measurements,
      'context': {'independentSpecimens': n, 'series': len(observations), 'forceUnit': 'N', 'lengthUnit': 'mm', 'basis': 'reported geometric species mean; live voluntary distal-mandible bite assay'},
      'review': 'hold: named species, sample size, uncertainty and photo review required; zero wing fields are ambiguous'})
write('insect-bite', records, {'version': '1.0.0', 'url': 'https://zenodo.org/records/8183211', 'license': 'CC BY 4.0', 'series': len(bite), 'speciesWithAtLeast3Specimens': sum(r['context']['independentSpecimens'] >= 3 for r in records), 'caution': 'Bite series are not independent specimens. Body and head dimensions are one anatomy family.'})

biotic = rows('biotic-2026-09-30.csv')
write('biotic', [{'species': r['SpeciesName'], 'group': r['Class'], 'sourceRow': r['id'], 'measurements': {}, 'context': r, 'review': 'hold: ordinal buckets and prose are not numerical measurements'} for r in biotic],
 {'url': 'https://api.mba.ac.uk/biotic', 'license': 'CC BY-NC-SA 4.0 (text)', 'caution': 'Preserve categorical traits as categories; never turn a size or lifespan bucket into a measured value.'})

# Duplicate N/error headers in GlobTherm must retain their positions.
path = SOURCE / 'globtherm-GlobalTherm_upload_02_11_17.csv'
manifest.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size})
with path.open(encoding='cp1252', newline='') as f:
    reader = csv.reader(f); header = next(reader); thermal = list(reader)
records = []
for index, values in enumerate(thermal):
    r = dict(zip(header, values))
    records.append({'species': f"{r['Genus']} {r['Species']}", 'group': r['Class'], 'sourceRow': index + 2,
      'measurements': {'upperTemperature': number(r['Tmax']), 'lowerTemperature': number(r['tmin'])},
      'context': {'columns': header, 'values': values}, 'review': 'hold: endpoint, acclimation, ramp, exposure duration and uncertainty must match'})
write('globtherm', records, {'url': 'https://zenodo.org/records/4976423', 'version': '2017', 'caution': 'CTmax, LT50, LT100 and thermoneutral limits are different traits. Celsius needs an absolute separation threshold.'})

(OUT / 'manifest.json').write_text(json.dumps({'inputs': manifest, 'catalogs': summary}, indent=2) + '\n')
lines = ['# Bulk animal trait coverage', '', 'Research catalogs are not approved game observations. No imported row enters daily rotation automatically.', '', '| Database | Records | Status |', '|---|---:|---|']
for name, s in summary.items():
    lines.append(f"| {name} | {s['records']:,} | {s['caution']} |")
lines += ['', '## Numeric coverage', '']
for name, s in summary.items():
    lines += [f'### {name}', '', '| Field | Nonempty finite values |', '|---|---:|']
    lines += [f'| {k} | {v:,} |' for k, v in s['numericCoverage'].items()]
    lines += ['']
(ROOT / 'DATABASE_COVERAGE.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({k: {'records': v['records'], 'numericCoverage': v['numericCoverage']} for k, v in summary.items()}, indent=2))
