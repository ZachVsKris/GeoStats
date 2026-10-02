#!/usr/bin/env python3
"""Inventory preserved raw tables without turning study records into game facts."""
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import zipfile
import openpyxl
from lxml import html

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/animalstats/source'
OUT = ROOT / 'data/animalstats/research'

def read_csv(path):
    data = path.read_bytes()
    for encoding in ('utf-8-sig', 'cp1252', 'latin1'):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    # Preserve endpoint names and missing values; no biological imputation.
    return list(csv.DictReader(text.splitlines())), encoding

def main():
    inputs = []
    checks = {}
    # Preserve cells, including blank cells, footnotes and taxonomic headings.
    # Do not coerce this extraction into species-level numerical observations.
    review = SOURCE / 'torpor-review.html'
    if review.exists():
        table = html.fromstring(review.read_bytes()).xpath('//table')[0]
        with (SOURCE / 'torpor-direct-table.csv').open('w', newline='') as f:
            writer = csv.writer(f)
            for row in table.xpath('.//tr'):
                writer.writerow([' '.join(c.text_content().split()) for c in row.xpath('./td|./th')])
        checks['torpor-direct-table.csv'] = dict(raw_table_rows=len(table.xpath('.//tr')),
            gate='Numerical maximum torpor bout duration in hours exists in the paper table. Taxonomic headings, footnotes and row alignment must be audited; not whole-season hibernation.')
    patterns = ['cognition-*.csv', 'diving-comparative.csv', 'olfaction-*.xlsx',
                'torpor-*.xlsx', 'torpor-direct-table.csv', 'sound-*.csv', 'horns-*.csv', 'healing-*.csv',
                'mammal-food-types-*.csv', 'development-*.csv', 'growth-*.csv',
                'bird-diving-*.txt', 'bird-diving-*.csv', 'tail-regrowth-*.csv']
    files = sorted({f for pattern in patterns for f in SOURCE.glob(pattern)})
    with gzip.open(OUT / 'behavior-research-records.jsonl.gz', 'wt', encoding='utf-8') as target:
        for path in files:
            data = path.read_bytes()
            entry = dict(file=path.name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            if path.suffix == '.csv':
                rows, encoding = read_csv(path)
                entry.update(rows=len(rows), encoding=encoding, fields=list(rows[0]) if rows else [])
                for i, row in enumerate(rows):
                    target.write(json.dumps(dict(source_file=path.name, source_row=i+2, raw=row, game_approved=False)) + '\n')
                if path.name.startswith('cognition-'):
                    checks[path.name] = dict(records=len(rows), species_labels=len({r.get('Species') for r in rows}),
                                            gate='Shared test only. Subject-level repeats, population and sex retained. Accuracy is not general intelligence.')
                elif path.name == 'diving-comparative.csv':
                    useful = [r for r in rows if r.get('Species', '').strip()]
                    maxima = [r for r in useful if r.get('Maximum.dive.duration..min.', '').strip() not in ('', 'NA')]
                    checks[path.name] = dict(records=len(rows), nonblank_species_records=len(useful),
                        unique_species_labels=len({r['Species'] for r in useful}), max_duration_records=len(maxima),
                        gate='Study-reported observations, not universal physiological limits. Primary references and conditions retained. Blank rows excluded from species counts.')
            elif path.suffix == '.xlsx':
                workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
                sheets = []
                for sheet in workbook:
                    nonempty = [(i, list(row)) for i, row in enumerate(sheet.values, 1) if any(v is not None for v in row)]
                    sheets.append(dict(name=sheet.title, nonempty_rows=len(nonempty), columns=sheet.max_column))
                    for i, row in nonempty:
                        target.write(json.dumps(dict(source_file=path.name, sheet=sheet.title, source_row=i,
                                                     raw_cells=row, game_approved=False), default=str) + '\n')
                entry['sheets'] = sheets
                if path.name.startswith('torpor-'):
                    checks[path.name] = dict(gate='MaxTorporLength contains phenotype classes rather than numerical durations. Context only; reject duration ranking from this field.')
            else:
                entry['status'] = 'downloaded_requires_delimiter_review'
            inputs.append(entry)
    report = dict(date='2026-10-02', inputs=inputs, endpoint_checks=checks,
                  game_approved=0, caution='Rows, subjects, sheets and species labels are not newly playable categories. Raw source structure preserved; no automatic species aggregation.')
    (OUT / 'behavior-source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(dict(files=len(inputs), endpoint_checks=checks), indent=2))

if __name__ == '__main__':
    main()
