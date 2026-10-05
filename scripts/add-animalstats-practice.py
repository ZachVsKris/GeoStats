#!/usr/bin/env python3
"""Exact recorded familiarization counts; never general learning ability or IQ."""
import csv
import hashlib
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'data/animalstats'
SOURCE = P / 'source/cognition-cylinder-2014.csv'
IDS = ['cylinder_practice_trials', 'cylinder_practice_trials__low']
NAMES = {'Chimpanzee': 'pan_troglodytes', 'Gorilla': 'gorilla_gorilla',
         'Gray wolf': 'canis_lupus', 'Ring-tailed Lemur': 'lemur_catta',
         'Rhesus macaque': 'macaca_mulatta'}
BASIS = ('Mean recorded practice trials among the tested animals in MacLean et al. (2014). '
         'Before the clear-cylinder treat test, animals practiced retrieving food from an opaque cylinder. '
         'The common training rule required four correct detours in five consecutive trials. '
         'The author dataset records the familiarization count as Warmups. Only tested cohorts are ranked; '
         'ages, experience, motivation and individual counts vary. This is not a species-wide learning-speed or intelligence ranking.')


def cohort_records():
    rows = list(csv.DictReader(SOURCE.open()))
    result = []
    for label, aid in NAMES.items():
        group = [(i + 2, row) for i, row in enumerate(rows) if row['Species'] == label]
        numbers = [float(row['Warmups']) for _, row in group]
        assert len(numbers) >= 5 and all(n >= 4 and n.is_integer() for n in numbers)
        result.append({'animalId': aid, 'sourceLabel': label, 'n': len(numbers),
                       'mean': statistics.mean(numbers), 'individualMin': min(numbers),
                       'individualMax': max(numbers), 'sourceRows': [i for i, _ in group],
                       'individualCounts': numbers})
    return result


if __name__ == '__main__':
    data = json.loads((P / 'pilot.json').read_text())
    data['traits'] = [t for t in data['traits'] if t['id'] not in IDS]
    data['values'] = [v for v in data['values'] if v['traitId'] not in IDS]
    for tid, label, direction, counter in [
        (IDS[0], 'Most practice tries', 'higher_wins', IDS[1]),
        (IDS[1], 'Fewest practice tries', 'lower_wins', IDS[0]),
    ]:
        data['traits'].append({'id': tid, 'displayName': label, 'unit': 'trials',
            'definition': BASIS, 'measurementBasis': BASIS,
            'canonicalSourceId': 'maclean-2014-cylinder-cohorts', 'eligibilityGroups': [],
            'direction': direction, 'separationMethod': 'positive_ratio_5_percent',
            'gameplayFamily': 'cognition-task', 'metricKey': 'cylinder-treat-puzzle',
            'categoryKind': 'intuitive', 'prototypeCategory': True, 'counterTraitId': counter,
            'playerHint': 'Practice attempts before a treat puzzle, averaged across the tested animals. Not IQ.'})
    cohorts = cohort_records()
    for cohort in cohorts:
        note = (f"Author dataset Warmups rows {','.join(map(str, cohort['sourceRows']))}; "
                f"N={cohort['n']} tested individuals, individual counts {cohort['individualMin']:g}–{cohort['individualMax']:g}. "
                'Exact arithmetic mean of recorded practice counts; no missing values filled. '
                'Only animals represented in the test dataset are included, not all animals ever trained. '
                'Individual ranges can overlap; no uncertainty interval was published for the mean. '
                'Original study DOI: 10.1073/pnas.1323533111; Methods, printed page E2145.')
        for tid in IDS:
            data['values'].append({'animalId': cohort['animalId'], 'traitId': tid,
                'valueNumeric': cohort['mean'], 'unit': 'trials',
                'sex': 'tested cohort; sex composition differs', 'lifeStage': 'study cohort; ages not standardized',
                'measurementBasis': BASIS, 'sourceId': 'maclean-2014-cylinder-cohorts',
                'observationType': 'observed', 'confidence': 'approved',
                'uncertaintyStatus': 'not-reported', 'uncertaintyKind': 'not-reported',
                'sampleSizeCategory': str(cohort['n']), 'sourceQuality': 'primary experimental individual data',
                'notes': note})
    (P / 'pilot.json').write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')
    (P / 'research/practice-cohort-audit.json').write_text(json.dumps({
        'sourceUrl': 'https://figshare.com/articles/dataset/MacLean_et_al_PNAS_2014_Self-Control_Data/5579335',
        'methodsCopy': 'https://vtechworks.lib.vt.edu/server/api/core/bitstreams/740f3783-10c5-4b97-8160-c92c80d31315/content',
        'paper': 'https://doi.org/10.1073/pnas.1323533111', 'methodsPage': 'E2145',
        'rawExtractionSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'rawProvenance': 'Original raw field strings restored from research checkpoint; CSV reserialized, not byte-identical original download.',
        'rankingScope': 'Recorded tested-cohort means, not population learning speed. Training failures absent from the test dataset are not inferred.',
        'boardPolicy': 'Practice and test-success prizes share one metric key so cannot appear together.',
        'cohorts': cohorts}, indent=2) + '\n')
    print(json.dumps(cohorts))
