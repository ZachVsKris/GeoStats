#!/usr/bin/env python3
import csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
master=ROOT/'V16_2_6_MASTER_TRACKER.csv'; release=ROOT/'V16_2_6_RELEASE_TRACKER.csv'
with master.open(newline='',encoding='utf-8') as f: rows=list(csv.DictReader(f))
assert len(rows)==533, len(rows)
assert len(rows[0])==47, len(rows[0])
assert len({r['tracker_id'] for r in rows})==533
assert all(str(v).strip() for r in rows for v in r.values())
assert not any('pending' in r['final_disposition'].lower() for r in rows)
by_title={r['category_title']:r for r in rows}
expected={
 'Lowest population density':('UN World Population Prospects 2024','WPP2024:population-density:2023'),
 'Highest male share of population':('UN World Population Prospects 2024','WPP2024:male-share:2023'),
 'Highest female share of population':('UN World Population Prospects 2024','WPP2024:female-share:2023'),
 'Most men per 100 women':('UN World Population Prospects 2024','WPP2024:sex-ratio:2023'),
 'Most women per 100 men':('UN World Population Prospects 2024','WPP2024:sex-ratio:2023'),
 'Lowest median age':('UN World Population Prospects 2024','WPP2024:median-age:2023'),
 'Highest median age':('UN World Population Prospects 2024','WPP2024:median-age:2023'),
 'Fastest population decline':('UN World Population Prospects 2024','WPP2024:population-growth:2023'),
 'Lowest fertility rate':('UN World Population Prospects 2024','WPP2024:fertility:2023'),
 'Highest life expectancy':('UN World Population Prospects 2024','WPP2024:life-expectancy:2023'),
 'Oldest current constitution':('Constitute Project / Comparative Constitutions Project','history:oldest-current-constitution'),
 "Earliest universal women's suffrage":('Inter-Parliamentary Union Parline','history:ipu-universal-womens-suffrage'),
 'Most neighboring countries':('Natural Earth 1:10m country geometry','most-land-neighbors'),
 'Longest total coastline':('Natural Earth 1:10m country geometry','longest-coastline'),
}
for title,(source,indicator) in expected.items():
    r=by_title[title]
    assert r['source_candidate']==source,(title,r['source_candidate'])
    assert r['source_indicator']==indicator,(title,r['source_indicator'])
    assert r['final_disposition'] in {'ready_for_validated_import','ready_when_official_bulk_input_validates','already_covered_existing_playable'}
# Failed old paths stay fail-closed unless a new administrative path exists.
for title in ['Lowest unemployment','Largest STEM graduate share','Highest vocational enrollment share']:
    matches=[r for r in rows if r['category_title']==title]
    if matches:
        assert all('not_shipped' in r['final_disposition'] or 'blocked' in r['final_disposition'] for r in matches),title
with release.open(newline='',encoding='utf-8') as f: rel=list(csv.DictReader(f))
assert len(rel)==32, len(rel)
assert all(r['status'].strip() and r['status']!='pending' and r['evidence'].strip() for r in rel)
print('v16.2.6 master/release tracker reconciliation checks passed.')
