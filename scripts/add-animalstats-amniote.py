#!/usr/bin/env python3
"""Use exact-species raw records; exclude transferred taxonomy and unqualified longevity."""
import csv,io,json,hashlib,statistics,urllib.request,zipfile,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats';ARCHIVE=OUT/'source/amniote-2015.zip'
URL='https://ndownloader.figshare.com/files/8067269'
REPTILES={'crocodilian','snake','lizard','reptile','turtle'};MAMMALS={'carnivore','bear','large-mammal','primate','marsupial','rodent','marine-mammal'}
# Oviparous source taxa only; no eggs/offspring or incubation/gestation conflation.
EGGLAYERS={'Alligator mississippiensis','Crocodylus niloticus','Crocodylus acutus','Gavialis gangeticus','Osteolaemus tetraspis','Python regius','Python molurus','Elaphe guttata','Eublepharis macularius','Sphenodon punctatus','Chlamydosaurus kingii','Chelonia mydas','Caretta caretta','Dermochelys coriacea','Macrochelys temminckii','Trachemys scripta','Gopherus agassizii','Chelonoidis nigra'}
METRICS={
 'raw_adult_mass':('Adult body mass (source median)','adult_body_mass_g','g','Median of distinct reported adult body-mass values in exact-species amniote raw records','all','higher_wins'),
 'raw_female_maturity':('Age at female maturity (source median)','female_maturity_d','days','Median of distinct reported female sexual-maturity ages in exact-species amniote raw records','all','higher_wins'),
 'raw_early_female_maturity':('Earliest female maturity (source median)','female_maturity_d','days','Median of distinct reported female sexual-maturity ages in exact-species amniote raw records','all','lower_wins'),
 'raw_egg_mass':('Egg mass','egg_mass_g','g','Median of distinct reported egg masses in exact-species amniote raw records','eggs','higher_wins'),
 'raw_egg_length':('Egg length','egg_length_mm','mm','Median of distinct reported egg lengths in exact-species amniote raw records','eggs','higher_wins'),
 'raw_egg_width':('Egg width','egg_width_mm','mm','Median of distinct reported egg widths in exact-species amniote raw records','eggs','higher_wins'),
 'raw_incubation':('Time until hatching (source median)','incubation_d','days','Median of distinct reported incubation durations in exact-species amniote raw records','eggs','higher_wins'),
 'raw_clutch_size':('Eggs per clutch (source median)','litter_or_clutch_size_n','eggs','Median of distinct reported egg counts per clutch in exact-species amniote raw records','eggs','higher_wins'),
 'raw_clutch_frequency':('Clutches per year (source median)','litters_or_clutches_n_or_y','clutches/year','Median of distinct reported annual clutch frequencies in exact-species amniote raw records','eggs','higher_wins'),
 'raw_hatching_mass':('Weight at hatching (source median)','birth_or_hatching_weight_g','g','Median of distinct reported hatchling body masses in exact-species amniote raw records','eggs','higher_wins'),
 'raw_fledging_age':('Time until fledging','fledging_age_d','days','Median of distinct reported fledging ages in exact-species amniote raw records','birds','higher_wins'),
 'raw_fledging_mass':('Body mass at fledging','fledging_mass_g','g','Median of distinct reported fledgling body masses in exact-species amniote raw records','birds','higher_wins'),
 'raw_gestation':('Gestation (source median)','gestation_d','days','Median of distinct reported gestation durations in exact-species amniote raw records','mammals','higher_wins'),
 'raw_short_gestation':('Shortest gestation (source median)','gestation_d','days','Median of distinct reported gestation durations in exact-species amniote raw records','mammals','lower_wins'),
 'raw_weaning_age':('Time until weaning (source median)','weaning_d','days','Median of distinct reported weaning ages in exact-species amniote raw records','mammals','higher_wins'),
 'raw_weaning_mass':('Body mass at weaning (source median)','weaning_weight_g','g','Median of distinct reported weaning masses in exact-species amniote raw records','mammals','higher_wins'),
 'raw_litter_size':('Young per birth (source median)','litter_or_clutch_size_n','offspring','Median of distinct reported live offspring counts per litter in exact-species amniote raw records','mammals','higher_wins'),
 'raw_litter_frequency':('Litters per year (source median)','litters_or_clutches_n_or_y','litters/year','Median of distinct reported annual litter frequencies in exact-species amniote raw records','mammals','higher_wins'),
 'raw_birth_mass':('Newborn body mass (source median)','birth_or_hatching_weight_g','g','Median of distinct reported newborn body masses in exact-species amniote raw records','mammals','higher_wins'),
}
def eligible(a,scope):
 g=a['taxonomicGroup'];name=a['scientificName']
 return (scope=='all' and (g in MAMMALS|REPTILES or g=='bird')) or (scope=='birds' and g=='bird') or (scope=='mammals' and g in MAMMALS) or (scope=='eggs' and (g=='bird' or name in EGGLAYERS))
