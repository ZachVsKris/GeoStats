"""Build a provenance-preserving SQLite research database from whole source tables.

All imported records remain pending. Source-reported does not mean measured.
Run after download-animalstats-bulk-intake.py and the mammal/TOFF acquisitions.
The database is generated locally; the schema, hashes and coverage report persist.
"""
import collections
import csv
import hashlib
import json
import math
import os
import sqlite3
from pathlib import Path

import openpyxl
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/animalstats/source/bulk-intake-20261010'
DEST = ROOT / 'data/animalstats/research/bulk-research.sqlite'
REPORT = ROOT / 'data/animalstats/research/bulk-research-build.json'
ROSTER = {a['scientificName'].casefold(): a['id'] for a in json.loads((ROOT / 'data/animalstats/pilot.json').read_text())['animals']}
MISSING = {'', 'na', 'n/a', 'nan', 'null', 'none', '-', '-9999', 'unknown', 'insufficient information', 'not researched', 'not applicable', 'not relevant'}
SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE sources(id TEXT PRIMARY KEY, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)));
CREATE TABLE source_tables(source_id TEXT REFERENCES sources(id), name TEXT, role TEXT, raw_sha256 TEXT, rows INTEGER,
  PRIMARY KEY(source_id,name));
CREATE TABLE fields(source_id TEXT, table_name TEXT, name TEXT, present_rows INTEGER, numeric_rows INTEGER,
  roster_count INTEGER, source_imputed_rows INTEGER, source_calculated_rows INTEGER,
  review_status TEXT NOT NULL CHECK(review_status IN ('pending','approved','rejected')),
  PRIMARY KEY(source_id,table_name,name), FOREIGN KEY(source_id,table_name) REFERENCES source_tables(source_id,name));
CREATE TABLE records(source_id TEXT, table_name TEXT, source_row INTEGER, scientific_name TEXT, roster_id TEXT,
  data_json TEXT NOT NULL CHECK(json_valid(data_json)), provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)),
  review_status TEXT NOT NULL CHECK(review_status IN ('pending','approved','rejected')),
  PRIMARY KEY(source_id,table_name,source_row), FOREIGN KEY(source_id,table_name) REFERENCES source_tables(source_id,name));
