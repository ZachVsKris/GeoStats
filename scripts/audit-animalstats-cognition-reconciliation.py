#!/usr/bin/env python3
"""Independently reconcile all released task endpoints to pinned individual rows."""
import csv
import json
from fractions import Fraction
from pathlib import Path

P = Path(__file__).resolve().parents[1] / 'data/animalstats'
data = json.loads((P / 'pilot.json').read_text())
rows = list(csv.DictReader((P / 'source/cognition-cylinder-2014.csv').open()))
names = {'Chimpanzee': 'pan_troglodytes', 'Gorilla': 'gorilla_gorilla',
         'Gray wolf': 'canis_lupus', 'Ring-tailed Lemur': 'lemur_catta',
         'Rhesus macaque': 'macaca_mulatta'}
checked = 0
for field, metric, unit in [('Test % Correct', 'cylinder_treat_success', '%'),
                             ('Warmups', 'cylinder_practice_trials', 'trials')]:
    for label, aid in names.items():
        cohort = [r for r in rows if r['Species'] == label]
        mean = float(sum(Fraction(r[field]) for r in cohort) / len(cohort))
        for tid in [metric, metric + '__low']:
            values = [v for v in data['values'] if v['animalId'] == aid and v['traitId'] == tid]
            assert len(values) == 1, (aid, tid, 'missing or duplicate')
            value = values[0]
            assert abs(value['valueNumeric'] - mean) < 1e-12, (aid, tid, 'incorrect mean')
            assert value['unit'] == unit and value['sampleSizeCategory'] == str(len(cohort))
            assert value['confidence'] == 'approved' and value['observationType'] == 'observed'
            assert value['sourceId'] == 'maclean-2014-cylinder-cohorts'
            checked += 1
ids = {'cylinder_treat_success', 'cylinder_treat_success__low',
       'cylinder_practice_trials', 'cylinder_practice_trials__low'}
assert sum(v['traitId'] in ids for v in data['values']) == checked
candidates = json.loads((P / 'candidates.json').read_text())
assert all(len(ids.intersection(b['traitIds'])) <= 1 for b in candidates['boards'])
print(json.dumps({'originalIndividualEndpointsReconciled': checked,
                  'noPracticeAndTestPrizesTogether': True}))
