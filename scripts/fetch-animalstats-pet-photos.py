#!/usr/bin/env python3
"""Exact breed page images with Commons licensing; manual review before approval."""
import concurrent.futures,html,io,json,re,time,urllib.parse,urllib.request,urllib.error
from pathlib import Path
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];P=R/'data/animalstats';AS=R/'public/animalstats'
ALLOWED={'CC BY 4.0','CC BY 3.0','CC BY 2.0','CC BY-SA 4.0','CC BY-SA 3.0','CC BY-SA 2.0','CC BY-SA 2.5','CC BY 2.5','CC0','Public domain'}
def fetch(url):
 for attempt in range(4):
  try:
   time.sleep(1)
   return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AnimalStatsBreedReview/1.0'}),timeout=25).read()
  except urllib.error.HTTPError as e:
   if e.code != 429 or attempt == 3:raise
   delay=int(e.headers.get('Retry-After','12'));time.sleep(min(45,max(12,delay)))

def query(host,params):
 req=urllib.request.Request('https://'+host+'/w/api.php?'+urllib.parse.urlencode(dict(action='query',format='json',**params)),headers={'User-Agent':'AnimalStatsBreedReview/1.0'})
 return json.loads(fetch(req.full_url))['query']['pages']
def clean(s):return re.sub('<[^>]*>','',html.unescape(s)).strip()
def get(a):
 dest=AS/(a['id']+'.jpg');cache=P/'source/pets'/('photo-'+a['id']+'.json')
 if dest.exists() and cache.exists():return json.loads(cache.read_text())
 title={'Norwegian Forest':'Norwegian Forest cat','Persian':'Persian cat','Siberian':'Siberian cat','Birman':'Birman','Exotic Shorthair':'Exotic Shorthair','Burmese':'Burmese cat','Bengal':'Bengal cat','Siamese':'Siamese cat','Sphynx':'Sphynx cat','Abyssinian':'Abyssinian cat','Somali':'Somali cat','Chihuahua':'Chihuahua (dog breed)','Pomeranian':'Pomeranian dog','Maltese':'Maltese dog','Boxer':'Boxer (dog)','Whippet':'Whippet','British Shorthair':'British Shorthair','Toy Poodle':'Poodle'}.get(a['commonName'],a['commonName'])
 # Poodle main photo may depict another variety: held for manual review.
 page=next(iter(query('en.wikipedia.org',dict(titles=title,prop='pageimages',redirects=1)).values()));fn=page.get('pageimage')
 if not fn:return a['id']+' NO PAGE IMAGE'
 info=next(iter(query('commons.wikimedia.org',dict(titles='File:'+fn,prop='imageinfo',iiprop='url|extmetadata',iiurlwidth=480)).values())).get('imageinfo',[{}])[0];meta=info.get('extmetadata',{})
 field=lambda k:clean(meta.get(k,{}).get('value',''))
 lic=field('LicenseShortName');creator=field('Artist')
 if lic not in ALLOWED or not creator or not info.get('thumburl'):return a['id']+' NO PERMITTED LICENSE'
 req=urllib.request.Request(info['thumburl'],headers={'User-Agent':'AnimalStatsBreedReview/1.0'});raw=fetch(req.full_url);im=Image.open(io.BytesIO(raw)).convert('RGB');im.thumbnail((480,480));im.save(dest,quality=85)
 p=dict(animalId=a['id'],assetUrl='/animalstats/'+dest.name,originalUrl=info['descriptionurl'],creator=creator,license=lic,attribution=creator+' / Wikimedia Commons / '+lic,approved=False)
 cache.write_text(json.dumps(p,indent=2,ensure_ascii=False)+'\n');return p
if __name__=='__main__':
 data=json.loads((P/'pilot.json').read_text());animals=[a for a in data['animals'] if a.get('entityType')=='breed'];photos=json.loads((P/'photos.json').read_text());known={p['animalId']:p for p in photos}
 with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
  jobs={pool.submit(get,a):a['id'] for a in animals}
  for future in concurrent.futures.as_completed(jobs):
   try:
    r=future.result()
    if isinstance(r,dict):known.setdefault(r['animalId'],r);print(r['animalId'],r['license'],flush=True)
    else:print(r,flush=True)
   except Exception as e:print(jobs[future],str(e)[:100],flush=True)
 photos=list(known.values());(P/'photos.json').write_text(json.dumps(photos,ensure_ascii=False,indent=2)+'\n')
 sheet=Image.new('RGB',(1000,170*((len(animals)+4)//5)),'#fff7eb');draw=ImageDraw.Draw(sheet)
 for i,a in enumerate(animals):
  path=AS/(a['id']+'.jpg');x=i%5*200;y=i//5*170
  if path.exists():
   im=Image.open(path);im.thumbnail((190,130));sheet.paste(im,(x+(190-im.width)//2,y))
  draw.text((x+4,y+133),a['commonName'][:29],fill='black')
 sheet.save('/tmp/animalstats-pet-photos.jpg')
