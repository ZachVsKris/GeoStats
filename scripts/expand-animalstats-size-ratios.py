"""Exact arithmetic on paired source records; never substitute missing endpoints."""
import csv,json,statistics,hashlib,zipfile,io,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1];P=R/'data/animalstats/pilot.json';d=json.loads(P.read_text());rows=list(csv.DictReader(open(R/'data/animalstats/source/amniote-selected-raw.csv')));audit=[]
metrics=[('newborn_relative_mass','Biggest newborn for adult size','Smallest newborn for adult size','birth_or_hatching_weight_g','baby-size','Reported newborn or hatchling weight as a percentage of adult weight. Exact ratio from a raw record containing both weights; source compilation, not individual growth tracking.'),('egg_relative_mass','Biggest egg for adult size','Smallest egg for adult size','egg_mass_g','egg-size','Reported egg weight as a percentage of adult weight. Exact ratio from a raw record containing both weights; females are not standardized across records. Not the fraction of a mother’s weight in every pregnancy.')]
for tid,high,low,col,key,basis in metrics:
 ids={tid,tid+'__low'};d['traits']=[t for t in d['traits'] if t['id'] not in ids];d['values']=[v for v in d['values'] if v['traitId'] not in ids]
 groups=sorted({a['taxonomicGroup'] for a in d['animals'] if a.get('entityType')!='breed' and any(r['genus']+' '+r['species']==a['scientificName'] and float(r[col])>0 and float(r['adult_body_mass_g'])>0 for r in rows)})
 basis+=' Median of distinct eligible within-record ratios. Tailored comparison groups; records with missing endpoints, subspecies or nonpositive weights are excluded. Full disagreement envelope is retained where more than one ratio is reported.'
 for suffix,label,direction,counter in [('',high,'higher_wins',tid+'__low'),('__low',low,'lower_wins',tid)]:d['traits'].append(dict(id=tid+suffix,displayName=label,definition=basis,direction=direction,unit='% of adult weight',eligibilityGroups=groups,canonicalSourceId='amniote-raw-2015',separationMethod='positive_ratio_5_percent',measurementBasis=basis,gameplayFamily=key,metricKey=key,playerHint=basis,prototypeCategory=True,categoryKind='intuitive',counterTraitId=counter))
 for a in d['animals']:
  if a.get('entityType')=='breed':continue
  matched=[(i+2,r) for i,r in enumerate(rows) if r['genus']+' '+r['species']==a['scientificName'] and r['subspecies'] in ['-999','','NA'] and float(r[col])>0 and float(r['adult_body_mass_g'])>0]
  ratios=sorted({100*float(r[col])/float(r['adult_body_mass_g']) for _,r in matched})
  if not ratios:continue
  audit.append(dict(animalId=a['id'],trait=tid,rawRows=[dict(rowNumber=i,numeratorG=r[col],denominatorG=r['adult_body_mass_g'],ratio=100*float(r[col])/float(r['adult_body_mass_g']),citation=r['dataset']) for i,r in matched],median=statistics.median(ratios)))
  for suffix in ['', '__low']:
   v=dict(animalId=a['id'],traitId=tid+suffix,valueNumeric=statistics.median(ratios),unit='% of adult weight',sex='source sexes not standardized',lifeStage='reported newborn-to-adult' if col.startswith('birth') else 'reported egg-to-adult',measurementBasis=basis,sourceId='amniote-raw-2015',observationType='compiled',confidence='approved',notes=f'Exact 100 × {col} / adult_body_mass_g within raw rows {[i for i,_ in matched]}; source citations '+ '; '.join(sorted({r['dataset'] for _,r in matched})),recordOrigin='paired published source record',uncertaintyStatus='not-reported',sampleSizeCategory='not-reported')
   if len(ratios)>1:v.update(valueMin=min(ratios),valueMax=max(ratios),uncertaintyStatus='reported-range')
   d['values'].append(v)
# One intuitive comparison of the poleward edge of historical mammal ranges.
archive=R/'data/animalstats/source/pantheria-2009.zip'
if not archive.exists():shutil.copyfile('/workspace/scratch/f91dba166665/animalstats-prototype/data/animalstats/source/pantheria-2009.zip',archive)
z=zipfile.ZipFile(archive);raw=z.read('PanTHERIA_1-0_WR05_Aug2008.txt');ranges=list(csv.DictReader(io.StringIO(raw.decode()),delimiter='\t'));tid='mapped_equator_outer_distance';basis='Largest absolute latitude at either edge of the historical mapped range: max(abs(maximum latitude), abs(minimum latitude)). Lower values mean the entire north–south extent remains closer to the equator. PanTHERIA Sechrest 2003 extant non-marine mammal maps; not a population center or current occupied habitat.'
d['traits']=[t for t in d['traits'] if t['id'] not in [tid,tid+'__low']];d['values']=[v for v in d['values'] if v['traitId'] not in [tid,tid+'__low']]
for suffix,label,direction,counter in [('', 'Range reaches farthest from equator','higher_wins',tid+'__low'),('__low','Range stays closest to equator','lower_wins',tid)]:d['traits'].append(dict(id=tid+suffix,displayName=label,definition=basis,direction=direction,unit='degrees from equator',eligibilityGroups=[],canonicalSourceId='pantheria-range-maps',separationMethod='positive_ratio_5_percent',measurementBasis=basis,gameplayFamily='range-geography',metricKey='range-equator-edge',playerHint=basis,prototypeCategory=True,categoryKind='intuitive',counterTraitId=counter))
for a in d['animals']:
 if a.get('entityType')=='breed':continue
 r=next((r for r in ranges if r['MSW05_Binomial']==a['scientificName']),None)
 if not r:continue
 high=float(r['26-2_GR_MaxLat_dd']);low=float(r['26-3_GR_MinLat_dd'])
 if high==-999 or low==-999:continue
 assert -90<=low<=high<=90
 value=max(abs(high),abs(low))
 if value<=0:continue
 for suffix in ['', '__low']:d['values'].append(dict(animalId=a['id'],traitId=tid+suffix,valueNumeric=value,unit='degrees from equator',sex='species-level',lifeStage='species-level',measurementBasis=basis,sourceId='pantheria-range-maps',observationType='compiled',confidence='approved',notes=f'Published range extrema {low}, {high}; exact max(abs(low), abs(high)). Archive SHA256 {hashlib.sha256(raw).hexdigest()}',uncertaintyStatus='not-reported'))
P.write_text(json.dumps(d,separators=(',',':'))+'\n');(R/'data/animalstats/research/paired-size-ratio-audit.json').write_text(json.dumps(audit,indent=2)+'\n');print('Imported',len(audit),'paired-size records and equator range directions')
