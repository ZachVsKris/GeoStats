"""Public dataset acquisition for additional intuitive comparisons."""
import concurrent.futures,hashlib,json,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats/source';R=ROOT/'data/animalstats/research'
def fetch(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AnimalStats source research'}),timeout=25).read()
def record(task):
 key,id=task;result={'source':key,'record':id,'url':f'https://zenodo.org/records/{id}','files':[]}
 try:
  b=fetch(f'https://zenodo.org/api/records/{id}');(P/f'discovery-{key}-metadata.json').write_bytes(b);d=json.loads(b)
  result['title']=d['metadata']['title'];result['access']=d.get('access_right',d['metadata'].get('access_right'))
  if result['access']!='open':result['status']='not_open';return result
  for f in d.get('files',[]):
   if f['size']>5_000_000:continue
   if not f['key'].lower().endswith(('.csv','.xlsx','.xls','.txt','.zip','.docx')):continue
   name='discovery-'+key+'-'+f['key'].replace('/','_');url=f['links']['self']
   try:
    b=fetch(url);(P/name).write_bytes(b);result['files'].append({'name':name,'url':url,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'repository_checksum':f.get('checksum')})
   except Exception as e:result['files'].append({'name':name,'error':str(e)})
  result['status']='acquired' if any('sha256' in x for x in result['files']) else 'metadata_only'
 except Exception as e:result['status']='failed';result['error']=str(e)
 return result
tasks=[('spider-venom',12028509),('gecko-grip',4951666),('whiskers',4942927),('bird-vocabulary',5016383),('primate-vocabulary',20616324),('mammal-parenting',4935027),('field-energy',16894769)]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:results=list(ex.map(record,tasks))
(R/'discovery-source-downloads.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results:print(r['source'],r['status'],[(x['name'],x.get('bytes',x.get('error'))) for x in r['files']])