CREATE INDEX records_roster ON records(roster_id,source_id,table_name);
CREATE INDEX records_taxon ON records(scientific_name,source_id);
CREATE INDEX fields_review ON fields(review_status,roster_count,numeric_rows);
CREATE VIEW approved_record_reviews AS SELECT * FROM records WHERE review_status='approved';
'''


def meaningful(value):
    return value is not None and str(value).strip().casefold() not in MISSING


def clean(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return value


def csv_rows(path, delimiter=',', encoding='utf-8-sig'):
    with path.open(encoding=encoding, newline='') as f:
        yield from csv.DictReader(f, delimiter=delimiter)


def parquet_rows(path):
    for batch in pq.ParquetFile(path).iter_batches(batch_size=2048):
        yield from batch.to_pylist()


temp = DEST.with_suffix('.building.sqlite')
temp.unlink(missing_ok=True)
con = sqlite3.connect(temp)
con.executescript(SCHEMA)
report = {'schemaVersion': 1, 'status': 'research-only', 'approvedRecords': 0,
          'countingRule': 'Source records are not unique animals, measurements or playable categories.', 'sources': [],
          'qualityGates': ['Original-method verification', 'Exclude imputed/calculated values',
                           'Comparable unit, sex, stage, statistic and environment', 'License review',
                           'Interest, duplicate-category and cohort-coverage review']}


def add_source(source_id, metadata):
    con.execute('INSERT INTO sources VALUES (?,?)', (source_id, json.dumps(metadata, ensure_ascii=False)))


def ingest(source_id, name, path, rows, taxon=lambda r: None, provenance=lambda r: {}, role='trait-data', row_offset=2):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    con.execute('INSERT INTO source_tables VALUES (?,?,?,?,0)', (source_id, name, role, digest))
    counts, nums = collections.Counter(), collections.Counter()
    imputed, calculated = collections.Counter(), collections.Counter()
    roster = collections.defaultdict(set)
    matched, taxa = set(), set()
    batch, total = [], 0
    for i, row in enumerate(rows):
        row = {str(k): clean(v) for k, v in row.items()}
        scientific = taxon(row)
        if scientific:
            scientific = scientific.replace('_', ' ').strip(); taxa.add(scientific)
        animal_id = ROSTER.get(scientific.casefold()) if scientific else None
        if animal_id:
            matched.add(animal_id)
        lineage = provenance(row)
        # Omit missing cells in the working JSON; original source files are pinned
        # by checksum and the full schema is retained in the field inventory.
        data = {k: v for k, v in row.items() if meaningful(v)}
        for field, value in data.items():
            counts[field] += 1
            try:
                if math.isfinite(float(value)):
                    nums[field] += 1
            except (TypeError, ValueError):
                pass
            if animal_id:
                roster[field].add(animal_id)
            flag = str(lineage.get(field, '')).casefold()
            if 'imputed' in flag or flag == '1':
                imputed[field] += 1
            if any(term in flag for term in ['calculated', 'assumed', 'model derived']):
                calculated[field] += 1
        for field in row:
            counts.setdefault(field, 0)
        batch.append((source_id, name, i + row_offset, scientific, animal_id,
                      json.dumps(data, ensure_ascii=False, allow_nan=False), json.dumps(lineage, ensure_ascii=False), 'pending'))
        total += 1
        if len(batch) == 2048:
            con.executemany('INSERT INTO records VALUES (?,?,?,?,?,?,?,?)', batch); batch.clear()
    if batch:
        con.executemany('INSERT INTO records VALUES (?,?,?,?,?,?,?,?)', batch)
    con.execute('UPDATE source_tables SET rows=? WHERE source_id=? AND name=?', (total, source_id, name))
    fields = [{'field': field, 'presentRows': count, 'numericRows': nums[field], 'currentRosterCount': len(roster[field]),
               'sourceFlaggedImputedRows': imputed[field], 'sourceFlaggedCalculatedOrAssumedRows': calculated[field],
               'reviewStatus': 'pending'} for field, count in counts.items()]
    con.executemany('INSERT INTO fields VALUES (?,?,?,?,?,?,?,?,?)',
                    [(source_id, name, f['field'], f['presentRows'], f['numericRows'], f['currentRosterCount'],
                      f['sourceFlaggedImputedRows'], f['sourceFlaggedCalculatedOrAssumedRows'], 'pending') for f in fields])
    con.commit()
    result = {'source': source_id, 'table': name, 'role': role, 'rows': total, 'uniqueNamedTaxa': len(taxa),
              'currentRosterMatches': sorted(matched), 'fields': fields,
              'input': {'path': str(path.relative_to(ROOT)), 'sha256': digest}}
    report['sources'].append(result)
    print(source_id, name, total, 'rows;', len(matched), 'roster matches', flush=True)


try:
    for database in ['fishbase', 'sealifebase']:
        add_source(database, {'version': '26.06', 'quality': 'mixed methods; original reference review pending', 'license': 'noncommercial terms; review before product reuse'})
        names = {str(r['SpecCode']): f"{r['Genus']} {r['Species']}" for r in parquet_rows(SOURCE / database / 'species.parquet')}
        for path in sorted((SOURCE / database).glob('*.parquet')):
            def taxon(row):
                key = next((k for k in row if k.casefold() == 'speccode'), None)
                return names.get(str(row.get(key))) if key else None
            role = 'bibliography' if path.stem == 'refrens' else 'taxonomy' if path.stem == 'species' else 'trait-data'
            ingest(database, path.stem, path, parquet_rows(path), taxon,
                   lambda r: {k: v for k, v in r.items() if 'ref' in k.casefold() and meaningful(v)}, role, row_offset=1)

    add_source('marsupial', json.loads((SOURCE / 'marsupial-metadata.json').read_text()))
    path = next((SOURCE / 'marsupial').rglob('trait_database.csv'))
    ingest('marsupial', 'observations', path, csv_rows(path, ';', 'cp1252'), lambda r: r['Genus_species'],
           lambda r: {k: v for k, v in r.items() if k.endswith('_ref') and meaningful(v)})

    add_source('biotic', {'url': 'https://api.mba.ac.uk/biotic', 'license': 'CC BY-NC-SA 4.0', 'quality': 'bins/codes; no midpoint inference'})
    path = SOURCE / 'biotic.csv'
    ingest('biotic', 'species', path, csv_rows(path), lambda r: r['SpeciesName'])

    add_source('combine', json.loads((SOURCE / 'combine-metadata.json').read_text()))
    folder = SOURCE / 'combine'
    # Harmonized species names repeat. A dictionary keyed only by binomial would
    # silently overwrite their provenance. Verify the paired source rows instead.
    citations = iter(csv_rows(folder / 'trait_data_sources.csv'))
    taxonomy_keys = ['order', 'family', 'genus', 'species', 'iucn2020_binomial', 'phylacine_binomial']
    aliases = {'adult_brain_mass_g': 'brain_mass_g', 'teat_number_n': 'teat_number',
               'litters_per_year_n': 'litters_per_year', 'social_group_n': 'social_group_size',
               'det_vfish': 'det_fish', 'disected_by_mountains': 'dissected_by_mountains'}
    def combine_provenance(row):
        refs = next(citations)
        if any(row[k] != refs[k] for k in taxonomy_keys):
            raise ValueError('COMBINE reported/source rows are not aligned')
        return {k: refs.get(aliases.get(k, k)) for k in row if k not in ['order', 'family', 'genus', 'species', 'iucn2020_binomial', 'phylacine_binomial']}
    path = folder / 'trait_data_reported.csv'
    ingest('combine', 'reported', path, csv_rows(path), lambda r: r['iucn2020_binomial'], combine_provenance)
    if next(citations, None) is not None:
        raise ValueError('Unmatched COMBINE source rows')
    for name in ['trait_data_sources', 'trait_databases', 'taxonomy_crosswalk']:
        path = folder / (name + '.csv'); ingest('combine', name, path, csv_rows(path), role='provenance')

    add_source('tetrapod', json.loads((SOURCE / 'tetrapod-metadata.json').read_text()))
    path = SOURCE / 'tetrapod/TetrapodTraits_v2.0.1.csv'
    flag_fields = {'BodyLength_mm': 'ImputedLength', 'BodyMass_g': 'ImputedMass', 'Diu': 'ImputedActTime', 'Noc': 'ImputedActTime',
                   'Nocturnality': 'ImputedActTime', 'ThreatStatus': 'ImputedThreatStatus'}
    def tetra_provenance(row):
        result = {k: v for k, v in row.items() if k.startswith('Source') or k.startswith('Imputed')}
        for field, flag in flag_fields.items():
            result[field] = row.get(flag, '')
        for field in ['Fos', 'Ter', 'Aqu', 'Arb', 'Aer', 'Verticality']:
            result[field] = row.get('ImputedHabitat', '')
        for field in row:
            if field.startswith('MajorHabitat'):
                result[field] = row.get('ImputedMajorHabitat', '')
        for field in ['EcoTer', 'EcoFresh', 'EcoMar', 'EcosystemSum']:
            result[field] = row.get('ImputedEcosystem', '')
        for field in ['DirectDev', 'LarvalStage', 'Viviparity']:
            result[field] = row.get('Source' + field, '')
        return result
    ingest('tetrapod', 'mixed-observed-imputed', path, csv_rows(path), lambda r: r['Scientific.Name'], tetra_provenance)

    add_source('toff', {'doi': '10.6084/m9.figshare.10253291.v2', 'status': 'raw export quarantined: malformed nested CSV',
                        'context': 'thesaurus updated 2024; measurements released 2019; never assume all definitions have observations'})
    for path in sorted((SOURCE / 'toff/TOFF_Data_Release').glob('*.csv')):
        ingest('toff', path.stem, path, ({'rawLine': line} for line in path.read_text().splitlines()), role='quarantined-raw-export', row_offset=1)
    path = next((SOURCE / 'toff').glob('*.xlsx'))
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook['BMPP Traits']; iterator = iter(sheet.values); header = next(iterator)
    ingest('toff', 'trait-definitions', path, (dict(zip(header, row)) for row in iterator), role='definitions')
    workbook.close()

    assert con.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert not con.execute('PRAGMA foreign_key_check').fetchall()
    assert con.execute('SELECT count(*) FROM approved_record_reviews').fetchone()[0] == 0
    report['recordCount'] = con.execute('SELECT count(*) FROM records').fetchone()[0]
    report['tableCount'] = con.execute('SELECT count(*) FROM source_tables').fetchone()[0]
    report['fieldCount'] = con.execute('SELECT count(*) FROM fields').fetchone()[0]
    report['matchedRecordCount'] = con.execute('SELECT count(*) FROM records WHERE roster_id IS NOT NULL').fetchone()[0]
    report['sourceCount'] = con.execute('SELECT count(*) FROM sources').fetchone()[0]
    report['schema'] = SCHEMA
    priority_fields = ['adult_mass_g', 'adult_brain_mass_g', 'adult_body_length_mm', 'max_longevity_d',
                       'gestation_length_d', 'teat_number_n', 'litter_size_n', 'litters_per_year_n',
                       'weaning_age_d', 'social_group_n', 'home_range_km2', 'density_n_km2',
                       'BodyMass_g', 'BodyLength_mm', 'MaxLongevity', 'LitterSize', 'DietBreadth',
                       'RangeSize_km2', 'YearOfDescription', 'FecundityMax', 'Eggdiammax', 'Speedms']
    queue = []
    con.row_factory = sqlite3.Row
    for row in con.execute("SELECT * FROM fields WHERE table_name NOT IN ('trait_data_sources','species') AND name IN ("
                           + ','.join('?' for _ in priority_fields) + ") AND numeric_rows>0", priority_fields):
        item = dict(row)
        item.update(reviewDecision='held: source method/definition/license review remains', counterDirectionsKeptTogether=True)
        queue.append(item)
    (REPORT.parent / 'bulk-priority-field-review.json').write_text(json.dumps(
        {'status': 'manual-review-queue', 'countIsNotNewCategories': True, 'fields': queue}, indent=2) + '\n')
    con.close(); os.replace(temp, DEST)
    report['databaseBytes'] = DEST.stat().st_size
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['recordCount', 'tableCount', 'fieldCount', 'sourceCount', 'matchedRecordCount', 'approvedRecords', 'databaseBytes']}))
except Exception:
    con.close(); temp.unlink(missing_ok=True); raise
