#!/usr/bin/env python3
"""Download complete new source tables; never execute source code or approve game data."""
import csv, io, json, hashlib, pathlib, urllib.request, urllib.parse, concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'data/animalstats/source/deep-bulk-20261010'
REPORT=ROOT/'data/animalstats/research/deep-bulk-intake-20261010.json'
OUT.mkdir(parents=True,exist_ok=True)
def get(url): return urllib.request.urlopen(url,timeout=60).read()
def task(source,name,url):
 path=OUT/source/name;path.parent.mkdir(parents=True,exist_ok=True)
 try:
  b=path.read_bytes() if path.exists() else get(url)
  path.write_bytes(b)
  item={'source':source,'name':name,'url':url,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'status':'pending-review','approved_game_values':0}
  if name.endswith('.csv'):
   try:s=b.decode('utf-8-sig');encoding='utf-8-sig'
   except UnicodeDecodeError:s=b.decode('latin1');encoding='byte-preserving-latin1-unverified'
   dialect=csv.Sniffer().sniff(s[:10000],delimiters=',;\t');rows=list(csv.reader(io.StringIO(s),dialect));item.update(rows=len(rows)-1,columns=rows[0],encoding=encoding)
  elif name.endswith('.xlsx'):
   import openpyxl
   wb=openpyxl.load_workbook(io.BytesIO(b),read_only=True,data_only=True);item['sheets']=[{'name':w.title,'rows':w.max_row,'columns':w.max_column} for w in wb];wb.close()
  return item
 except Exception as e:return {'source':source,'name':name,'url':url,'error':str(e),'approved_game_values':0}
def main():
 jobs=[];meta=[]
 for source,id in [('eurobat',21777161),('afrobat-preimputation',23587260),('repttraits',24572683)]:
  j=json.loads(get(f'https://api.figshare.com/v2/articles/{id}'));(OUT/f'{source}-metadata.json').write_text(json.dumps(j,indent=2));meta.append({'source':source,'id':id,'license':j.get('license'),'doi':j.get('doi'),'version':j.get('version')})
  files=j['files']
  if source=='repttraits':files=[f for f in files if 'v1-2' in f['name']]
  jobs.extend((source,f['name'],f['download_url']) for f in files if f['size']<100_000_000)
 jobs.append(('carnitraits','CarniTraitsv1.5.3.csv','https://raw.githubusercontent.com/Eamonn-wooster/CarniTraits/main/CarniTraits_data/CarniTraitsv1.5.3.csv'))
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:items=list(pool.map(lambda args:task(*args),jobs))
 # Public read-only export POST: all traits, original column format, not fuzzy scores.
 try:
  u='https://www.blackseatraits.com/traitspublic_exportListProcessing.php';req=urllib.request.Request(u,data=urllib.parse.urlencode({'flag':1,'exportFormat':'csv'}).encode());b=urllib.request.urlopen(req,timeout=60).read();(OUT/'blacksea-export-response').write_bytes(b)
  items.append({'source':'blacksea','url':u,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'content_prefix':b[:200].decode(errors='replace'),'status':'export-response-needs-verification','approved_game_values':0})
 except Exception as e:items.append({'source':'blacksea','error':str(e)})
 REPORT.write_text(json.dumps({'date':'2026-10-10','metadata':meta,'files':items,'quality_rule':'No inferred, imputed, fuzzy-coded, modeled or context-incompatible values admitted. Counts are source records, not playable categories.'},indent=2))
 print(json.dumps({'files':len(items),'errors':[x for x in items if 'error' in x],'sources':meta,'report':str(REPORT)},indent=2))
if __name__=='__main__':main()