def main():
 if not ARCHIVE.exists():urllib.request.urlretrieve(URL,ARCHIVE)
 if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()!='f7a8973452625422868ff33cc6fc2362e965eede173b2fd4262ed1668abe0f2f':raise SystemExit('Upstream release changed; review before importing')
 d=json.loads((OUT/'pilot.json').read_text());animals={a['scientificName']:a for a in d['animals'] if a.get('entityType') != 'breed'}
 with zipfile.ZipFile(ARCHIVE) as z:raw=list(csv.DictReader(io.TextIOWrapper(z.open('Data_Files/Amniote_Sparse_Table_Aug_2015.csv'))))
 selected=[r for r in raw if r['genus']+' '+r['species'] in animals and r['subspecies'] in ['-999','','NA']]
 # Keep the raw supporting rows available for direct source review.
 with (OUT/'source/amniote-selected-raw.csv').open('w') as f:
  writer=csv.DictWriter(f,fieldnames=list(raw[0]),lineterminator="\n");writer.writeheader();writer.writerows(selected)
 if not any(s['id']=='amniote-raw-2015' for s in d['sources']):d['sources'].append(dict(id='amniote-raw-2015',name='Amniote life-history database, exact-species raw records',sourceClass='curated-trait-database',url='https://doi.org/10.6084/m9.figshare.3563457.v1',versionYear='August 2015 raw release',retrievedAt='2026-09-29',license='CC0; cite Myhrvold et al. 2015'))
 d['values']=[v for v in d['values'] if v['sourceId']!='amniote-raw-2015'];d['traits']=[t for t in d['traits'] if t['canonicalSourceId']!='amniote-raw-2015']
 rows_by_species=collections.defaultdict(list)
 for r in selected:rows_by_species[r['genus']+' '+r['species']].append(r)
 for tid,(label,column,unit,basis,scope,direction) in METRICS.items():
  groups=sorted({a['taxonomicGroup'] for a in d['animals'] if eligible(a,scope)})
  d['traits'].append(dict(id=tid,displayName=label,definition=basis,direction=direction,unit=unit,eligibilityGroups=groups,canonicalSourceId='amniote-raw-2015',separationMethod='positive_ratio_5_percent',measurementBasis=basis))
  for name,a in animals.items():
   if not eligible(a,scope):continue
   points=[];sources=set()
   for r in rows_by_species[name]:
    try:n=float(r[column])
    except ValueError:continue
    if n>0:points.append(n);sources.add(r['dataset'])
   if not points:continue
   distinct=sorted(set(points));median=statistics.median(distinct)
   v=dict(animalId=a['id'],traitId=tid,valueNumeric=median,unit=unit,sex='female' if 'female_maturity' in tid else 'species-level',lifeStage='hatchling' if scope=='eggs' and 'hatching_mass' in tid else 'newborn' if tid=='raw_birth_mass' else 'species-level',measurementBasis=basis,sourceId='amniote-raw-2015',observationType='compiled',confidence='approved',recordOrigin='not-specified',uncertaintyStatus='reported' if len(distinct)>1 else 'not-reported',uncertaintyKind='source-range' if len(distinct)>1 else 'not-reported',notes=f"Exact-species raw records only; no subspecies transfer. {len(distinct)} distinct published values from {len(sources)} source labels. Bounds show disagreement across reports, not a confidence interval or complete biological range. Underlying sources: {'; '.join(sorted(sources))}")
   if len(distinct)>1:v.update(valueMin=min(distinct),valueMax=max(distinct))
   d['values'].append(v)
 (OUT/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n');print(len(d['animals']),'animals',len(d['traits']),'traits',len(d['values']),'values')
if __name__=='__main__':main()
