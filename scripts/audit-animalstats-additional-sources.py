"""Inventory acquired tables without guessing values or approving game rankings."""
import csv, gzip, hashlib, io, json, pathlib, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/animalstats/source'; OUT=ROOT/'data/animalstats/research'
def decode(b):
 for enc in ('utf-8-sig','cp1252','latin1'):
  try:return b.decode(enc),enc
  except UnicodeDecodeError:pass
def table(name,b,delimiter,taxon,source,gate):
 text,encoding=decode(b);rows=list(csv.DictReader(io.StringIO(text),delimiter=delimiter));fields=list(rows[0]) if rows else []
 result={'id':name,'sha256':hashlib.sha256(b).hexdigest(),'encoding':encoding,'rows':len(rows),'distinct_source_taxon_labels':len({r.get(taxon) for r in rows if r.get(taxon)}),'taxon_field':taxon,'fields':fields,'populated_cells':{f:sum(r.get(f,'').strip() not in ('','NA','NaN','no info') for r in rows) for f in fields},'source_url':source,'audit_gate':gate,'game_approved':False}
 return result,rows
spec=[
 ('nest-Dataset-S1.csv',',','Species scientific name','https://github.com/catherinesheard/global-nest-data','Placement height is not nest size. Preserve minimum, maximum, average separately. Nest size is prose; audit units, approximations and construction context. Source rows are not independent species.'),
 ('nest-Dataset-S2.csv',',','Species scientific name','https://github.com/catherinesheard/global-nest-data','Summary overlaps S1. Architecture categories do not form a numerical ranking.'),
 ('pollinators-bee_trait_20240922.csv',';','Species','https://zenodo.org/records/8300431','Decimal commas. Sex/caste and sample sizes separate. Tongue lengths may be ITD conversions: reject modeled values. THS is experimental heat-stupor time, not general heat tolerance. AOO/EOO geographical and method audit needed. Hair indices are not direct hair lengths.'),
 ('pollinators-syrphid_traits_20240326.txt','\t','genus_species','https://zenodo.org/records/8300431','Development duration, size and flying ability largely bins/categories; never turn bins into exact duration or speed. Habitat counts are survey-specific.'),
 ('mammalbase-diets.tsv','\t','targetTaxonName','https://github.com/mammalbase/database','Interaction observations are not complete species diets. Audit source effort, synonyms, prey resolution and distinct prey counts; never infer globally most diverse diet from record count.'),
 ('eyes-vertebrates.csv',',','Dataset_name','https://github.com/knthomas/anuran-eye-size','Axial, transverse and corneal diameter separate. Preserve measured axis, specimen/sex, source and units; reject allometric predictions and no cross-axis pooling.')]
manifest=[]
with gzip.open(OUT/'additional-source-records.jsonl.gz','wt',encoding='utf-8') as sink:
 for name,sep,taxon,url,gate in spec:
  if not (SOURCE/name).exists():continue
  summary,rows=table(name,(SOURCE/name).read_bytes(),sep,taxon,url,gate)
  # Taxon field is explicitly corrected only if present, never guessed silently.
  if taxon not in summary['fields']:
   summary['distinct_source_taxon_labels']=None;summary['taxon_field_unresolved']=True
  manifest.append(summary)
  for i,row in enumerate(rows,2):sink.write(json.dumps({'catalog':name,'source_row':i,'raw_fields':row},ensure_ascii=False)+'\n')
 z=zipfile.ZipFile(SOURCE/'frugint.zip')
 for name in z.namelist():
  if not name.endswith(('mammalTraits.csv','birdTraits.csv')):continue
  summary,rows=table(name,z.read(name),';','Frug_species','https://zenodo.org/records/18016801','Fruit proportion is estimated: reject for numeric prizes. Mammal length/mass units visibly mix sizes and require row-specific unit/provenance audit. Ear lengths only a small subset. Bird gut passage is seed/food/protocol-specific, not generic digestion speed. Do not derive midpoint ourselves.')
  manifest.append(summary)
  for i,row in enumerate(rows,2):sink.write(json.dumps({'catalog':name,'source_row':i,'raw_fields':row},ensure_ascii=False)+'\n')
checks=[]
for endpoint in ('traits','datasets'):
 pages=[json.loads(p.read_text()) for p in sorted(SOURCE.glob(f'spider-{endpoint}*.json'))]
 ids=[tuple(x['id'] for x in d['items']) for d in pages]
 checks.append({'endpoint':endpoint,'responses':len(pages),'distinct_pages':len(set(ids)),'reported_total':pages[0]['count'],'complete':False,'reason':'Pagination requests returned offset 0 and repeated first page; no complete acquisition claimed.'})
result={'tables':manifest,'rows':sum(t['rows'] for t in manifest),'new_game_approvals':0,'spider_api_checks':checks,'normalization':'Raw cells only, no imputation, no numeric conversion, no pooled units.'}
(OUT/'additional-source-audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'tables':len(manifest),'rows':result['rows'],'catalogs':[(t['id'],t['rows'],t['distinct_source_taxon_labels']) for t in manifest]},indent=2))
# Endpoint queue is source-specific. Opposite labels always share one raw field.
ENDPOINTS=[
('eyes-vertebrates.csv','Axial_diameter_mm','Biggest eyes','Smallest eyes','intuitive','Measured axial diameter in mm; source provenance/replicate audit pending.'),
('nest-Dataset-S1.csv','Building time average (days)','Slowest nest builders','Fastest nest builders','intuitive','Average days only; cannot substitute minima/maxima or nesting height.'),
('nest-Dataset-S1.csv','Nest size','Biggest nests','Smallest nests','intuitive','Prose measurements; audit dimensions, units and approximations before extracting.'),
('pollinators-bee_trait_20240922.csv','THS_F_min','Longest resistance to heat stress','Shortest resistance to heat stress','specialist','Shared heat-stupor experimental protocol and female caste required; not maximum habitat temperature.'),
('pollinators-bee_trait_20240922.csv','HairLength_F','Longest hairs','Shortest hairs','intuitive','Units, body region and measured/modeled status unresolved.'),
('pollinators-bee_trait_20240922.csv','AOO','Largest occupied area','Smallest occupied area','intuitive','Europe-only extent and calculation method must be explicit; not world range.'),
('New Archive/TRAITS/FRUGINT_mammalTraits.csv','Ear_length','Longest ears','Shortest ears','intuitive','Only six nonmissing rows; mixed units and aggregation need original-source verification.'),
('New Archive/TRAITS/FRUGINT_birdTraits.csv','Gut_passage_time','Slowest seed passage','Fastest seed passage','specialist','Food/seed/protocol-specific; not whole digestion time.')]
counts={t['id']:t for t in manifest}
with (OUT/'additional-endpoint-review.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['catalog','field','high_label','low_label','interest','populated_cells','decision','audit_gate'])
 for catalog,field,high,low,interest,gate in ENDPOINTS:
  w.writerow([catalog,field,high,low,interest,counts[catalog]['populated_cells'].get(field,0),'hold_for_manual_source_audit',gate])
