"""Inventory entire downloaded databases without changing the playable catalog.

Run from the repository root. Requires pyarrow. Raw downloads remain in source/;
the durable report includes their checksums, field coverage and promotion holds.
No bins, category IDs, missing-data codes or model coefficients become rankings.
"""
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/animalstats/source/bulk-intake-20261010'
OUT = ROOT / 'data/animalstats/research/bulk-database-audit-20261010.json'
PILOT = json.loads((ROOT / 'data/animalstats/pilot.json').read_text())
ROSTER = {a['scientificName'].replace('_', ' ').casefold(): a['id'] for a in PILOT['animals']}
MISSING = {'', 'na', 'n/a', 'nan', 'none', 'null', '-', '-9999', 'not researched', 'insufficient information', 'not relevant', 'not applicable', 'unknown'}


def valid(v):
    return v is not None and str(v).strip().casefold() not in MISSING


def fingerprint(p):
    return {'file': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}


def interest(field):
    f = field.lower()
    if re.search(r'(ref|code|autoctr|entered|modified|date|expert|^ts$|remark|comment|^id$|family|genus|species|speccode|stockcode)', f):
        return 'metadata-or-context'
    if re.search(r'(testicular|pouch_vacation|metabolic|chromosome|cephalothorax|opisthosoma|scopul|instar|gonad|oilglob|perivit|chorion)', f):
        return 'specialist-review'
    if re.search(r'(mass|lifespan|longevity|litter|gestation|fecundity|speed|diet|foodtype|foodname|body length|range size|mean_group_size|weaning|first_reproduction|parentalcare|hibernation|toxic|regeneration)', f):
        return 'priority-review'
    return 'manual-interest-review'


def coverage(rows, field, species_key=None):
    present = [r for r in rows if valid(r.get(field))]
    c = collections.Counter(str(r[field]) for r in present)
    numeric = 0
    for r in present:
        try:
            float(r[field]); numeric += 1
        except (TypeError, ValueError):
            pass
    result = {'field': field, 'presentRows': len(present), 'numericRows': numeric,
              'distinctValues': len(c), 'interest': interest(field),
              'commonValues': c.most_common(5), 'playable': False}
    if species_key:
        species = {str(r[species_key]).replace('_', ' ').casefold() for r in present}
        result['speciesWithData'] = len(species)
        result['currentRosterMatches'] = sorted(ROSTER[s] for s in species if s in ROSTER)
    return result


report = {'retrievedAt': '2026-10-10', 'status': 'research-only', 'addedPlayableLabels': 0,
          'countingRule': 'Source fields are not distinct metrics or playable categories; opposite directions are not counted here. Upstream duplicates must be reconciled before promotion.',
          'promotionRequirements': ['Source method and reference join', 'Measured versus modeled classification',
                                    'Sex/life stage/statistic/unit compatibility', 'Interest review and source deduplication',
                                    'Coverage floor: broad 50 across 3 groups; scoped 20; breed 8',
                                    'Enough familiar animals and mostly intuitive categories in complete boards',
                                    'License compatibility'], 'sources': []}

mars = next((SOURCE / 'marsupial').rglob('trait_database.csv'))
rows = list(csv.DictReader(mars.read_bytes().decode('cp1252').splitlines(), delimiter=';'))
metadata = json.loads((SOURCE / 'marsupial-metadata.json').read_text())
trait_fields = [k for k in rows[0] if not k.endswith('_ref') and k not in {'Order', 'Family', 'Genus', 'Species', 'Genus_species'}]
fields = []
for k in trait_fields:
    item = coverage(rows, k, 'Genus_species')
    ref_key = next((x for x in rows[0] if x.endswith('_ref') and x.startswith(k.rsplit('_', 1)[0])), None)
    # Several source names omit units or use a separate suffix; preserve all
    # reference fields in the raw table instead of guessing a join when ambiguous.
    item['referenceFieldCandidate'] = ref_key
    item['hold'] = 'Review upstream references; reported compilations can contain inferred values. Do not substitute the supplied mean table for observation-level provenance.'
    fields.append(item)
report['sources'].append({'id': 'marsupial-2026', 'title': metadata['title'], 'doi': metadata['doi'],
                         'license': metadata['license'], 'raw': fingerprint(mars),
                         'rows': len(rows), 'species': len({r['Genus_species'] for r in rows}),
                         'traitFields': len(fields), 'referenceFields': len([k for k in rows[0] if k.endswith('_ref')]),
                         'fields': fields, 'acquisition': 'complete observation table and species-mean table acquired'})

biotic = SOURCE / 'biotic.csv'
with biotic.open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
context = {'id', 'SpeciesName', 'ResearchedBy', 'DataSuppliedBy', 'RefereedBy', 'Phylum', 'Class', 'Ordr', 'Family', 'Genus', 'Species'}
fields = [coverage(rows, k, 'SpeciesName') for k in rows[0] if k not in context]
for item in fields:
    item['hold'] = 'Many values are bins or categorical codes. Do not convert ranges to guessed midpoints or treat category codes as quantities. Preserve researcher/referee attribution.'
