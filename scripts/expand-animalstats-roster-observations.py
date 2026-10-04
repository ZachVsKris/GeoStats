"""Extend existing approved sleep, dive and annual-space protocols to new taxa."""
import collections, csv, hashlib, io, json, math, statistics, zipfile
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'
d=json.loads((P/'pilot.json').read_text())
roster=json.loads((P/'research/roster-expansion-audit.json').read_text())
# Reconcile the whole roster, so existing animals also receive eligible rows.
A={a['scientificName'].lower():a for a in d['animals']}
T={t['id']:t for t in d['traits']}
audit={'reviewedAt':'2026-10-04','files':{},'observations':[]}
def add(a,tid,n,notes,sex='species-level',stage='adult',origin='not-specified',bounds=None):
    assert math.isfinite(n) and n>0
    t=T[tid]
    v=dict(animalId=a['id'],traitId=tid,valueNumeric=n,unit=t['unit'],sex=sex,lifeStage=stage,measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',recordOrigin=origin,notes=notes,uncertaintyStatus='reported' if bounds and bounds[0]!=bounds[1] else 'not-reported',uncertaintyKind='source-range' if bounds and bounds[0]!=bounds[1] else 'not-reported')
    if bounds and bounds[0]!=bounds[1]:v.update(valueMin=bounds[0],valueMax=bounds[1])
    d['values']=[r for r in d['values'] if (r['animalId'],r['traitId'])!=(a['id'],tid)]+[v]
    audit['observations'].append(v)
by=collections.defaultdict(list)
for r in csv.DictReader((P/'source/sleep-bu-records.csv').open()):
    a=A.get(r['SpeciesName_Reported'].lower().removesuffix(' l.'))
    try:n=float(r['N']);score=float(r['Total_lab_condition_score']);h=float(r['Total_daily_sleep'])
    except ValueError:continue
    if a and r['EEG']=='Yes' and r['Twenty_four_hour'].startswith('3') and r['Summary_age_class']=='Adult' and r['Sex']=='Mix' and n>=3 and score>=9 and 0<h<=24:by[a['id']].append((r,h))
for aid,rows in by.items():
    a=next(a for a in A.values() if a['id']==aid);nums=[n for _,n in rows]
    add(a,'daily_sleep',statistics.median(nums),'Eligible adult mixed-sex 24-hour EEG records: '+'; '.join(f"BU record {r['search_id']}; {r['Reference']}; N={r['N']}; lab score={r['Total_lab_condition_score']}" for r,_ in rows)+'. Captive sleep; source disagreement envelope is not a confidence interval.',sex='mixed',origin='captivity',bounds=(min(nums),max(nums)))
by=collections.defaultdict(dict)
with zipfile.ZipFile(P/'source/homerange-2025.zip') as z:
    for r in csv.DictReader(io.StringIO(z.read('HomeRangeData_2025_04_11.csv').decode())):
        a=A.get(r['Species'].lower())
        if not a or not all([r['Context']=='Wild',r['Life_Stage']=='Adult',r['HR_Level']=='Individual',r['HR_Span']=='Annual',r['HR_Method_Simple']=='KDE',r['Isopleth_Size']=='95',r['subspecies']=='NA']):continue
        try:n=float(r['Home_Range_km2'])
        except ValueError:continue
        if n>0:by[a['id']][(r['Study_ID'],r['Ind_ID'])]=(r,n)
for aid,records in by.items():
    if len(records)<3:continue
    a=next(a for a in A.values() if a['id']==aid);rows=list(records.values());nums=[n for _,n in rows]
    add(a,'annual_home_range',statistics.median(nums),f"{len(nums)} unique adult individuals; study IDs {', '.join(sorted({r['Study_ID'] for r,_ in rows}))}. Wild, annual individual KDE 95% only; no subspecies substitution. Full individual envelope, not uncertainty of the median or universal territory size.",origin='wild',bounds=(min(nums),max(nums)))
by=collections.defaultdict(list)
for r in csv.DictReader((P/'source/diving-2020.csv').open(encoding='latin1')):
    a=A.get(r['Species'].lower());context=(r['Remarks']+' '+r['Literature.source']).lower()
    if not a or r['Endo.vs..Ecto']!='Endotherm' or not any(s in context for s in ['foraging','free-ranging','at sea','in the wild','satellite']) or any(s in context for s in ['captiv','laboratory','aquarium','zoo_bio','hibernat','forced']):continue
    try:n=float(r['Maximum.dive.duration..min.'])
    except ValueError:continue
    if n>0:by[a['id']].append((r,n))
for aid,rows in by.items():
    a=next(a for a in A.values() if a['id']==aid);r,n=max(rows,key=lambda x:x[1])
    add(a,'field_max_dive',n,f"Largest maximum among {len(rows)} eligible field-explicit records. Primary reference: {r['Literature.source']}. Study context: {r['Remarks']}. Sampling-dependent record, not typical duration or modeled limit.",stage='species-level',origin='wild')
for name in ['sleep-bu-records.csv','homerange-2025.zip','diving-2020.csv']:
    f=P/'source'/name;audit['files'][name]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size}
(P/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
(P/'research/roster-observations-audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
print(dict(collections.Counter(v['traitId'] for v in audit['observations'])))
