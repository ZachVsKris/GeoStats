#!/usr/bin/env python3
"""Admit exact measured cohort scores, never an intelligence ranking or prediction."""
import csv,hashlib,json,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats'
data=json.loads((P/'pilot.json').read_text());sid='maclean-2014-cylinder-cohorts'
source={'id':sid,'name':'MacLean et al.: measured treat-puzzle scores','sourceClass':'primary-research','url':'https://figshare.com/articles/dataset/MacLean_et_al_PNAS_2014_Self-Control_Data/5579335','versionYear':'2014 experiment; author data release 2017','retrievedAt':'2026-10-05','license':'CC BY 4.0; original author data'}
data['sources']=[s for s in data['sources'] if s['id']!=sid]+[source]
path=P/'source/cognition-cylinder-2014.csv';rows=list(csv.DictReader(path.open()))
# Only unambiguous named taxa already in the catalog. Orangutan and capuchin
# common labels are deliberately not resolved by guessing a species.
names={'Chimpanzee':'pan_troglodytes','Gorilla':'gorilla_gorilla','Gray wolf':'canis_lupus','Ring-tailed Lemur':'lemur_catta','Rhesus macaque':'macaca_mulatta'}
basis='Mean correct first attempts among the measured animals in MacLean et al. (2014) transparent-cylinder task. Animals had to detour around a visible barrier to retrieve food. Identical task protocol; tested cohorts and ages differ. Exact sample scores, not a species-wide intelligence or self-control score. Individual variation is disclosed in each observation.'
ids=['cylinder_treat_success','cylinder_treat_success__low']
data['traits']=[t for t in data['traits'] if t['id'] not in ids]
for tid,label,direction,counter in [(ids[0],'Most successful in a treat puzzle','higher_wins',ids[1]),(ids[1],'Least successful in a treat puzzle','lower_wins',ids[0])]:
 data['traits'].append({'id':tid,'displayName':label,'unit':'%','definition':basis,'measurementBasis':basis,'canonicalSourceId':sid,'eligibilityGroups':[],'direction':direction,'separationMethod':'positive_ratio_5_percent','gameplayFamily':'cognition-task','metricKey':'cylinder-treat-puzzle','categoryKind':'intuitive','prototypeCategory':True,'counterTraitId':counter,'playerHint':'Correct first attempts at getting a treat around a clear barrier. Study scores, not IQ.'})
data['values']=[v for v in data['values'] if v['traitId'] not in ids];audit=[]
for name,aid in names.items():
 group=[(i+2,r) for i,r in enumerate(rows) if r['Species']==name];nums=[float(r['Test % Correct']) for i,r in group]
 assert len(nums)>=5 and all(0<=n<=100 for n in nums)
 mean=statistics.mean(nums)
 note=f'Author dataset rows {",".join(str(i) for i,r in group)}; N={len(nums)} measured individuals. Individual scores range {min(nums):g}–{max(nums):g}%. Rank is the exact arithmetic mean of this tested cohort. No missing scores filled; no population IQ inference; no uncertainty interval was published for the mean. Original study DOI: 10.1073/pnas.1323533111.'
 for tid in ids:data['values'].append({'animalId':aid,'traitId':tid,'valueNumeric':mean,'unit':'%','sex':'tested cohort; sex composition differs','lifeStage':'study cohort; ages not standardized','measurementBasis':basis,'sourceId':sid,'observationType':'observed','confidence':'approved','uncertaintyStatus':'not-reported','uncertaintyKind':'not-reported','sampleSizeCategory':str(len(nums)),'sourceQuality':'primary experimental individual data','notes':note})
 audit.append({'animalId':aid,'sourceLabel':name,'n':len(nums),'mean':mean,'individualMin':min(nums),'individualMax':max(nums),'sourceRows':[i for i,r in group]})
(P/'pilot.json').write_text(json.dumps(data,indent=2)+'\n')
(P/'research/cognition-cohort-audit.json').write_text(json.dumps({'sourceUrl':source['url'],'paper':'https://doi.org/10.1073/pnas.1323533111','rawExtractionSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rawProvenance':'Original raw field strings restored from research checkpoint. CSV reserialized; not claimed byte-identical to the original download.','exclusions':'Ambiguous common species labels, modeled cognitive scores, composite IQ and incomplete specimens excluded.','rankingScope':'exact tested-cohort scores; individual variation is not hidden or claimed to be a confidence bound for the mean','cohorts':audit},indent=2)+'\n')
print(json.dumps(audit))
