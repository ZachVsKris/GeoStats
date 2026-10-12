import pathlib,json,csv,openpyxl,collections,re,requests,concurrent.futures,zipfile,io,argparse
args=argparse.ArgumentParser();args.add_argument('--source-root',type=pathlib.Path,required=True);opts=args.parse_args();R=pathlib.Path(__file__).resolve().parents[1];P=opts.source_root;S=R/'data/animalstats/source/underrepresented-20261010b';S.mkdir(exist_ok=True)
rows=[]
for f in (P/'arthropod-raw').glob('*.xlsx'):
 if 'Lepidoptera' in f.name:continue
 w=openpyxl.load_workbook(f,read_only=True,data_only=True);it=iter(w.active.values);h=next(it)
 for i,row in enumerate(it,2):
  r=dict(zip(h,row));v=r.get('Size_max')
  if r.get('Class')!='Insecta' or not isinstance(v,(int,float)) or not v>0:continue
  if re.search(r'SCALETOOL|expert|pers|Verheyde|Pollet',str(r['Source']),re.I):continue
  rows.append({'name':r['Species'].replace('_',' '),'value':v,'source':r['Source'],'file':f.name,'row':i})
by=collections.defaultdict(list)
for r in rows:by[r['name']].append(r)
taxa={ ' '.join(r['scientificName'].split()[:2]):r for r in csv.DictReader(open(P/'arthropod-dwca/taxon.txt'),delimiter='\t') }
eggs=collections.defaultdict(list)
for r in csv.DictReader(open(P/'egg_database.tsv'),delimiter='\t'):
 if r['problem'] not in ['','NA']:continue
 try:l=float(r['pl']);w=float(r['pw'])
 except ValueError:continue
 if not (l>0 and w>0 and r['bib_title'] and r['g'] and r['s']):continue
 name=r['g']+' '+r['s']
 if r['tax_matched'] and r['tax_matched']!=name:continue
 eggs[name].append({k:r[k] for k in ['ID','pl','pw','bib_author','bib_year','bib_title','bib_journal','bib_pages','b','g','s']})
names=sorted(set(by)&set(taxa)&set(eggs));print('Exact insect body/point-egg/taxonomy intersection',len(names),flush=True)
cache=S/'insect-taxa.json';known=json.loads(cache.read_text()) if cache.exists() else {}
def get(name):
 if name in known:return name,known[name]
 r=requests.get('https://api.inaturalist.org/v1/taxa',params={'q':name,'rank':'species','per_page':10},timeout=30);r.raise_for_status();matches=[x for x in r.json()['results'] if x['name']==name and x.get('is_active') and not x.get('extinct')]
 return name,matches[0] if len(matches)==1 else None
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 futures={ex.submit(get,n):n for n in names}
 for f in concurrent.futures.as_completed(futures):
  try:n,x=f.result();known[n]=x
  except Exception as e:print(futures[f],str(e)[:90],flush=True)
  cache.write_text(json.dumps(known,ensure_ascii=False)+'\n')
selected=[]
for name in names:
 t=known.get(name)
 if not t or not t.get('preferred_common_name'):continue
 selected.append({'name':name,'commonName':t['preferred_common_name'],'body':max(by[name],key=lambda r:r['value']),'eggs':max(eggs[name],key=lambda r:float(r['pl'])),'taxonomy':taxa[name]})
(S/'insect-source-cells.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2)+'\n');print('Common-named exact insects',len(selected),[x['commonName'] for x in selected],flush=True)
