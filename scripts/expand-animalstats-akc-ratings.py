import json,re,html,urllib.request,hashlib,concurrent.futures
from pathlib import Path
root=Path(__file__).resolve().parents[1];path=root/'data/animalstats/pilot.json';d=json.loads(path.read_text());source='akc-breed-ratings-20261009';folder=root/'data/animalstats/source/akc-20261009';folder.mkdir(exist_ok=True)
animals=[a for a in d['animals'] if a['taxonomicGroup']=='dog-breed' and a['id'] not in ['dog_miniature_dachshund','dog_toy_poodle']]
def fetch(a):
 cached=folder/(a['id']+'.json')
 if cached.exists():return json.loads(cached.read_text())
 slug=a['commonName'].lower().replace(' ','-');slug={'german-shepherd':'german-shepherd-dog'}.get(slug,slug);url='https://www.akc.org/dog-breeds/'+slug+'/'
 try:
  raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read();m=re.search(r'data-js-component="breedPage" data-js-props="([^"]+)"',raw.decode());p=json.loads(html.unescape(m.group(1)));settings=p['settings'];breed=settings['current_breed'];b=settings['breed_data'];traits=b['traits'][breed]['traits'];basics=b['basics'][breed]
  out=dict(animalId=a['id'],sourceUrl=url,sourceBreed=breed,sha256=hashlib.sha256(raw).hexdigest(),traits={k:{'score':v.get('score')} for k,v in traits.items()},basics={k:basics.get(k) for k in ['breed_name','year_recognized']});(folder/(a['id']+'.json')).write_text(json.dumps(out)+'\n');return out
 except Exception as e:return dict(animalId=a['id'],error=str(e))
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(fetch,animals));print([(r['animalId'],r.get('error')) for r in results if 'error'in r])
(folder/'fetch-audit.json').write_text(json.dumps(results,indent=2)+'\n')
metrics=[('barking_level','Most vocal','Quietest','barking','Tendency to bark or howl, not sound loudness'),('coat_grooming_frequency','Most grooming needed','Least grooming needed','grooming','Frequency of professional or owner coat grooming'),('shedding_level','Most shedding','Least shedding','shedding','Amount and frequency of coat shedding'),('openness_to_strangers','Most welcoming to strangers','Least welcoming to strangers','stranger-welcome','Tendency to welcome unfamiliar people'),('watchdogprotective_nature','Most watchful','Least watchful','watchfulness','Tendency to alert to potential threats; not aggression or bite strength'),('drooling_level','Most drooling','Least drooling','drooling','Tendency to drool')]
d['sources']=[s for s in d['sources'] if s['id']!=source]+[dict(id=source,name='American Kennel Club official breed ratings',sourceClass='institutional-account',entityScope='breed',url='https://www.akc.org/dog-breeds/',versionYear='Official pages retrieved 2026-10-09',retrievedAt='2026-10-09',license='Factual ratings attributed to AKC; no descriptive text republished')]
d['traits']=[t for t in d['traits'] if not t['id'].startswith('pet_dog_akc_')];d['values']=[v for v in d['values'] if not v['traitId'].startswith('pet_dog_akc_')];audit=[]
for col,high,low,key,meaning in metrics:
 tid='pet_dog_akc_'+col;basis=f'{meaning}. AKC expert breed rating on a 1–5 ordinal scale, not a measured quantity or owner-survey average. Individual dogs vary. Equal ratings remain tied.'
 for suffix,label,direction,counter in [('',high,'higher_wins',tid+'__low'),('__low',low,'lower_wins',tid)]:d['traits'].append(dict(id=tid+suffix,displayName=label,definition=basis,direction=direction,unit='AKC rating / 5',eligibilityGroups=['dog-breed'],canonicalSourceId=source,separationMethod='distinct_ordinal',measurementBasis=basis,gameplayFamily='behavior',playerHint=basis,prototypeCategory=True,categoryKind='intuitive',metricKey='pet-'+key,counterTraitId=counter))
 for r in results:
  if 'error' in r:continue
  score=r['traits'].get(col,{}).get('score')
  if not isinstance(score,int) or not 1<=score<=5:continue
  audit.append(dict(animalId=r['animalId'],column=col,score=score,sourceUrl=r['sourceUrl'],pageSha256=r['sha256']))
  for suffix in ['', '__low']:d['values'].append(dict(animalId=r['animalId'],traitId=tid+suffix,valueNumeric=score,unit='AKC rating / 5',sex='breed-level',lifeStage='breed-level',measurementBasis=basis,sourceId=source,observationType='compiled',confidence='approved',notes=f"Official page {r['sourceUrl']}; structured rating {col}; page SHA256 {r['sha256']}. Expert rating, not a population measurement.",recordOrigin='official breed profile',uncertaintyStatus='not-reported',sampleSizeCategory='not-applicable'))
tid='pet_dog_akc_recognition_age';basis='Years from the official AKC recognition year to 2026. Registry recognition history, not the evolutionary age or origin date of a breed.'
for suffix,label,direction,counter in [('', 'Longest recognized by AKC','higher_wins',tid+'__low'),('__low','Most recently recognized by AKC','lower_wins',tid)]:d['traits'].append(dict(id=tid+suffix,displayName=label,definition=basis,direction=direction,unit='years',eligibilityGroups=['dog-breed'],canonicalSourceId=source,separationMethod='positive_ratio_5_percent',measurementBasis=basis,gameplayFamily='history',playerHint=basis,prototypeCategory=True,categoryKind='specialist',metricKey='pet-recognition',counterTraitId=counter))
for r in results:
 if 'error'in r:continue
 year=str(r['basics'].get('year_recognized',''))
 if not year.isdigit() or not 1800<int(year)<2026:continue
 for suffix in ['', '__low']:d['values'].append(dict(animalId=r['animalId'],traitId=tid+suffix,valueNumeric=2026-int(year),unit='years',sex='breed-level',lifeStage='breed-level',measurementBasis=basis,sourceId=source,observationType='compiled',confidence='approved',notes=f"Recognition year {year}; official page {r['sourceUrl']}; SHA256 {r['sha256']}",recordOrigin='registry history',uncertaintyStatus='not-reported',sampleSizeCategory='not-applicable'))
path.write_text(json.dumps(d,separators=(',',':'))+'\n');(root/'data/animalstats/research/akc-rating-import.json').write_text(json.dumps(audit,indent=2)+'\n');print('Imported AKC directions',len(metrics)*2+2,'from',len([r for r in results if 'error'not in r]),'exact breed pages')
