#!/usr/bin/env python3
"""Archive broad catalogs for manual review; no gameplay promotion or inferred ranks."""
import collections,csv,gzip,hashlib,io,json,math,zipfile
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[1]/'data/animalstats'
S=ROOT/'source'; O=ROOT/'research'
summary={}; inventory=[]
def clean(x):
 if x is None:return None
 if isinstance(x,float) and not math.isfinite(x):return None
 if hasattr(x,'isoformat'):return x.isoformat()
 return x

def interest(field):
 f=field.lower()
 if any(k in f for k in ['derived from','allometric','_ext']):return 'exclude: modeled value; retain for provenance only'
 if any(k in f for k in ['body_mass','body mass','longevity','litter_size','litter_or_clutch','gestation','dietbreadth','diet breadth','range_area','gr_area','tail.length']):return 'high: familiar candidate; manual audit required'
 if any(k in f for k in ['latitude','longitude','reference','sequence','avibase','family','order','genus','species','source','inference','inferred']):return 'context: retain, not a prize'
 if any(k in f for k in ['tarsus','culmen','nares','kipps','forearm','svl','maturity','metrate']):return 'specialist: exclude from intuitive quota'
 return 'unrated: manual audit required'

def emit(name,rows,group,species,source,url):
 records=[];coverage=collections.Counter(); groups=collections.Counter()
 for i,r in enumerate(rows):
  r={str(k):clean(v) for k,v in r.items() if k is not None}
  aid=species(r)
  if not aid:continue
  g=group(r);groups[g]+=1
  records.append(dict(species=aid,group=g,sourceRow=i+2,measurements=r,context={},review='pending manual interest, provenance, uncertainty and comparability audit'))
  coverage.update(k for k,v in r.items() if v not in (None,''))
 body=''.join(json.dumps(r,ensure_ascii=False,allow_nan=False,sort_keys=True)+'\n' for r in records).encode()
 (O/(name+'.jsonl.gz')).write_bytes(gzip.compress(body,mtime=0))
 summary[name]=dict(records=len(records),groups=dict(groups),fieldCoverage=dict(coverage),url=url,gameApproved=0,inputs=[dict(file=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in source])
 inventory.extend(dict(catalog=name,field=f,nonMissing=n,interest=interest(f),decision='pending',reason='',unitReview='required',comparableAcrossGroups='unreviewed') for f,n in coverage.items())
 print(name,len(records),dict(groups),flush=True)

def zipped(name,member,delimiter=','):
 with zipfile.ZipFile(S/name) as z:body=z.read(member)
 try:text=body.decode('utf-8-sig')
 except UnicodeDecodeError:text=body.decode('cp1252')
 return list(csv.DictReader(io.StringIO(text),delimiter=delimiter))

emit('amphibio',zipped('amphibio-v1.zip','AmphiBIO_v1.csv'),lambda r:r['Order'],lambda r:r['Species'],[S/'amphibio-v1.zip'],'https://doi.org/10.1038/sdata.2017.123')
emit('amniote',zipped('amniote-2015.zip','Data_Files/Amniote_Database_Aug_2015.csv'),lambda r:r['class'],lambda r:(r['genus']+' '+r['species']).strip(),[S/'amniote-2015.zip'],'https://doi.org/10.1890/15-0846R.1')
emit('pantheria',zipped('pantheria-2009.zip','PanTHERIA_1-0_WR05_Aug2008.txt','\t'),lambda r:r['MSW05_Order'],lambda r:r['MSW05_Binomial'],[S/'pantheria-2009.zip'],'https://esapubs.org/archive/ecol/E090/184/metadata.htm')
w=openpyxl.load_workbook(S/'avonet-v7.xlsx',read_only=True,data_only=True)
s=w['AVONET1_BirdLife'];it=iter(s.values);headers=next(it)
emit('avonet',({k:v for k,v in zip(headers,row)} for row in it),lambda r:'Aves',lambda r:r['Species1'],[S/'avonet-v7.xlsx'],'https://figshare.com/articles/dataset/16586228')
w.close()
p=S/'Supplementary_Table_S1_-_squamBase1.xlsx'
if p.exists() and zipfile.is_zipfile(p):
 w=openpyxl.load_workbook(p,read_only=True,data_only=True);s=w.worksheets[0];it=iter(s.values);headers=next(it)
 rows=[{k:v for k,v in zip(headers,row)} for row in it]
 # Preserve all source fields; discover only the explicit species-name column.
 key=next((k for k in headers if k and str(k).lower() in ['species','species name','binomial','scientific name','species name (binomial)']),None)
 if key:emit('squambase',rows,lambda r:'Squamata',lambda r:r.get(key),[p],'https://zenodo.org/records/10602503')
 else:print('SquamBase needs header review:',headers)
 w.close()
(O/'broad-catalog-manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
with (O/'trait-review-queue.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(inventory[0]));writer.writeheader();writer.writerows(inventory)
