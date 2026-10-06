#!/usr/bin/env python3
"""Add traceable observations, never model predictions, to the fair catalog."""
from pathlib import Path
import csv,io,json,zipfile,statistics,collections,hashlib
import pandas as pd
import urllib.request
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats';SRC=OUT/'source'
d=json.loads((OUT/'pilot.json').read_text());animals={a['scientificName'].lower():a for a in d['animals'] if a.get('entityType') != 'breed'}; evidence=[]
def source(id,name,url,version,license,kind='curated-trait-database'):
 if id not in {s['id'] for s in d['sources']}:d['sources'].append(dict(id=id,name=name,url=url,versionYear=version,license=license,sourceClass=kind,retrievedAt='2026-10-02'))
def trait(id,name,unit,basis,src,family,hint):
 t=dict(id=id,displayName=name,unit=unit,definition=basis,measurementBasis=basis,canonicalSourceId=src,eligibilityGroups=[],direction='higher_wins',separationMethod='positive_ratio_5_percent',gameplayFamily=family,playerHint=hint)
 d['traits']=[x for x in d['traits'] if x['id']!=id]+[t];d['values']=[v for v in d['values'] if v['traitId']!=id];return t
def value(a,t,nums,notes,sex='source cohorts',stage='source stages not standardized',origin=None):
 v=dict(animalId=a['id'],traitId=t['id'],valueNumeric=statistics.median(nums),unit=t['unit'],sex=sex,lifeStage=stage,measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',notes=notes,uncertaintyStatus='reported' if min(nums)!=max(nums) else 'not-reported',uncertaintyKind='source-range' if min(nums)!=max(nums) else 'not-reported')
 if min(nums)!=max(nums):v.update(valueMin=min(nums),valueMax=max(nums))
 if origin:v['recordOrigin']=origin
 d['values'].append(v);evidence.append(v)
# Normal permanent dentition counts: taxonomic formula, not an estimate of teeth in a random damaged skull.
source('dental-accounts-2026','University anatomical accounts and adult rhesus skull study','https://animaldiversity.org/collections/mammal_anatomy/kinds_of_teeth/','Published species/family accounts; checked 2026-10-02','Numerical anatomical facts with attribution; account copyrights retained','institutional-account')
t=trait('adult_tooth_count','Most adult teeth','teeth','Normal complete permanent dentition, calculated exactly from the published dental formula. Excludes milk teeth, lost teeth, anomalies, and lifetime replacement totals. Family-level formulas are used only for explicitly included taxa.','dental-accounts-2026','teeth','Normal adult teeth—not baby teeth or replacements over a lifetime.')
records=[('Vulpes vulpes',42,'I3/3 C1/1 P4/4 M2/3','https://www.depts.ttu.edu/nsrl/mammals-of-texas-online-edition/Accounts_Introduced_Carnivora/Vulpes_vulpes.php'),('Didelphis marsupialis',50,'I5/4 C1/1 P3/3 M4/4','https://animaldiversity.org/accounts/Didelphidae/'),('Castor canadensis',20,'I1/1 C0/0 P1/1 M3/3','https://www.depts.ttu.edu/nsrl/mammals-of-texas-online-edition/Accounts_Rodentia/Castor_canadensis.php'),('Cavia porcellus',20,'I1/1 C0/0 P1/1 M3/3','https://pmc.ncbi.nlm.nih.gov/articles/PMC9850587/'),('Macaca mulatta',32,'I2/2 C1/1 P2/2 M3/3','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508521/'),('Erinaceus europaeus',36,'I3/2 C1/1 P2/3 M3/3','https://animaldiversity.org/accounts/Erinaceus_europaeus/')]
for sci,n,formula,url in records:value(animals[sci.lower()],t,[n],f'Complete adult formula {formula}, doubled for left and right sides = {n}. Anatomical account: {url}. This is the normal formula, not a measured individual tooth inventory.',sex='species-level',stage='adult')
# Empirical travel means only. Separate swimming from land travel; reject lab speeds, medians and model outputs.
source('travel-speed-2023','Dyer et al. empirical animal travel speeds','https://doi.org/10.5281/zenodo.7554842','2023 empirical df_spp.csv','CC BY 4.0')
travel=SRC/'travel-speed-2023.zip'
if not travel.exists():urllib.request.urlretrieve('https://zenodo.org/api/records/7554842/files/Travel%20speed%20data%20and%20model.zip/content',travel)
if hashlib.sha256(travel.read_bytes()).hexdigest()!='8224f0998dcf01c744b002121cf145134266f662f682184c881e048a443df4b2':raise ValueError('Travel speed source checksum mismatch')
z=zipfile.ZipFile(travel);rs=list(csv.DictReader(io.StringIO(z.read('Travel speed data and model/data/processed/df_spp.csv').decode('latin1'))));refs=pd.read_excel(io.BytesIO(z.read('Travel speed data and model/data/processed/df_spp_refs.xlsx')),sheet_name='df_spp_refs').set_index('ref_id')
for mode,id,name in [('running','field_travel_speed','Fastest measured land travel'),('swimming','field_swim_speed','Fastest measured swimming')]:
 t=trait(id,name,'km/h',f'Median of empirical field-study mean {mode} travel speeds in Dyer et al. 2023. Only direct observation or telemetry, no lab trials, medians, or predicted speeds. Study sex and life stage are not standardized; full included study-mean envelope checked. Travel is not a maximum sprint, burst, or lifetime-distance record.','travel-speed-2023','movement','Observed field travel speed—not a maximum sprint or burst.')
 by=collections.defaultdict(list)
 for r in rs:
  a=animals.get(r['scientific_name'].lower())
  if a and r['move_movement_mode']==mode and r['move_study_condition']=='field' and r['move_avgspeed_value']=='mean' and r['move_speed_method'] in {'direct_obs','telemetry'}:by[a['id']].append(r)
 for aid,rows in by.items():
  a=next(a for a in d['animals'] if a['id']==aid);nums=[float(r['move_avgspeed_ms'])*3.6 for r in rows];notes='; '.join(f"{r['move_avgspeed_ms']} m/s; method {r['move_speed_method']}; {refs.loc[int(r['move_speed_ref']),'ref_citation']} DOI: {refs.loc[int(r['move_speed_ref']),'ref_DOI']}" for r in rows)
  value(a,t,nums,notes+'. Species summary is the median of study means, not a universal wild average. No body masses from this dataset are used.',origin='wild')
# AnAge basal rates and the source-matched assay mass. No cross-source mass division.
z=zipfile.ZipFile(SRC/'anage-build-15.zip');rs=list(csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()),delimiter='\t'))
for id,name,unit,relative in [('basal_energy','Most resting energy use','W',False),('mass_specific_basal_energy','Most resting energy per gram','W/g',True)]:
 t=trait(id,name,unit,'AnAge build 15 reported basal metabolic rate'+(' divided by the body mass of that metabolic measurement' if relative else '')+'. Compiled laboratory measurements; assay conditions and cohorts vary. Not daily food intake, exercise, or a wild energy budget. No missing values inferred.','anage-15','metabolism','Energy used at basal rest'+(' per gram of the measured animal.' if relative else ', in laboratory measurements.'))
 for r in rs:
  a=animals.get((r['Genus']+' '+r['Species']).lower())
  try:n=float(r['Metabolic rate (W)']);mass=float(r['Body mass (g)'])
  except ValueError:continue
  if a and r['Class'] in {'Mammalia','Aves'} and n>0 and mass>0:value(a,t,[n/mass if relative else n],f"AnAge HAGRID {r['HAGRID']}; BMR={n} W; assay body mass={mass} g; references {r['References']}."+(' Exact arithmetic ratio of those two source observations.' if relative else ''),sex='source cohorts',stage='source stages not standardized',origin='captivity')
