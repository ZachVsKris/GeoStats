"""Reproducible exact-breed C-BARQ import; no pooled sizes or inferred scores."""
import csv,io,json,hashlib,statistics,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]; path=root/'data/animalstats/pilot.json'; d=json.loads(path.read_text())
url='https://ndownloader.figshare.com/files/1080846'; raw=urllib.request.urlopen(url,timeout=45).read(); archive=root/'data/animalstats/source/cbarq-2013.dat';archive.write_bytes(raw)
rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig')),delimiter='\t'))
source='cbarq-owner-survey-2013'
d['sources']=[s for s in d['sources'] if s['id']!=source]+[dict(id=source,name='C-BARQ released owner questionnaire data (2013)',sourceClass='primary-research',entityScope='breed',url='https://doi.org/10.6084/m9.figshare.715896.v1',versionYear='2013 release',retrievedAt='2026-10-09',license='CC BY 4.0')]
metrics=[('trainability','Easiest to train in owner survey','Hardest to train in owner survey','trainability','Command learning, attention and retrieving'),('chasing','Most likely to chase','Least likely to chase','chasing','Reported chasing of cats, birds and other small animals'),('strangerfear','Most wary of strangers','Least wary of strangers','stranger-fear','Reported fear of unfamiliar people'),('nonsocialfear','Most easily startled','Least easily startled','startle','Reported fear of noises, traffic and unfamiliar situations or objects'),('sepprobs','Most upset when left alone','Least upset when left alone','separation','Reported separation-related behavior'),('touchsens','Most sensitive to handling','Least sensitive to handling','handling','Reported sensitivity to grooming and physical handling'),('excitability','Most excitable','Least excitable','excitability','Reported excitement in everyday situations'),('attachatten','Most attention-seeking','Least attention-seeking','attention','Reported attachment and attention-seeking behavior'),('energy','Most energetic in owner survey','Least energetic in owner survey','energy','Reported energy and activity'),('dogfear','Most wary of other dogs','Least wary of other dogs','dog-fear','Reported fear of unfamiliar dogs')]
ids={f'pet_dog_survey_{c}{suffix}' for c,*_ in metrics for suffix in ['', '__low']}
d['traits']=[t for t in d['traits'] if t['id'] not in ids];d['values']=[v for v in d['values'] if v['traitId'] not in ids];audit=[]
for col,high,low,key,meaning in metrics:
 tid='pet_dog_survey_'+col;basis=f'{meaning}: arithmetic mean of released C-BARQ 0–4 factor responses for this exact breed, with at least 50 nonmissing responses. Owner convenience sample; ages, sex and environment not standardized. Not a prediction for an individual dog.'
 for suffix,label,direction,counter in [('',high,'higher_wins',tid+'__low'),('__low',low,'lower_wins',tid)]:
  d['traits'].append(dict(id=tid+suffix,displayName=label,definition=basis,direction=direction,unit='survey score / 4',eligibilityGroups=['dog-breed'],canonicalSourceId=source,separationMethod='positive_ratio_5_percent',measurementBasis=basis,gameplayFamily='behavior',playerHint=basis,prototypeCategory=True,categoryKind='intuitive',metricKey='pet-'+key,counterTraitId=counter))
 for a in d['animals']:
  if a['taxonomicGroup']!='dog-breed' or a['id'] in ['dog_miniature_dachshund','dog_toy_poodle']:continue
  name={'dog_english_cocker_spaniel':'Cocker Spaniel (English)'}.get(a['id'],a['commonName'])
  vals=[float(r[col]) for r in rows if r['BreedID'].casefold()==name.casefold() and r.get(col,'').strip()]
  if len(vals)<50:continue
  assert all(0<=x<=4 for x in vals)
  mean=statistics.mean(vals);audit.append(dict(animalId=a['id'],sourceBreed=name,column=col,n=len(vals),mean=mean))
  for suffix in ['', '__low']:
   d['values'].append(dict(animalId=a['id'],traitId=tid+suffix,valueNumeric=mean,unit='survey score / 4',sex='source sexes not standardized',lifeStage='source ages not standardized',measurementBasis=basis,sourceId=source,observationType='compiled',confidence='approved',notes=f'Exact BreedID {name}; column {col}; n={len(vals)}; observed individual scores {min(vals)}–{max(vals)} (not uncertainty bounds for the mean). No respondent identifier released; duplicates cannot be independently checked.',recordOrigin='owner questionnaire',uncertaintyStatus='not-reported',sampleSizeCategory=str(len(vals))))
path.write_text(json.dumps(d,separators=(',',':'))+'\n')
(root/'data/animalstats/research/owner-survey-import.json').write_text(json.dumps(dict(sourceUrl=url,sha256=hashlib.sha256(raw).hexdigest(),sourceRows=len(rows),minimumResponses=50,records=audit),indent=2)+'\n')
print('Imported',len(audit)*2,'observations across',len(metrics)*2,'paired directions')
