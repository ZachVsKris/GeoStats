"""Read-only search of the bulk research database. No results are game-approved."""
import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source')
parser.add_argument('--field', default='mass', help='Field-name substring, or exact field with --animal')
parser.add_argument('--animal', help='Exact common name, scientific name or AnimalStats ID')
parser.add_argument('--limit', type=int, default=20)
args = parser.parse_args()
if not 1 <= args.limit <= 100:
    parser.error('--limit must be between 1 and 100')
path = ROOT / 'data/animalstats/research/bulk-research.sqlite'
con = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
con.row_factory = sqlite3.Row
if args.animal:
    animal = next((a for a in json.loads((ROOT / 'data/animalstats/pilot.json').read_text())['animals']
                   if args.animal.casefold() in {a['id'].casefold(), a['commonName'].casefold(), a['scientificName'].casefold()}), None)
    name = animal['scientificName'] if animal else args.animal
    field_path = '$.' + json.dumps(args.field)
    rows = con.execute('''SELECT source_id,table_name,source_row,scientific_name,
        json_extract(data_json,?) AS source_value,provenance_json,review_status
        FROM records WHERE scientific_name=? COLLATE NOCASE AND json_type(data_json,?) IS NOT NULL
        AND (? IS NULL OR source_id=?) ORDER BY source_id,table_name,source_row LIMIT ?''',
        (field_path, name, field_path, args.source, args.source, args.limit))
else:
    rows = con.execute('''SELECT * FROM fields WHERE name LIKE ?
        AND (? IS NULL OR source_id=?) ORDER BY roster_count DESC,numeric_rows DESC LIMIT ?''',
        ('%' + args.field + '%', args.source, args.source, args.limit))
print(json.dumps({'status': 'research-only', 'results': [dict(row) for row in rows]}, indent=2, ensure_ascii=False))
con.close()
