#!/usr/bin/env python3
"""Write a transparent comparison audit. This script never grants daily approval."""
import json,hashlib,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/animalstats'
d=json.loads((OUT/'pilot.json').read_text());boards=json.loads((OUT/'candidates.json').read_text())['boards'];values={(v['animalId'],v['traitId']):v for v in d['values']};traits={t['id']:t for t in d['traits']};animals={a['id']:a for a in d['animals'] if a.get('entityType') != 'breed'}
report=[]
for b in boards:
 risks=[];comparisons=[]
 for tid in b['traitIds']:
  rows=[values[(a,tid)] for a in b['animalIds']];ranked=sorted(rows,key=lambda v:v['valueNumeric']);gap=min((second['valueNumeric']/first['valueNumeric']-1)*100 for first,second in zip(ranked,ranked[1:]))
  bounds=sum(v.get('valueMin') is not None and v.get('valueMax') is not None for v in rows)
  if bounds<len(rows):risks.append(f"{tid}: source does not report uncertainty bounds for {len(rows)-bounds} observations")
  if gap<15:risks.append(f'{tid}: at least one adjacent gap below 15%; needs particular scrutiny')
  if any(v.get('sampleSizeCategory') in ['small','tiny'] for v in rows):risks.append(f'{tid}: small longevity record sample')
  if 'lifespan' in tid and len({v.get('recordOrigin') for v in rows})!=1:risks.append(f'{tid}: mixed record origins')
  comparisons.append(dict(traitId=tid,minimumGapPercent=round(gap,2),sourceId=traits[tid]['canonicalSourceId'],measurementBasis=traits[tid]['measurementBasis'],observationsWithReportedBounds=bounds,observations=len(rows),origins=sorted({v.get('recordOrigin','not-specified') for v in rows})))
 report.append(dict(boardId=b['id'],mode=b['mode'],title=b.get('title',''),boardType=b['boardType'],status='hold',reasons=risks,comparisons=comparisons))
summary=dict(animals=len(d['animals']),traits=len(d['traits']),observations=len(d['values']),approvedPhotos=sum(p['approved'] for p in d['photos']),candidateBoards=len(boards),boardTypesByMode={m:dict(collections.Counter(b['boardType'] for b in boards if b['mode']==m)) for m in ['easy','normal','expert']},groupsInBoards=dict(collections.Counter(animals[a]['taxonomicGroup'] for b in boards for a in b['animalIds'])),dailyApprovedBoards=0,policy='Daily requires an explicit, content-bound approval with source, uncertainty and playability evidence. AnAge quality and sample-size flags apply to longevity, not every life-history measurement. Missing bounds never become zero uncertainty.')
(OUT/'audit.json').write_text(json.dumps(dict(summary=summary,boards=report),indent=2,ensure_ascii=False)+'\n')
print(json.dumps(summary,indent=2))