# REM-like paradoxical sleep uses the same strict adult EEG eligibility as total sleep, without claiming dream counts.
t=trait('daily_rem_sleep','Most REM sleep','hours/day','Median daily paradoxical (REM) sleep in eligible adult mixed-sex captive EEG studies, recorded for 24 hours, at least three animals and lab-condition score at least 9. Full included study-mean envelope checked. This does not measure number of dreams.','sleep-bu-2007','sleep','Measured REM sleep in adult captive studies—not a count of dreams.')
by=collections.defaultdict(list)
for r in csv.DictReader((SRC/'sleep-bu-records.csv').open()):
 a=animals.get(r['SpeciesName_Reported'].lower().removesuffix(' l.'))
 try:n=float(r['N']);score=float(r['Total_lab_condition_score']);hours=float(r['Daily_PS_time'])
 except ValueError:continue
 if a and r['EEG']=='Yes' and r['Twenty_four_hour'].startswith('3') and r['Summary_age_class']=='Adult' and r['Sex']=='Mix' and n>=3 and score>=9 and 0<hours<=24:by[a['id']].append((r,hours))
for aid,rows in by.items():value(next(a for a in d['animals'] if a['id']==aid),t,[n for r,n in rows],'; '.join(f"BU record {r['search_id']}; {r['Full_Reference']}; N={r['N']}; lab score {r['Total_lab_condition_score']}" for r,n in rows),sex='mixed',stage='adult',origin='captivity')
(OUT/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n');(OUT/'fair-expansion-observations.json').write_text(json.dumps({'observations':evidence,'travelArchiveSha256':hashlib.sha256((SRC/'travel-speed-2023.zip').read_bytes()).hexdigest()},indent=2,ensure_ascii=False)+'\n')
print('Added source records',collections.Counter(v['traitId'] for v in evidence))
