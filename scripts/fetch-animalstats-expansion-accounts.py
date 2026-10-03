"""Acquire additional familiar mammals; source prose stays private."""
import concurrent.futures,datetime,hashlib,json,urllib.request
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1];S=ROOT/'data/animalstats/source';R=ROOT/'data/animalstats/research'
names='''Orycteropus afer;Tachyglossus aculeatus;Ornithorhynchus anatinus;Vombatus ursinus;Sarcophilus harrisii;Phascolarctos cinereus;Pongo pygmaeus;Gorilla gorilla;Pan troglodytes;Mandrillus sphinx;Lemur catta;Ailuropoda melanoleuca;Ursus americanus;Ursus maritimus;Bison bison;Ovibos moschatus;Rangifer tarandus;Saiga tatarica;Okapia johnstoni;Tapirus terrestris;Hydrochoerus hydrochaeris;Castor canadensis;Mellivora capensis;Manis javanica'''.split(';')
def fetch(name):
 url='https://animaldiversity.org/accounts/'+name.replace(' ','_')+'/'
 result=dict(animalId=name.replace(' ','_'),url=url,retrievedAt=datetime.date.today().isoformat())
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'AnimalStats research source audit'})
  raw=urllib.request.urlopen(req,timeout=20).read();soup=BeautifulSoup(raw,'html.parser');sections={}
  for key in ['physical_description','habitat','reproduction','lifespan_longevity','behavior']:
   heading=soup.find(id=key);section=heading.find_parent('section') if heading else None
   if not section:continue
   items={}
   for dt in section.find_all('dt'):
    dd=dt.find_next_sibling('dd')
    if dd:items[dt.get_text(' ',strip=True)]=dd.get_text(' ',strip=True)
   sections[key]={'items':items}
  result.update(sha256=hashlib.sha256(raw).hexdigest(),sections=sections,reference_count=len(soup.select('#references li')))
 except Exception as e:result['error']=str(e)
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(fetch,names))
(S/'expansion-adw-accounts.json').write_text(json.dumps(rows,indent=2)+'\n')
(R/'expansion-account-acquisition.json').write_text(json.dumps([dict((k,v) for k,v in r.items() if k!='sections')|{'structured_fact_count':sum(len(s['items']) for s in r.get('sections',{}).values())} for r in rows],indent=2)+'\n')
print(json.dumps({'attempted':len(rows),'acquired':sum(bool(r.get('sections')) for r in rows),'failures':sum('error' in r for r in rows)}))
