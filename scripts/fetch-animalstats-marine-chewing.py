#!/usr/bin/env python3
"""Acquire pinned research inputs; retain facts privately and never approve them."""
import hashlib
import json
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
S = ROOT / 'data/animalstats/source'
R = ROOT / 'data/animalstats/research'
inputs = [
    ('expansion-mobs-v1.csv', 'https://raw.githubusercontent.com/crmcclain/MOBS_OPEN/main/data_all_112224.csv', '5f798243c16b840df9cfc032abeed55a6015998ee76de8754b59704913a0d94c'),
    ('expansion-mobs-references.txt', 'https://raw.githubusercontent.com/crmcclain/MOBS_OPEN/main/Size_Data_Reference_Plain.txt', '904da11d9e5ce314d5863d6a61d8221b234496e13eb69f3744b01d373eefec6b'),
    ('expansion-chewing-paper.html', 'https://oup.silverchair-cdn.com/article-minimal/867392', None),
]
manifest = []
for filename, url, expected in inputs:
    path = S / filename
    data = path.read_bytes() if path.exists() else urllib.request.urlopen(url, timeout=45).read()
    digest = hashlib.sha256(data).hexdigest()
    if expected and digest != expected:
        raise ValueError(f'{filename}: source changed; review the new version before import')
    path.write_bytes(data)
    manifest.append(dict(file=filename, url=url, bytes=len(data), sha256=digest, status='acquired'))

paper = BeautifulSoup((S / 'expansion-chewing-paper.html').read_text(), 'html.parser')
table = paper.find('table')
rows = []
for i, tr in enumerate(table.find_all('tr')[1:], 2):
    cells = tr.find_all('td')
    if len(cells) != 7:
        raise ValueError('Primary table structure changed')
    refs = [s.get_text(' ', strip=True) for s in cells[-1].find_all('sup')]
    for sup in tr.find_all('sup'):
        sup.decompose()
    values = [c.get_text(' ', strip=True) for c in cells]
    rows.append(dict(common_name=values[0], order=values[1], family=values[2],
                     genus=values[3], species=values[4], source_body_mass=values[5],
                     chewing_cycle_ms_raw=values[6], literature_reference_numbers=refs,
                     table_row=i, game_approved=False))
if len(rows) != 132:
    raise ValueError('Expected 132 primary chewing table rows')
(S / 'expansion-chewing-records.json').write_text(json.dumps(rows, indent=2) + '\n')
(R / 'expansion-marine-acquisition.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(dict(acquired_inputs=len(inputs), chewing_table_rows=len(rows), new_playable_approvals=0)))
