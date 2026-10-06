#!/usr/bin/env python3
"""Exact counts from the pinned expert taxonomy and distribution release, no imputation."""
import csv
import gzip
import hashlib
import io
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'data/animalstats'
SOURCE = P / 'source/mdd'
SID = 'asm-mdd-v25-counts'
SHA256 = '0d07a7e9409712fa86c1e3afadcf4c67bf4f9e16d5693a878e11ec1bf6860493'
CONTINENTS = {'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'}
METRICS = {
    'mdd_country_count': {
        'labels': ['Most countries & territories', 'Fewest countries & territories'],
        'unit': 'countries/territories', 'kind': 'intuitive', 'family': 'range-geography',
        'key': 'country-spread',
        'basis': ('Number of confirmed country and territory entries in the ASM Mammal Diversity Database v2.5 range list. '
                  'Native populations, reintroductions within native range, and ancient introductions before 1500 CE are included. '
                  'Recent introductions are excluded. Entries marked uncertain or possibly extinct (?) are excluded. '
                  'Distant dependencies count separately as in the source. This is a curated native/historical list, not all present-day populations.'),
        'hint': 'Confirmed native/historical country and territory entries. Recent introductions excluded.',
    },
    'mdd_continent_count': {
        'labels': ['Most continents', 'Fewest continents'], 'unit': 'continents',
        'kind': 'intuitive', 'family': 'range-geography', 'key': 'continent-spread',
        'basis': ('Number of distinct continents explicitly listed in the ASM Mammal Diversity Database v2.5 native/historical distribution. '
                  'The source includes native populations, reintroductions within native range, and ancient introductions before 1500 CE, '
                  'and excludes recent introductions. Its seven-continent convention uses Oceania, with Europe and Asia separate. '
                  'Continents are counted directly from the published list; missing continents are never inferred from country names.'),
        'hint': 'Continents in its native/historical range; recent introductions excluded.',
    },
    'mdd_family_species_count': {
        'labels': ['Most species in its family', 'Fewest species in its family'], 'unit': 'species',
        'kind': 'specialist', 'family': 'taxonomy', 'key': 'family-diversity',
        'basis': ('Number of recognized living species in this mammal’s taxonomic family in ASM Mammal Diversity Database v2.5. '
                  'Includes the named species and recognized domestic species; recently extinct species are excluded. '
                  'A taxonomic family is a group such as the cat family, not a mother and her young. '
                  'These are exact counts within the named expert classification, not individual populations or a genetic-distance measure. '
                  'Taxonomic revisions can change the counts; the source version is fixed.'),
        'hint': 'Living species in its taxonomic family, such as the cat family. Source version v2.5.',
    },
}

