#!/usr/bin/env python3
"""Import underrepresented groups for research only; preserve source rows without ranking."""
import collections,csv,gzip,hashlib,io,json,math
from pathlib import Path
import openpyxl
import pyarrow.parquet as pq
ROOT=Path(__file__).resolve().parents[1]/'data/animalstats';S=ROOT/'source';O=ROOT/'research'
manifest={};queue=[]
def clean(v):
 if isinstance(v,float) and not math.isfinite(v):return None
 if hasattr(v,'isoformat'):return v.isoformat()
 return v

def read_csv(name):
 b=(S/name).read_bytes()
 try:t=b.decode('utf-8-sig')
 except UnicodeDecodeError:t=b.decode('cp1252')
 return list(csv.DictReader(io.StringIO(t)))

def emit(catalog,rows,taxon,group,files,url,caution,priority_fields):
 path=O/(catalog+'.jsonl.gz');coverage=collections.Counter();groups=collections.Counter();taxa=set();n=0
 with path.open('wb') as raw, gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as stream:
  for i,row in enumerate(rows):
   r={str(k):clean(v) for k,v in row.items() if k is not None};name=taxon(r)
   if not name:continue
   g=group(r) or 'unresolved';taxa.add(name);groups[g]+=1;n+=1
   record=dict(species=name,group=g,sourceRow=i+2,measurements=r,context={},review='pending manual review; original fields are not approved game values')
   stream.write((json.dumps(record,ensure_ascii=False,allow_nan=False,sort_keys=True)+'\n').encode())
   coverage.update(k for k,v in r.items() if v not in (None,'','NA','NaN'))
 manifest[catalog]=dict(records=n,uniqueSourceTaxa=len(taxa),groups=dict(groups),fieldCoverage=dict(coverage),url=url,caution=caution,version='snapshot 2026-10-02',gameApproved=0,inputs=[dict(file=f,sha256=hashlib.sha256((S/f).read_bytes()).hexdigest(),bytes=(S/f).stat().st_size) for f in files])
 for field,count in coverage.items():
  queue.append(dict(catalog=catalog,field=field,nonMissing=count,interest='priority familiar candidate' if field in priority_fields else 'unrated/context: manual review',decision='pending',measurementReview=caution))
 print(catalog,n,'rows;',len(taxa),'source taxa',flush=True)

emit('combine-reported',read_csv('combine-reported.csv'),lambda r:r['iucn2020_binomial'],lambda r:r['order'],['combine-reported.csv','combine-sources.csv','combine-databases.csv'],'https://figshare.com/articles/dataset/13028255','Reported table only; not the imputed table. Upstream sources can still contain estimates: join per-trait sources and inspect original methods. Diet percentages and dispersal must not be presumed directly measured.',{'adult_mass_g','max_longevity_d','gestation_length_d','social_group_n','home_range_km2','adult_body_length_mm','det_diet_breadth_n'})
emit('leptraits',read_csv('leptraits-consensus.csv'),lambda r:r['Species'],lambda r:r['Family'],['leptraits-consensus.csv','leptraits-records.csv','leptraits-habitat_recordDictionary.csv','leptraits-habitat_recordKey.csv'],'https://github.com/RiesLabGU/LepTraits/tree/f73317d28b38f80923ad8e02cc06d35f5c16ed1f','Consensus values need record-level citations and sex/basis review. FlightDuration is seasonal occurrence, not lifetime distance. Hostplant families are not all food species.',{'WS_U','WS_L','NumberOfHostplantFamilies'})
emit('leptraits-records',read_csv('leptraits-records.csv'),lambda r:(r['Genus']+' '+r['Species']).strip(),lambda r:'Lepidoptera',['leptraits-records.csv'],'https://github.com/RiesLabGU/LepTraits/tree/f73317d28b38f80923ad8e02cc06d35f5c16ed1f','Record-level provenance for consensus; retain ResourceID, Book and PageNumber. Individual records are not independent species; audit source measurement units and sex before ranking.',set())
emit('carnidiet',read_csv('carnidiet-v1.csv'),lambda r:r['scientificNameCarni'],lambda r:r['orderCarni'],['carnidiet-v1.csv','carnidiet-metadata.xlsx'],'https://doi.org/10.1111/geb.13296','Study/prey rows are not independent animals. Frequency of occurrence, biomass, volume and kills differ. Study effort affects recorded diet diversity; never treat unreported prey as absent.',{'foodType','scientificNamePrey'})
emit('odonate',read_csv('odonate-2020.csv'),lambda r:r['GenusSpecies'],lambda r:r['SubOrder'],['odonate-2020.csv','odonate-metadata.pdf'],'https://zenodo.org/records/4291088','Length cells may encode multiple sex-specific observations and ranges as text; preserve and manually parse, never take arbitrary first number.',{'body_lengths','female_body_lengths'})
emit('fishbase',pq.read_table(S/'fb-v26.06-species.parquet').to_pylist(),lambda r:(r['Genus']+' '+r['Species']).strip(),lambda r:'fish',['fb-v26.06-species.parquet'],'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/cboettig/fishbase/fb/v26.06/parquet/species.parquet','Preserve reference IDs, length types and sex. Vulnerability, resilience, growth and trophic fields may be modeled. Habitat depth is not dive ability. Join references before promotion; review license.',{'Length','Weight','LongevityWild','LongevityCaptive'})
w=openpyxl.load_workbook(S/'disperse-2020.xlsx',read_only=True,data_only=True);it=iter(w['Data'].values);next(it);next(it);headers=next(it)
emit('disperse',({k:v for k,v in zip(headers,row)} for row in it),lambda r:r['Lowest taxonomic level'],lambda r:r['Group'],['disperse-2020.xlsx'],'https://doi.org/10.1038/s41597-020-00732-7','Fuzzy-coded trait bands and often genus/family-level taxa. Research context only: never convert bands to precise values or genus records to species values.',set());w.close()
(O/'gap-source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
with (O/'gap-trait-review-queue.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(queue[0]));writer.writeheader();writer.writerows(queue)
