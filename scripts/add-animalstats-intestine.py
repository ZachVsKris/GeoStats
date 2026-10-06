"""Import observed adult intestinal lengths, never modeled anatomy or proxy diets."""
import hashlib,json,math
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats';source=P/'source/deep-20261003-intestine.xlsx'
assert hashlib.md5(source.read_bytes()).hexdigest()=='4a3b03dbe7de9a08782dca72a0f14a64'
d=json.loads((P/'pilot.json').read_text());animals={a['scientificName']:a for a in d['animals'] if a.get('entityType') != 'breed'}
sid='duque-correa-2021-intestine';tid='adult_intestine_length'
basis=('Published sample-size-weighted mean total intestinal length of adult mammals in Duque-Correa et al. 2021. '
       'Measured post-mortem anatomy, including reported sums of small and large intestine lengths. '
       'Only exact named species with at least three measured animals; no fitted allometric values, estimated body masses, '
       'diet substitutions from relatives or unknown sample sizes. Captive, wild and mixed cohorts are identified per record; '
       'these observed cohort averages are not species maxima or universal constants.')
d['sources']=[s for s in d['sources'] if s['id']!=sid]+[dict(id=sid,name='Duque-Correa et al. 2021: measured mammal intestinal lengths',sourceClass='primary-research',url='https://doi.org/10.5061/dryad.z8w9ghxb8',versionYear='2021',retrievedAt='2026-10-04',license='Dryad data CC0; attributed numerical facts')]
d['traits']=[t for t in d['traits'] if t['id'] not in {tid,tid+'__low'}]+[dict(id=tid,displayName='Longest intestine',unit='cm',definition=basis,measurementBasis=basis,canonicalSourceId=sid,eligibilityGroups=[],direction='higher_wins',separationMethod='positive_ratio_5_percent',gameplayFamily='digestion-anatomy',playerHint='Measured adult intestinal length. Published study averages, not record maxima.')]
d['values']=[v for v in d['values'] if v['traitId'] not in {tid,tid+'__low'}];records=[];excluded=[]
w=openpyxl.load_workbook(source,read_only=True,data_only=True)
for rownum,r in enumerate(list(w['Species Average'].values)[2:],3):
 name=str(r[2]).replace('_',' ')
 if name not in animals or not isinstance(r[22],(int,float)):continue
 if not isinstance(r[20],(int,float)) or r[20]<3:
  excluded.append(dict(scientificName=name,reason='fewer than three measured animals or unknown N'));continue
 value=float(r[22]);assert math.isfinite(value) and value>0
 notes=f'Species Average worksheet row {rownum}; N={r[20]}; source cohort status={r[6]}; references: {r[23]}. Original paper excludes juvenile records. No uncertainty interval supplied; N is not an uncertainty bound.'
 d['values'].append(dict(animalId=animals[name]['id'],traitId=tid,valueNumeric=value,unit='cm',sex='not standardized',lifeStage='adult',measurementBasis=basis,sourceId=sid,observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',notes=notes))
 records.append(dict(scientificName=name,sourceRow=rownum,totalIntestineCm=value,sampleSize=r[20],cohortStatus=r[6],references=r[23]))
assert len(records)==8,len(records)
(P/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
(P/'research/intestine-gameplay-audit.json').write_text(json.dumps(dict(reviewedAt='2026-10-04',primaryPaper='https://doi.org/10.1098/rspb.2020.2888',sourceMd5=hashlib.md5(source.read_bytes()).hexdigest(),records=records,excluded=excluded,scope=basis),indent=2)+'\n')
print(len(records))
