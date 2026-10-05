"""Reconcile released MDD counts against original versioned scientific CSV."""
import csv, gzip, hashlib, json
from collections import Counter
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'
raw=gzip.decompress((P/'source/mdd/MDD_v2.5_6904species.csv.gz').read_bytes())
meta=json.loads((P/'source/mdd/release-metadata.json').read_text())
assert meta['doi']=='10.5281/zenodo.21654811'
original=next(f for f in meta['files'] if f['key']=='MDD_v2.5_6904species.csv')
assert len(raw)==original['size']
assert hashlib.md5(raw).hexdigest()==original['checksum'].split(':')[1]
rows=list(csv.DictReader(raw.decode('utf-8-sig').splitlines()))
index={r['sciName'].replace('_',' '):r for r in rows}
families=Counter(r['family'] for r in rows if r['extinct']=='0')
data=json.loads((P/'pilot.json').read_text());animals={a['id']:a for a in data['animals']}
checked=0
for v in data['values']:
 if v['sourceId']!='asm-mdd-v25-counts':continue
 r=index[animals[v['animalId']]['scientificName']]
 assert r['extinct']=='0' and r['flagged']=='0'
 trait=v['traitId'].removesuffix('__low')
 if trait=='mdd_family_species_count':
  assert r['family'] not in {'','NA'}
  expected=families[r['family']]
 elif trait=='mdd_country_count':
  assert r['domestic']=='0'
  expected=len({s.strip() for s in r['countryDistribution'].split('|') if s.strip() and '?' not in s and s.strip() not in {'NA','Domesticated'}})
 elif trait=='mdd_continent_count':
  assert r['domestic']=='0'
  expected=len({s.strip() for s in r['continentDistribution'].split('|') if s.strip() in {'Africa','Antarctica','Asia','Europe','North America','Oceania','South America'}})
 else:raise AssertionError('Unexpected MDD measurement: '+trait)
 assert v['valueNumeric']==expected,(v['animalId'],trait,expected,v['valueNumeric'])
 checked+=1
assert checked==296
print(json.dumps({'source':'ASM MDD v2.5','doi':meta['doi'],'originalCsvChecksumMatches':True,'exactObservationsChecked':checked,'livingSpecies':sum(families.values()),'errors':[]}))
