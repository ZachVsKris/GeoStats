#!/usr/bin/env python3
"""Collect exact-species, freely licensed portrait candidates; never auto-approve."""
import argparse,concurrent.futures,json,pathlib,requests
R=pathlib.Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--dataset',required=True);p.add_argument('--limit',type=int,default=100);a=p.parse_args();d=json.loads((R/a.dataset).read_text());out=R/'data/animalstats/research/inaturalist-portrait-candidates.json';existing=json.loads(out.read_text()) if out.exists() else [];known={p['animalId'] for p in existing};allowed={'cc0':'CC0','cc-by':'CC BY','cc-by-sa':'CC BY-SA'}
def fetch(animal):
 response=requests.get('https://api.inaturalist.org/v1/taxa',params={'q':animal['scientificName'],'rank':'species','per_page':10},headers={'User-Agent':'AnimalStats/1.0 (licensed portrait review)'},timeout=40);response.raise_for_status()
 taxa=[t for t in response.json()['results'] if t['name']==animal['scientificName'] and t.get('is_active') and not t.get('extinct')]
 if len(taxa)!=1:return None
 t=taxa[0];photo=t.get('default_photo') or {};license=allowed.get(photo.get('license_code'))
 if not license or photo.get('flags') or not photo.get('medium_url') or not photo.get('attribution_name'):return None
 response=requests.get(photo['medium_url'],timeout=40);response.raise_for_status();target=R/'public/animalstats'/f"{animal['id']}.jpg";target.write_bytes(response.content)
 return {'animalId':animal['id'],'assetUrl':'/animalstats/'+target.name,'originalUrl':'https://www.inaturalist.org/photos/'+str(photo['id']),'creator':photo['attribution_name'],'license':license,'attribution':photo['attribution'],'approved':False,'reviewScientificName':animal['scientificName'],'reviewTaxonId':t['id'],'reviewPhotoId':photo['id'],'reviewSourceUrl':photo['medium_url']}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 pending=[x for x in d['animals'] if x['id'] not in known][:a.limit]
 jobs={pool.submit(fetch,x):x for x in pending}
 for f in concurrent.futures.as_completed(jobs):
  try:
   photo=f.result()
   if photo:existing.append(photo);out.write_text(json.dumps(existing,indent=2)+'\n');print(photo['animalId'],flush=True)
  except Exception as e:print(jobs[f]['id'],str(e)[:100],flush=True)
