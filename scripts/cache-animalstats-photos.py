#!/usr/bin/env python3
"""Cache licensed photo candidates; approval requires inspecting the contact sheets."""
import json,urllib.request,concurrent.futures,time
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats';ASSETS=ROOT/'public/animalstats'
photos=json.loads((OUT/'photos.json').read_text());new=[p for p in photos if p['assetUrl'].startswith('https://')]
def cache(p):
 try:
  dest=ASSETS/(p['animalId']+'.jpg')
  req=urllib.request.Request(p['assetUrl'],headers={'User-Agent':'AnimalStatsPrototype/0.1'})
  with urllib.request.urlopen(req,timeout=30) as response:raw=response.read()
  import io
  image=Image.open(io.BytesIO(raw)).convert('RGB');image.thumbnail((480,480));image.save(dest,quality=85)
  p['assetUrl']='/animalstats/'+dest.name
  return p['animalId']
 except Exception as e:return p['animalId']+' ERROR '+str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for result in pool.map(cache,new):print(result,flush=True)
(OUT/'photos.json').write_text(json.dumps(photos,indent=2,ensure_ascii=False)+'\n')
for page in range((len(new)+19)//20):
 batch=new[page*20:(page+1)*20];sheet=Image.new('RGB',(1000, len(range(0,len(batch),5))*170),'#f6f1e4');draw=ImageDraw.Draw(sheet)
 for i,p in enumerate(batch):
  path=ASSETS/(p['animalId']+'.jpg');x=(i%5)*200;y=(i//5)*170
  if path.exists():
   img=Image.open(path);img.thumbnail((190,132));sheet.paste(img,(x,y))
  draw.text((x,y+133),p['animalId'].replace('_',' ')[:28],fill='black')
 sheet.save('/tmp/animalstats-expanded-'+str(page)+'.jpg')