report['sources'].append({'id': 'mba-biotic', 'url': 'https://api.mba.ac.uk/help_biotic',
                         'downloadUrl': 'https://api.mba.ac.uk/biotic', 'raw': fingerprint(biotic),
                         'rows': len(rows), 'totalColumns': len(rows[0]), 'traitFields': len(fields),
                         'license': 'CC BY-NC-SA 4.0; text only; review product reuse before promotion',
                         'fields': fields, 'acquisition': 'complete published species CSV acquired'})

for database, db in [('fishbase', 'fb'), ('sealifebase', 'slb')]:
    tables = []
    support = []
    species_rows = pq.read_table(SOURCE / database / 'species.parquet').to_pylist()
    roster_codes = {}
    for row in species_rows:
        name = (str(row.get('Genus', '')) + ' ' + str(row.get('Species', ''))).casefold()
        if name in ROSTER:
            roster_codes[str(row['SpecCode'])] = ROSTER[name]
    for p in sorted((SOURCE / database).glob('*.parquet')):
        table = pq.read_table(p)
        if p.stem in {'species', 'refrens'}:
            support.append({'table': p.stem, 'raw': fingerprint(p), 'rows': table.num_rows,
                            'columns': table.num_columns, 'role': 'taxonomy join' if p.stem == 'species' else 'original bibliography join',
                            'countedAsNewTraitTable': False})
            continue
        rows = table.to_pylist()
        keys = {k.casefold(): k for k in table.column_names}
        species_key = keys.get('speccode')
        fields = [coverage(rows, k) for k in table.column_names]
        for field in fields:
            if re.search(r'(troph|winfinity|loo|^k$|^m$|^tm$|^rm$|^r2$|^se_|^sd_|^lcl_|^ucl_|snouttip|origin[xy]|end[xy])', field['field'], re.I):
                field['hold'] = 'Model/fit/image-derived candidate: exclude from exact biological rankings unless a defensible observation-level method is established.'
            else:
                field['hold'] = 'Join table-specific reference IDs and species codes; review units, stage, sex, locality and method. Nonempty is not vetted.'
            if species_key:
                field['taxonCodesWithData'] = len({r[species_key] for r in rows if valid(r.get(field['field'])) and valid(r.get(species_key))})
                field['currentRosterMatches'] = sorted({roster_codes[str(r[species_key])] for r in rows if valid(r.get(field['field'])) and str(r[species_key]) in roster_codes})
        tables.append({'table': p.stem, 'raw': fingerprint(p), 'downloadUrl': f'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/cboettig/fishbase/{db}/v26.06/parquet/{p.name}',
                       'rows': table.num_rows, 'columns': table.num_columns, 'fields': fields})
    report['sources'].append({'id': database + '-additional-tables-26.06', 'version': '26.06',
                             'acquisition': 'complete listed Parquet tables acquired; not the entire database',
                             'license': 'FishBase/SeaLifeBase bulk distribution is noncommercial; review original terms and references before product reuse.',
                             'tables': tables, 'tableCount': len(tables), 'supportTables': support,
                             'currentRosterSpeciesInTaxonomyTable': len(set(roster_codes.values())),
                             'totalColumnsAcrossTables': sum(t['columns'] for t in tables),
                             'totalRowsAcrossTables': sum(t['rows'] for t in tables),
                             'deduplication': 'Species tables and existing traits already used by AnimalStats are not new categories.'})

spider = SOURCE / 'spider-traits.json'
d = json.loads(spider.read_text())
report['sources'].append({'id': 'world-spider-traits', 'url': 'https://spidertraits.sci.muni.cz/',
                         'doi': '10.1093/database/baab064', 'raw': fingerprint(spider),
                         'acquisition': 'complete trait definition catalog acquired; 100-record access sample only, not full measurement database',
                         'traitDefinitions': len(d['items']),
                         'fields': [dict(x, interest=interest(x['name']), playable=False) for x in d['items']],
                         'hold': 'Full public observation pagination, per-trait coverage and license review remain. Restricted data must remain excluded. Preserve unit, sex, stage, measure, treatment, method and references.'})

report['sources'].append({'id': 'mammal-knowledge-gap-synthesis-2026',
                         'doi': '10.5061/dryad.05qfttfdq', 'version': 435342,
                         'speciesAdvertised': 5706, 'workbooksAdvertised': 7,
                         'acquisition': 'metadata and file manifest acquired; workbook downloads return 401 API / 403 public endpoint',
                         'hold': 'Not acquired trait data. Binary Matrix_01 sheets indicate data availability, not trait values; use Data sheets when accessible. Seven source compilations overlap existing AnimalStats sources.'})
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'report': str(OUT.relative_to(ROOT)), 'sources': [{k: v for k, v in s.items() if k in ['id', 'rows', 'species', 'traitFields', 'traitDefinitions', 'tableCount', 'totalColumnsAcrossTables']} for s in report['sources']], 'addedPlayableLabels': 0}, indent=2))
