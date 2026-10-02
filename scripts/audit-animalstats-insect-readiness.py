#!/usr/bin/env python3
"""Audit named insects against independent specimens and source coverage; never auto-approve."""
import collections,csv,gzip,json,math
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'
known={'Apis mellifera':'Western honey bee','Gryllus bimaculatus':'Two-spotted cricket','Locusta migratoria':'Migratory locust','Anax imperator':'Emperor dragonfly','Calopteryx splendens':'Banded demoiselle','Orthetrum cancellatum':'Black-tailed skimmer','Danaus plexippus':'Monarch butterfly','Vanessa cardui':'Painted lady','Papilio machaon':'Old World swallowtail','Morpho menelaus':'Menelaus blue morpho','Coccinella septempunctata':'Seven-spotted ladybug','Dynastes hercules':'Hercules beetle','Gromphadorhina portentosa':'Madagascar hissing cockroach','Solenopsis invicta':'Red imported fire ant'}
by=collections.defaultdict(list)
with (P/'source/insect-bite-v1-table.csv').open() as f:
 for r in csv.DictReader(f):by[r['ID'].replace('_',' ')].append(r)
coverage=collections.defaultdict(set)
for name in ['animaltraits','globtherm','leptraits','odonate']:
 for line in gzip.open(P/'research'/(name+'.jsonl.gz'),'rt'):
  r=json.loads(line)
  if r['species'] in known:coverage[r['species']].add(name)
accounts={r['scientificName']:r for r in json.loads((P/'source/adw-insect-accounts.json').read_text())}
results=[]
for species,common in known.items():
 rows=by.get(species,[]);specimens={r['specimen'] for r in rows};ranges={}
 for field in ['body.l','max.bf.specimen']:
  vals=[]
  for r in rows:
   try:v=float(r[field])
   except (ValueError,TypeError):continue
   if math.isfinite(v) and v>0:vals.append(v)
  if vals:ranges[field]=dict(min=min(vals),max=max(vals))
 result=dict(scientificName=species,commonName=common,independentBiteSpecimens=len(specimens),biteSeries=len(rows),sourceSpecimenRanges=ranges,otherCatalogs=sorted(coverage[species]),adwAccountAvailable=bool(accounts.get(species,{}).get('sections')),decision='hold',gameApproved=False)
 if rows:
  result['observedBiteForceN']=float(rows[0]['mean.bf.ID.geom']);result['observedBodyLengthMM']=float(rows[0]['mean.ID.body.l.geom'])
 result['reason']='Fewer than three independent bite specimens; do not admit this assay to gameplay.' if rows and len(specimens)<3 else 'Promising measurements; life stage/sex and uncertainty comparison require review. Anatomy plus bite does not establish a varied board.'
 results.append(result)
(P/'research/insect-readiness-review.json').write_text(json.dumps(dict(scope='Named-species readiness review; no assumptions for absent records',species=results,adwWarnings=['Honey-bee lifespan varies between workers, drones and queens; queen values cannot stand for all bees.','Hercules beetle total lifespan includes a long larval stage; distinguish adult lifespan.','Insect gestation fields may describe egg incubation or development; never import as mammalian pregnancy.','Do not mistake seasonal eggs for eggs per birth or brood.','Butterfly consensus endpoint averages are not maximum measured specimen records.']),indent=2)+'\n')
print('Reviewed',len(results),'named insects;',sum(r['independentBiteSpecimens']>=3 for r in results),'meet sample-count screen; zero automatic admissions.')
