#!/usr/bin/env python3
"""Field-level readiness audit. Never promote research records to gameplay."""
import argparse,collections,csv,hashlib,io,json,pathlib,zipfile
import openpyxl,pyarrow.parquet as pq
R=pathlib.Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--bulk-root',type=pathlib.Path,required=True);p.add_argument('--rept-source',type=pathlib.Path,required=True);a=p.parse_args();S=R/'data/animalstats/source/underrepresented-20261010';roster=json.loads((R/'data/animalstats/pilot.json').read_text());names={x['scientificName'] for x in roster['animals']};out={'date':'2026-10-10','policy':'Research fields are not approved values or playable categories. Coverage rules remain broad 50 across three true classes, scoped 20, breeds 8.','approvedNewValues':0,'sources':[]}
def numeric(v):
 return isinstance(v,(int,float)) and not isinstance(v,bool) and v>0

def audit(id,rows,name,fields,url,license,holds,path):
 counts=[]
 for f,interest in fields.items():
  have=[r for r in rows if numeric(r.get(f))]
  counts.append({'field':f,'interest':interest,'numericRows':len(have),'sourceSpecies':len({name(r) for r in have}),'currentRosterSpecies':len({name(r) for r in have if name(r) in names}),'decision':'hold','opposites':['most / largest / longest','least / smallest / shortest']})
 out['sources'].append({'id':id,'url':url,'license':license,'rawRows':len(rows),'sourceSpecies':len({name(r) for r in rows}),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fields':counts,'holds':holds,'approvedGameValues':0})
w=openpyxl.load_workbook(a.rept_source,read_only=True,data_only=True);it=iter(w['Data'].values);headers=next(it);rows=[dict(zip(headers,r))for r in it];w.close()
audit('repttraits',rows,lambda r:r['Species'],{'Maximum Longevity (years)':'high: lifespan','Maximum body mass (g)':'high: weight; allometric values excluded','Maximum total length ("TL", mm)':'high: length; do not mix with SVL/SCL','Hatchling/neonate mass (g)':'high: newborn size','Mean number of offspring per litter or number of eggs per clutch':'high: offspring per event','Largest clutch size':'high: maximum eggs; preserve statistic','Number of litters or clutches produced per year':'high: breeding frequency; midpoint summaries held','Egg length (mm)':'moderate: egg size'},'https://doi.org/10.6084/m9.figshare.24572683.v4','CC BY 4.0',['Join every trait cell to its reference worksheet.','Mass values can be allometric: Slavenko et al. and other methods require classification.','Mixed SVL, total length and shell length are not comparable.','Longevity context and clutch/litter means need verification.'],a.rept_source)
z=zipfile.ZipFile(S/'amphibio.zip');rr=list(csv.DictReader(io.StringIO(z.read('AmphiBIO_v1.csv').decode('cp1252'))));
for r in rr:
 for k,v in list(r.items()):
  try:r[k]=float(v)
  except (ValueError,TypeError):pass
audit('amphibio',rr,lambda r:r['Species'],{k:'high: intuitive life-history candidate' for k in ['Body_mass_g','Body_size_mm','Longevity_max_y','Litter_size_max_n','Reproductive_output_y']}|{'Age_at_maturity_min_y':'moderate: maturity','Offspring_size_max_mm':'hold: mixed offspring/egg definition'},'https://doi.org/10.6084/m9.figshare.4644424.v5','CC BY',['Frog body size is SVL; salamander/caecilian size is total length.','Source references are attached to species, not individual trait cells.','Reject estimates; preserve age, source statistic and reproductive mode.'],S/'amphibio.zip')
for source in ['fishbase','sealifebase']:
 species_rows=pq.read_table(a.bulk_root/source/'species.parquet').to_pylist();species_names={str(r['SpecCode']):str(r.get('Genus',''))+' '+str(r.get('Species','')) for r in species_rows}
 for table,fields in {'species':{'Length':'high: length, same length type','Weight':'high: reported maximum weight','LongevityWild':'high: wild lifespan','DepthRangeDeep':'moderate: habitat depth, not dive ability'},'spawning':{'FecundityMax':'high: egg count, preserve per-event versus seasonal basis'},'eggs':{'Eggdiammax':'moderate: egg diameter'}}.items():
  path=a.bulk_root/source/(table+'.parquet');rows=pq.read_table(path).to_pylist();audit(source+'-'+table,rows,lambda r:species_names.get(str(r.get('SpecCode',r.get('Speccode',''))),'unresolved'),fields,'https://fishbase.org/' if source=='fishbase' else 'https://www.sealifebase.ca/','Upstream terms and record-level citations must be preserved',['Join species IDs and reference IDs before exact-species promotion.','Exclude modeled and calculated values; summary fields do not prove direct observation.','Fecundity basis differs across records.'],path)
rows=[]
for path in (S/'arthropod-raw').glob('*.xlsx'):
 w=openpyxl.load_workbook(path,read_only=True,data_only=True);it=iter(w.worksheets[0].values);h=next(it)
 for r in it:rows.append(dict(zip(h,r)))
 w.close()
audit('nw-european-arthropods',rows,lambda r:r.get('Species'),{k:'high: intuitive; verify original source'for k in ['Size_max','Fecundity_max','Development_total','Longevity']}|{'Mobility_distance':'high: actual distance only; reject ordinal scores'},'https://doi.org/10.5281/zenodo.13379714','Dataset paper specifies CC BY-NC 4.0; reconcile source metadata before use',['Literature and expert estimates are mixed: review Source for every record.','Adult lifespan differs from total lifespan.','Development depends on temperature; retain assay conditions.','Regional coverage must be stated; do not imply global completeness.','Do not execute downloaded R code.'],S/'arthropod-raw.7z')
(R/'data/animalstats/research/underrepresented-source-readiness-20261010.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'sourceTables':len(out['sources']),'rows':sum(s['rawRows']for s in out['sources']),'sourceFields':sum(len(s['fields'])for s in out['sources']),'approvedNewValues':0}));
