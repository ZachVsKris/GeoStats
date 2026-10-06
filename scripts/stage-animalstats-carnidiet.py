#!/usr/bin/env python3
"""Screen pinned original diet records without approving any gameplay values."""
import collections
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

P = Path(__file__).resolve().parents[1] / 'data/animalstats'
source = P / 'source/carnidiet'
raw = gzip.decompress((source / 'CarniDIET_1.0.csv.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest() == '4b3fca67eab47d121f0b19ed8f8a1b677863f8c07bd426205626cc972525dec7'
assert len(raw) == 24848622
# Original Windows text bytes are retained verbatim in gzip; never silently
# replace undecodable characters or claim a reserialized CSV is original.
rows = list(csv.DictReader(io.StringIO(raw.decode('cp1252'))))
assert len(rows) == 29121
data = json.loads((P / 'pilot.json').read_text())
catalog = {a['scientificName'].replace(' ', '_'): a for a in data['animals'] if a.get('entityType') != 'breed'}
methods = collections.Counter(r['methodQuantification'] for r in rows)
protocols = collections.Counter(r['samplingProtocol'] for r in rows)
foods = collections.Counter(r['foodType'] for r in rows)
targets = collections.defaultdict(list)
anomalies = []
for index, row in enumerate(rows, 2):
    try:
        value = float(row['percentage'])
        if not 0 <= value <= 100:
            anomalies.append({'sourceRow': index, 'recordID': row['recordID'],
                              'reason': 'percentage outside 0–100', 'rawValue': row['percentage']})
    except ValueError:
        anomalies.append({'sourceRow': index, 'recordID': row['recordID'],
                          'reason': 'non-numeric percentage', 'rawValue': row['percentage']})
    # Only a primary-review shortlist. These are still pending, not a claim
    # that weighing fecal material measures the amount originally eaten.
    if row['scientificNameCarni'] in catalog and row['methodQuantification'] == 'Dry weight in source (%)':
        key = (row['scientificNameCarni'], row['sourcePrimaryReference'], row['samplingProtocol'])
        targets[key].append({'sourceRow': index, 'recordID': row['recordID'],
            'foodType': row['foodType'], 'preyName': row['scientificNamePrey'],
            'percentage': row['percentage'], 'percentageError': row['percentageError'],
            'sampleCount': row['sampleSizeScatStomachTissue'], 'season': row['season'],
            'sex': row['sexCarni'], 'lifeStage': row['lifeStageCarni'],
            'startYear': row['startYear'], 'endYear': row['endYear'], 'country': row['country']})
report = {
    'paper': 'https://doi.org/10.1111/geb.13296',
    'dataset': 'https://doi.org/10.5061/dryad.2v6wwpzmr',
    'originalSourceSha256': hashlib.sha256(raw).hexdigest(),
    'sourceRows': len(rows), 'sourceTaxa': len({r['scientificNameCarni'] for r in rows}),
    'exactCatalogTaxa': sorted(set(catalog).intersection(r['scientificNameCarni'] for r in rows)),
    'foodTypeCounts': dict(foods), 'methodCounts': dict(methods), 'protocolCounts': dict(protocols),
    'gameplayAdmissions': 0, 'playableLabelsAdded': 0,
    'interpretation': {
        'notIndividuals': 'Rows are prey/study records, not independent tested animals or independent diet cohorts.',
        'estimatedBiomassAndVolumeExcluded': 'Original workbook Definitions calls biomass consumed and volume in source estimates. Do not admit as measured food shares.',
        'occurrenceNotConsumption': 'Frequency in sampled scats or stomachs is not biomass eaten, calorie intake or complete meal composition.',
        'noMissingZeros': 'Absent food entries are not zero consumption. No diet category is filled from an unreported item.',
        'noNaiveSums': 'Prey taxa can nest or overlap; geography, season, sex and sampling protocols differ. Do not sum all rows into species percentages.',
        'noUnboundedDiversity': 'Distinct recorded prey counts depend on study effort and taxonomic resolution, so are not species-wide diet diversity.',
        'dryWeightPending': 'Trace primary papers and whether material was directly weighed. Fecal/stomach dry mass is not food biomass originally eaten. Preserve cohort and season.',
    },
    'numericAnomalies': anomalies,
    'primaryReviewTargets': [{'animalId': catalog[name]['id'], 'sourceSpecies': name,
        'reference': reference, 'protocol': protocol, 'status': 'pending-primary-study-review',
        'records': records} for (name, reference, protocol), records in targets.items()],
}
(P / 'research/carnidiet').mkdir(exist_ok=True)
(P / 'research/carnidiet/source-screen.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({k: report[k] for k in ['sourceRows', 'sourceTaxa', 'exactCatalogTaxa',
                                     'gameplayAdmissions', 'playableLabelsAdded']}))
