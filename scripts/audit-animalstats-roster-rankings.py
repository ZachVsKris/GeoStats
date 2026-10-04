"""Account for every new animal against every playable ranking; never fill gaps."""
import csv, json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'
d=json.loads((P/'pilot.json').read_text()); boards=json.loads((P/'candidates.json').read_text())['boards']
roster=json.loads((P/'research/roster-expansion-audit.json').read_text())
ids={n.lower().replace(' ','_') for n in roster['newAnimals']}|{'enhydra_lutris'}
active={t for b in boards for t in b['traitIds']}
T={t['id']:t for t in d['traits']}; values={(v['animalId'],v['traitId']):v for v in d['values']}
rows=[]
for a in d['animals']:
 if a['id'] not in ids:continue
 for tid in sorted(active,key=lambda t:(T[t]['metricKey'],T[t]['direction'])):
  t=T[tid];v=values.get((a['id'],tid))
  eligible=bool(v and v['confidence']=='approved' and v['observationType']!='imputed' and v['sourceId']==t['canonicalSourceId'] and v['measurementBasis']==t['measurementBasis'] and v['unit']==t['unit'])
  rows.append(dict(animalId=a['id'],animal=a['commonName'],traitId=tid,prize=t['displayName'],status='included' if eligible else 'no-approved-comparable-record',value=v['valueNumeric'] if eligible else None,sourceId=v['sourceId'] if eligible else None))
summary=[dict(animalId=aid,includedLabels=sum(r['status']=='included' and r['animalId']==aid for r in rows),boards=sum(aid in b['animalIds'] for b in boards)) for aid in sorted(ids)]
assert all(r['includedLabels']>0 and r['boards']>0 for r in summary)
report=dict(reviewedAt='2026-10-04',playableTraitDirections=len(active),animals=len(ids),policy='Every approved comparable row belongs in full rankings, including animals outside the round. Gaps are not estimates. Rank ties are preserved.',summary=summary,rows=rows)
(P/'research/roster-ranking-coverage.json').write_text(json.dumps(report,indent=2)+'\n')
with (P/'research/roster-ranking-coverage.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print({'animalsAudited':len(ids),'prizeDirectionsChecked':len(active),'includedRows':sum(r['status']=='included' for r in rows),'unfilledGaps':sum(r['status']!='included' for r in rows)})
