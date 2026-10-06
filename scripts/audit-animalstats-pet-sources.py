#!/usr/bin/env python3
"""Reconcile imported breed facts against pinned primary tables and the reviewed cell ledger."""
import csv,gzip,hashlib,json,zipfile,xml.etree.ElementTree as E
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats';S=P/'source/pets'
d=json.loads((P/'pilot.json').read_text());cells=json.loads((S/'reviewed-source-cells.json').read_text());rows=list(csv.DictReader((S/'reviewed-observations.csv').open()));audit=json.loads((S/'release-review.json').read_text());V={(v['animalId'],v['traitId']):v for v in d['values']};T={t['id']:t for t in d['traits']};A={a['id']:a for a in d['animals']};sources={s['id']:s for s in d['sources']}
assert len(rows)==len(cells)==162
raw=gzip.decompress((S/'vetcompass-2019.xml.gz').read_bytes());assert hashlib.sha256(raw).hexdigest()==audit['primaryRawHashes']['dogdemography.pdf'];root=E.fromstring(raw)
table=root.find(".//table-wrap[@id='pone.0288081.t001']");original={''.join(r[0].itertext()):[''.join(c.itertext()) for c in r] for r in table.findall('.//tr')[1:]}
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};raw=(S/'mcmillan-2024-table-s3.docx').read_bytes();assert hashlib.sha256(raw).hexdigest()==audit['primaryRawHashes']['mcmillan-2024-table-s3.docx'];root=E.fromstring(zipfile.ZipFile(S/'mcmillan-2024-table-s3.docx').read('word/document.xml'));survival={''.join(r.findall('w:tc',ns)[0].itertext()):[''.join(c.itertext()) for c in r.findall('w:tc',ns)] for r in root.find('.//w:tbl',ns).findall('w:tr',ns)[1:]}
primary=0
for r,c in zip(rows,cells):
 assert {k:r[k] for k in ['animalId','metric','value','n','min','max']}=={k:c[k] for k in ['animalId','metric','value','n','min','max']}
 assert r['sourceLocator']==c['locator'];a=A[r['animalId']];assert a['entityType']=='breed' and a['parentTaxon']==a['scientificName'] and a['breedName']==a['commonName']
 if r['metric'] in ['pet_dog_adult_mass','pet_dog_popularity']:
  name=r['sourceLocator'].split('; ')[1];row=original[name];expected=float(row[4]) if r['metric']=='pet_dog_adult_mass' else int(row[1].replace(',',''));assert float(r['value'])==expected
  if r['metric']=='pet_dog_adult_mass':assert r['n']=='' # Total membership is not endpoint N.
  else:assert int(r['n'])==expected
  primary+=1
 elif r['metric']=='pet_dog_survival':
  name=r['sourceLocator'].split('; ')[1];row=survival[name];assert [r[k] for k in ['n','value','min','max']]==[row[i] for i in [2,3,4,5]];assert int(r['n'])>=5;primary+=1
 for suffix in ['', '__low']:
  v=V[(r['animalId'],r['metric']+suffix)];t=T[v['traitId']];assert float(r['value'])==v['valueNumeric'];assert v['sourceId']==t['canonicalSourceId'];assert sources[v['sourceId']]['entityScope']=='breed';assert v['observationType']=='observed' and v['confidence']=='approved'
  if r['min']:assert float(r['min'])==v['valueMin'] and float(r['max'])==v['valueMax']
  else:assert 'valueMin' not in v and 'valueMax' not in v
  assert v['notes']==r['notes'] and v['recordOrigin']==r['sourceLocator']
# No biological observations from a species database may bleed into a breed.
for v in d['values']:
 if A[v['animalId']].get('entityType')=='breed':assert sources[v['sourceId']].get('entityScope')=='breed'
print(json.dumps({'reviewedBreedRecords':len(rows),'releasedDirections':len(rows)*2,'directlyReconciledPrimaryRawRows':primary,'reviewedTranscribedTableRows':len(rows)-primary,'unknownWeightEndpointNPreserved':True,'speciesInheritancePrevented':True,'confidenceIntervalsPreserved':True}))
