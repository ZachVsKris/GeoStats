"""Import original reported observations; no fitted allometry or inferred vision.

Run before redesign-animalstats-prototype.py. New source snapshots are pinned by
hash in research/senses-diet-audit.json; the originals remain unmodified.
"""
import csv, hashlib, io, json, math, re, zipfile
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'data/animalstats'
d = json.loads((P/'pilot.json').read_text())
new_animals = {
    'Equus caballus': ('Horse', 'large-mammal'),
    'Camelus dromedarius': ('Dromedary camel', 'large-mammal'),
    'Oryctolagus cuniculus': ('European rabbit', 'lagomorph'),
    'Mus musculus': ('House mouse', 'rodent'),
    'Lemur catta': ('Ring-tailed lemur', 'primate'),
}
with zipfile.ZipFile(P/'source/anage-build-15.zip') as z:
    rows = {r['Genus']+' '+r['Species']: r for r in csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()), delimiter='\t')}
fields = {'adult_body_mass':'Adult weight (g)', 'maximum_documented_lifespan':'Maximum longevity (yrs)', 'gestation':'Gestation/Incubation (days)', 'litter_size':'Litter/Clutch size', 'female_maturity':'Female maturity (days)', 'male_maturity':'Male maturity (days)', 'weaning_age':'Weaning (days)', 'birth_weight':'Birth weight (g)', 'weaning_mass':'Weaning weight (g)', 'litters_per_year':'Litters/Clutches per year', 'interbirth_interval':'Inter-litter/Interbirth interval'}
traits = {t['id']:t for t in d['traits']}
for scientific, (common, group) in new_animals.items():
    aid = scientific.lower().replace(' ', '_'); r = rows[scientific]
    assert r['Data quality'] in {'high', 'acceptable'}
    if not any(a['id']==aid for a in d['animals']):
        d['animals'].append(dict(id=aid, commonName=common, scientificName=scientific, taxonomicGroup=group, familiarityTier='core', active=True))
    # Full wild female maturity conflicts with early breeding definitions; hold this field.
    d['values']=[v for v in d['values'] if not (scientific=='Oryctolagus cuniculus' and v['animalId']==aid and v['traitId'] in {'female_maturity','female_maturity__low'})]
    for tid, column in fields.items():
        if scientific=='Oryctolagus cuniculus' and tid=='female_maturity':continue
        t=traits[tid]
        if not r[column] or tid=='maximum_documented_lifespan' and r['Specimen origin']!='captivity': continue
        n=float(r[column])
        if n<=0:continue
        d['values']=[v for v in d['values'] if (v['animalId'],v['traitId'])!=(aid,tid)]
        d['values'].append(dict(animalId=aid,traitId=tid,valueNumeric=n,unit=t['unit'],sex='female' if tid=='female_maturity' else 'male' if tid=='male_maturity' else 'species-level',lifeStage='newborn' if tid=='birth_weight' else 'adult' if tid=='adult_body_mass' else 'species-level',measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',notes=f"HAGRID {r['HAGRID']}; AnAge Build 15; references {r['References']}; quality {r['Data quality']}; longevity origin {r['Specimen origin']}. Domestic cohorts remain identified by their exact domestic species.",recordOrigin=r['Specimen origin'] if tid=='maximum_documented_lifespan' else 'not-specified',uncertaintyStatus='not-reported',sourceQuality=r['Data quality'],sampleSizeCategory=r['Sample size'] if tid=='maximum_documented_lifespan' else 'not-reported'))

A={a['scientificName']:a for a in d['animals'] if a.get('entityType') != 'breed'}; audit={'heldRecords':[{'species':'Oryctolagus cuniculus','field':'female_maturity','reason':'AnAge 730 days refers to full wild female maturity; do not mix this with early/domestic reproductive maturity.'}],'reviewedAt':'2026-10-04','newAnimals':new_animals,'imports':{},'files':{}}
def source(sid,name,url,license):
    d['sources']=[s for s in d['sources'] if s['id']!=sid]+[dict(id=sid,name=name,sourceClass='primary-research',url=url,versionYear='Original published numerical supplement',retrievedAt='2026-10-04',license=license)]
def trait(tid,name,unit,sid,basis,family,hint,direction='higher_wins'):
    t=dict(id=tid,displayName=name,unit=unit,canonicalSourceId=sid,definition=basis,measurementBasis=basis,eligibilityGroups=[],direction=direction,separationMethod='positive_ratio_5_percent',gameplayFamily=family,playerHint=hint)
    d['traits']=[x for x in d['traits'] if x['id'] not in {tid,tid+'__low'}]+[t]
    d['values']=[v for v in d['values'] if v['traitId'] not in {tid,tid+'__low'}]
    audit['imports'][tid]=[]
    return t
def value(name,t,n,notes):
    assert math.isfinite(n) and n>0
    d['values'].append(dict(animalId=A[name]['id'],traitId=t['id'],valueNumeric=n,unit=t['unit'],sex='source cohorts not standardized',lifeStage='source cohorts not standardized',measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',notes=notes))
    audit['imports'][t['id']].append(dict(species=name,value=n,notes=notes))

sid='veilleux-kirk-2014'
source(sid,'Veilleux & Kirk 2014: original mammal eye and behavioral vision table','https://doi.org/10.1159/000357830','Numerical supplement CC BY 4.0: https://doi.org/10.6084/m9.figshare.5126077')
eye=trait('measured_eye_length','Largest eyes','mm',sid,'Published axial eye length in Veilleux & Kirk 2014 Supplementary Table 1. Exact named species only; Canis lupus (domestic-dog source) and retinal-magnification estimates marked ** are excluded. Axial length is the front-to-back dimension of the eye, not cornea size or visible eye opening. Cohort sex, age and N are not standardized.','eyes','Measured eye length, front to back—not how wide the eyelids open.')
vision=trait('behavioral_visual_acuity','Sharpest measured vision','cycles/degree',sid,'Maximum behaviorally measured spatial visual acuity (MT=B) in Veilleux & Kirk 2014 Supplementary Table 1. Anatomy-derived estimates (MT=A), phylogenetic predictions and humans are excluded. This is detail resolution under the cited test conditions, not night vision, colour vision, intelligence or a universal species constant.','vision','Behavioral tests of fine detail. Light and test methods vary; anatomy-based estimates are excluded.')
table=(P/'source/new-20261004-eyes-table.txt').read_text()
for line in table.splitlines():
    m=re.match(r'^([A-Z][a-z]+ [a-z]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(.*)',line)
    if not m or m[1] not in A or m[1]=='Canis lupus':continue
    name,ad,va,bm,rest=m.groups()
    if '**' not in rest:value(name,eye,float(ad),'Original Supplementary Table 1 row: '+line.strip()+'. Reported axial length retained exactly; no values calculated from acuity or body mass.')
    if rest.startswith('B '):value(name,vision,float(va),'Original Supplementary Table 1 row: '+line.strip()+'. Measurement type B = behavioral; original cited test maximum. No retinal-density calculation.')

sid='gerstner-gerstein-2008'
source(sid,'Gerstner & Gerstein 2008: recorded mammal chewing cycles','https://doi.org/10.1644/07-MAMM-A-188.1','Selected numerical facts with original research attribution; article prose not redistributed')
chew=trait('recorded_chewing_rate','Fastest recorded chewing','chews/min',sid,'Recorded mean chewing-cycle duration in Gerstner & Gerstein 2008 Table 1, converted from milliseconds per cycle to cycles per minute (60000/CD). Exact named species; explicitly named subspecies excluded. Authors videotaped 10–30 chewing cycles per animal; about 120 of 132 species had one sampled individual, others 2–7. Zoo foods varied. These are recorded sample rates, not species-wide averages, intake rates or maximum possible speeds. No body-mass estimates, regression fits or phylogenetic corrections are imported.','chewing','Recorded chewing cycles, not food eaten per minute. Mostly small zoo samples, with different foods.')
excluded={'Canis lupus','Ursus thibetanus','Ursus arctos'}
for r in json.loads((P/'source/expansion-chewing-records.json').read_text()):
    name=r['genus']+' '+r['species']
    if name not in A or name in excluded:continue
    ms=float(r['chewing_cycle_ms_raw'].replace(',',''))
    value(name,chew,60000/ms,f"Table 1 row {r['table_row']}: {r['common_name']}; reported cycle {ms:g} ms; cited references {r['literature_reference_numbers'] or 'authors video study'}. Exact source rate conversion. Species-specific N, ages and uncertainty not supplied; do not infer species-wide precision from the displayed rate.")

sid='tucker-rogers-2014-diet'
source(sid,'Tucker & Rogers 2014: published prey-size endpoints','https://doi.org/10.1371/journal.pone.0106402','Original workbook CC BY 4.0: https://doi.org/10.6084/m9.figshare.999069')
prey_basis='Published minimum/maximum prey-taxon body-mass endpoints in Tucker & Rogers 2014 data_DNB workbook. Original base-10 log kilograms are converted back to kilograms. These are comparative published diet endpoints, not weighed individual kills, capture ability or maximum prey an animal could defeat. Diets and study effort differ; prey-taxon body masses do not specify the age or mass of an individual consumed. Predator masses and model coefficients are excluded.'
mx=trait('diet_largest_prey','Largest prey in published diet','kg',sid,prey_basis+' This category uses the maximum endpoint.','prey-size','Published prey sizes, not the weight of an individual kill.')
mn=trait('diet_smallest_prey','Smallest prey in published diet','kg',sid,prey_basis+' This category uses the minimum endpoint.','prey-size','Published prey sizes, not bite strength or hunting ability.','lower_wins')
span=trait('diet_prey_mass_span','Widest prey-size range','kg',sid,prey_basis+' Range is maximum minus minimum as published in the source range column.','prey-size','Range in published prey weights—not a count of foods or prey species.')
w=openpyxl.load_workbook(P/'source/expansion-prey-data.xlsx',read_only=True,data_only=True)
for rownum,r in enumerate(list(w['data_DNB'].values)[1:],2):
    name=r[0].replace('_',' ')
    if name not in A:continue
    notes=f'data_DNB worksheet row {rownum}; log10 minimum={r[1]}, maximum={r[2]}, range={r[3]}; prey mass references: {r[6]}; diet references: {r[7]}; habitat {r[5]}. Exponentiation reverses the source units only. No model-predicted or body-mass-scaled values. Published endpoints are not individual prey weights.'
    if isinstance(r[1],(int,float)):value(name,mn,10**r[1],notes)
    value(name,mx,10**r[2],notes)
    if isinstance(r[3],(int,float)):value(name,span,10**r[3],notes)
for name in ['anage-build-15.zip','new-20261004-eyes-table.pdf','expansion-chewing-records.json','expansion-prey-data.xlsx']:
    f=P/'source'/name;audit['files'][name]=dict(sha256=hashlib.sha256(f.read_bytes()).hexdigest(),bytes=f.stat().st_size)
meta=json.loads((P/'source/expansion-prey-metadata.json').read_text());assert hashlib.md5((P/'source/expansion-prey-data.xlsx').read_bytes()).hexdigest()==meta['files'][0]['computed_md5']
assert hashlib.md5((P/'source/new-20261004-eyes-table.pdf').read_bytes()).hexdigest()=='466d73a0f8e709ace1dabda60d2d3aad'
(P/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
(P/'research/senses-diet-audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
print({k:len(v) for k,v in audit['imports'].items()})
