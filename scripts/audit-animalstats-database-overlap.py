#!/usr/bin/env python3
"""Find species intersections in whole databases before choosing game animals."""
import collections, gzip, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'data/animalstats'
def load(name):
    with gzip.open(ROOT / 'research' / (name + '.jsonl.gz'), 'rt') as f:
        return [json.loads(line) for line in f]
def key(name):
    return name.lower().strip().replace('_', ' ')
thermal = collections.defaultdict(list)
for r in load('globtherm'):
    thermal[key(r['species'])].append(r)
traits = collections.defaultdict(list)
for r in load('animaltraits'):
    traits[key(r['species'])].append(r)
pack = []
for r in load('insect-bite'):
    if r['context']['independentSpecimens'] < 3 or ' sp ' in key(r['species']):
        continue
    heat = []
    for t in thermal[key(r['species'])]:
        # Original positional columns preserve duplicate headers.
        c = dict(zip(t['context']['columns'], t['context']['values']))
        heat.append({'endpoint': c['max_metric'], 'acclimation': c['max_pretreatment'], 'ramp': c['max_ramp'], 'upperTemperature': t['measurements']['upperTemperature'], 'source': c['REF_max']})
    at = traits[key(r['species'])]
    pack.append({'species': r['species'], 'order': r['group'], 'specimens': r['context']['independentSpecimens'], 'hasThermalRecord': bool(heat), 'thermalProtocols': heat,
      'animalTraitsRecords': len(at), 'animalTraitsFields': sorted({k for a in at for k in a['measurements']}), 'reviewStatus': 'research-only'})
report = {'namedInsectsWithAtLeast3Specimens': len(pack), 'withThermalRecords': sum(p['hasThermalRecord'] for p in pack), 'withAnimalTraitsRecords': sum(p['animalTraitsRecords'] > 0 for p in pack), 'species': pack}
(ROOT / 'research' / 'insect-coverage-intersections.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'species'}, indent=2))
