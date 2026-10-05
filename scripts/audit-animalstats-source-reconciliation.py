"""Reconcile AnAge-backed release observations to the pinned original file."""
import csv, hashlib, io, json, math, zipfile
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'
d=json.loads((P/'pilot.json').read_text())
source=P/'source/anage-build-15.zip'
with zipfile.ZipFile(source) as z:
 rows={r['Genus'].lower()+'_'+r['Species'].lower():r for r in csv.DictReader(io.StringIO(z.read('anage_data.txt').decode()),delimiter='\t')}
fields={}
for names,field in [
 ('adult_body_mass smallest_adult_mass','Adult weight (g)'),
 ('maximum_documented_lifespan wild_recorded_lifespan shortest_wild_lifespan','Maximum longevity (yrs)'),
 ('gestation shortest_gestation incubation','Gestation/Incubation (days)'),
 ('litter_size clutch_size egg_clutch_size shark_litter_size fewest_shark_pups','Litter/Clutch size'),
 ('female_maturity earliest_female_maturity','Female maturity (days)'),
 ('male_maturity','Male maturity (days)'),('weaning_age earliest_weaning','Weaning (days)'),
 ('birth_weight lightest_newborn hatching_mass','Birth weight (g)'),
 ('litters_per_year clutches_per_year','Litters/Clutches per year'),
 ('interbirth_interval','Inter-litter/Interbirth interval'),('weaning_mass','Weaning weight (g)'),
 ('basal_energy','Metabolic rate (W)')]:
 for name in names.split():fields[name]=field
checked=0;errors=[];unmapped=[]
for v in d['values']:
 if v['sourceId']!='anage-15':continue
 tid=v['traitId'].removesuffix('__low');r=rows.get(v['animalId']);field=fields.get(tid)
 if not r:errors.append(dict(animal=v['animalId'],trait=tid,error='taxon missing'));continue
 if tid=='mass_specific_basal_energy':expected=float(r['Metabolic rate (W)'])/float(r['Body mass (g)'])
 elif field and r.get(field):expected=float(r[field])
 else:unmapped.append([v['animalId'],tid]);continue
 checked+=1
 if not math.isclose(v['valueNumeric'],expected,rel_tol=1e-9,abs_tol=1e-10):errors.append(dict(animal=v['animalId'],trait=tid,release=v['valueNumeric'],source=expected))
 if tid=='maximum_documented_lifespan' and r['Specimen origin']!='captivity':errors.append(dict(animal=v['animalId'],trait=tid,error='wrong lifespan origin'))
 if tid in ['wild_recorded_lifespan','shortest_wild_lifespan'] and r['Specimen origin']!='wild':errors.append(dict(animal=v['animalId'],trait=tid,error='wrong lifespan origin'))
report=dict(source='AnAge Build 15',sha256=hashlib.sha256(source.read_bytes()).hexdigest(),pinnedRowsChecked=checked,errors=errors,unmapped=unmapped,scope='Original pinned AnAge values, exact taxa, lifespan origin, and calculated mass-specific metabolic rate. Other source families require their existing extraction audits; not a fresh scientific replication.')
(P/'research/board-source-reconciliation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
assert not errors and not unmapped