def main():
    raw = gzip.decompress((SOURCE / 'MDD_v2.5_6904species.csv.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest() == SHA256
    metadata = json.loads((SOURCE / 'release-metadata.json').read_text())
    assert metadata['version'] == 'v2.5' and metadata['doi'] == '10.5281/zenodo.21654811'
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    assert len(rows) == 6904 and len({r['sciName'] for r in rows}) == 6904
    assert sum(r['extinct'] == '0' for r in rows) == 6791
    assert sum(r['extinct'] == '0' and r['domestic'] == '1' for r in rows) == 17
    families = Counter(r['family'] for r in rows if r['extinct'] == '0')
    index = {r['sciName'].replace('_', ' '): (i, r) for i, r in enumerate(rows, 2)}
    data = json.loads((P / 'pilot.json').read_text())
    ids = {tid + suffix for tid in METRICS for suffix in ['', '__low']}
    data['sources'] = [s for s in data['sources'] if s['id'] != SID] + [{
        'id': SID, 'name': 'American Society of Mammalogists: MDD v2.5',
        'sourceClass': 'institutional-database', 'url': 'https://zenodo.org/records/21654811',
        'versionYear': 'v2.5 · 2026-07-28', 'retrievedAt': '2026-10-05', 'license': 'CC BY 4.0',
    }]
    data['traits'] = [t for t in data['traits'] if t['id'] not in ids]
    data['values'] = [v for v in data['values'] if v['traitId'] not in ids]
    for tid, metric in METRICS.items():
        for low in [False, True]:
            data['traits'].append({
                'id': tid + ('__low' if low else ''), 'displayName': metric['labels'][int(low)],
                'unit': metric['unit'], 'definition': metric['basis'], 'measurementBasis': metric['basis'],
                'canonicalSourceId': SID, 'eligibilityGroups': [], 'direction': 'lower_wins' if low else 'higher_wins',
                'separationMethod': 'positive_ratio_5_percent',
                'gameplayFamily': metric['family'], 'metricKey': metric['key'], 'categoryKind': metric['kind'],
                'prototypeCategory': True, 'counterTraitId': tid + ('' if low else '__low'), 'playerHint': metric['hint'],
            })
    admitted, excluded = [], []
    for animal in data['animals']:
        if animal.get('entityType') == 'breed':
            continue  # Species distributions and family counts are not breed data.
        match = index.get(animal['scientificName'])
        if not match:
            continue  # No silent synonym/species-complex substitution.
        number, row = match
        if row['extinct'] != '0' or row['flagged'] != '0':
            excluded.append({'animalId': animal['id'], 'reason': 'Recently extinct or taxonomically questionable target.'})
            continue
        confirmed_places = sorted({s.strip() for s in row['countryDistribution'].split('|') if s.strip() and '?' not in s and s.strip() not in {'NA', 'Domesticated'}})
        uncertain_places = [s for s in row['countryDistribution'].split('|') if '?' in s]
        continents = sorted({s.strip() for s in row['continentDistribution'].split('|') if s.strip() in CONTINENTS})
        measurements = {'mdd_family_species_count': families[row['family']]}
        if row['domestic'] == '0' and confirmed_places:
            measurements['mdd_country_count'] = len(confirmed_places)
        if row['domestic'] == '0' and continents:
            measurements['mdd_continent_count'] = len(continents)
        for tid, number_value in measurements.items():
            metric = METRICS[tid]
            extra = (f'Family: {row["family"]}; counted {number_value} living records in this exact source classification. '
                     'Recognized flagged contributing taxa remain part of the source’s accepted list; the target itself is not flagged.') if tid == 'mdd_family_species_count' else (
                     'Exact confirmed entries: ' + '; '.join(confirmed_places) + '. '
                     'Uncertain entries excluded from country count: ' + ('; '.join(uncertain_places) or 'none') + '. '
                     'Published continent list: ' + '; '.join(continents) + '. '
                     'Native range and pre-1500 introductions included; recent introductions excluded as in the source.')
            note = f'Original CSV row {number}; MDD taxon #{row["id"]}; exact name {row["sciName"]}. ' + extra + f' Taxon page: https://www.mammaldiversity.org/taxon/{row["id"]}.'
            for low in [False, True]:
                data['values'].append({
                    'animalId': animal['id'], 'traitId': tid + ('__low' if low else ''), 'valueNumeric': number_value,
                    'unit': metric['unit'], 'sex': 'not applicable', 'lifeStage': 'species-level source inventory',
                    'measurementBasis': metric['basis'], 'sourceId': SID, 'observationType': 'compiled', 'confidence': 'approved',
                    'uncertaintyStatus': 'not-reported', 'uncertaintyKind': 'not-reported',
                    'sourceQuality': 'versioned expert taxonomy/range inventory; exact list counts', 'notes': note,
                })
        admitted.append({'animalId': animal['id'], 'sourceRow': number, 'mddId': row['id'], 'sciName': row['sciName'],
                         'family': row['family'], 'measurements': measurements, 'uncertainCountries': uncertain_places})
    (P / 'pilot.json').write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')
    report = {'doi': metadata['doi'], 'version': metadata['version'], 'rawCsvSha256': SHA256,
              'recognizedRecords': len(rows), 'livingRecords': sum(families.values()), 'matchedTargets': len(admitted),
              'observationDirectionsAdded': sum(len(r['measurements']) * 2 for r in admitted),
              'labelPairs': [m['labels'] for m in METRICS.values()], 'admitted': admitted, 'excluded': excluded,
              'qualityNotes': [
                  'Homepage’s displayed DOI resolves to v2.3; used the original v2.5 release.toml DOI and verified original file MD5.',
                  'META text mentions 19 domestic species; actual pinned v2.5 rows contain 17, matching release.toml. Counts use actual rows.',
                  'No imputation, uncertain country inclusion, unannounced taxon substitution or population inference.',
                  'Distribution describes native/historical lists, including pre-1500 introductions; never presented as all modern populations.',
              ]}
    (P / 'research/mdd-counts-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in {'admitted', 'excluded'}}, indent=2))

if __name__ == '__main__':
    main()
