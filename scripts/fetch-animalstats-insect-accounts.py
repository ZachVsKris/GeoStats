#!/usr/bin/env python3
"""Targeted insect source snapshots for manual review; no automatic game values."""
import concurrent.futures,json,urllib.request,hashlib
from pathlib import Path
from bs4 import BeautifulSoup
P=Path(__file__).resolve().parents[1]/'data/animalstats'
NAMES={'Apis mellifera':'Western honey bee','Bombus terrestris':'Buff-tailed bumblebee','Danaus plexippus':'Monarch butterfly','Vanessa cardui':'Painted lady','Papilio machaon':'Old World swallowtail','Mantis religiosa':'European mantis','Gryllus bimaculatus':'Two-spotted cricket','Acheta domesticus':'House cricket','Locusta migratoria':'Migratory locust','Schistocerca gregaria':'Desert locust','Coccinella septempunctata':'Seven-spotted ladybug','Dynastes hercules':'Hercules beetle','Tenebrio molitor':'Mealworm beetle','Gromphadorhina portentosa':'Madagascar hissing cockroach','Atta cephalotes':'Leafcutter ant','Solenopsis invicta':'Red imported fire ant','Lasius niger':'Black garden ant','Anax imperator':'Emperor dragonfly','Calopteryx splendens':'Banded demoiselle','Orthetrum cancellatum':'Black-tailed skimmer'}
def fetch(item):
 name,common=item;url='https://animaldiversity.org/accounts/'+name.replace(' ','_')+'/'
 result=dict(scientificName=name,commonName=common,url=url,retrievedAt='2026-10-02',approval='pending')
 try:
  with urllib.request.urlopen(url,timeout=15) as response:html=response.read()
  soup=BeautifulSoup(html,'html.parser');sections={}
  for id in ['physical_description','reproduction','lifespan_longevity','behavior','food_habits','geographic_range']:
   heading=soup.find(id=id);section=heading.find_parent('section') if heading else None
   if section:
    values={}
    for dt in section.find_all('dt'):
     dd=dt.find_next_sibling('dd')
     if dd:values[dt.get_text(' ',strip=True)]=dd.get_text(' ',strip=True)
    sections[id]=dict(items=values,text=section.get_text(' ',strip=True))
  result.update(sections=sections,htmlSHA256=hashlib.sha256(html).hexdigest())
 except Exception as e:result['error']=str(e)
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:rows=list(pool.map(fetch,NAMES.items()))
(P/'source/adw-insect-accounts.json').write_text(json.dumps(rows,indent=2)+'\n')
summary=[dict(scientificName=r['scientificName'],commonName=r['commonName'],url=r['url'],retrievedAt=r['retrievedAt'],error=r.get('error'),htmlSHA256=r.get('htmlSHA256'),fields={k:list(v['items']) for k,v in r.get('sections',{}).items()},approval='pending') for r in rows]
(P/'research/insect-account-coverage.json').write_text(json.dumps(summary,indent=2)+'\n')
print('Insect accounts',len(rows),'successful',sum(bool(r.get('sections')) for r in rows))
