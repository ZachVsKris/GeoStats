#!/usr/bin/env python3
"""Deterministic structural category-propensity audit for v16.2.5 vs v16.2.6.

This deliberately isolates category-selection policy from country/winner search. The full
production generator remains protected by scripts/test-v15-7-generator.cjs. We simulate
1,000 continuous Daily trios (Scout 4 + Adventurer 4 + Expert 6 = 14 unique category
slots/day) and retain the exact 21-day category history across the run.
"""
from __future__ import annotations
import csv, json, math, random
from collections import Counter, defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/'V16_2_6_MASTER_TRACKER.csv'; OUT=ROOT/'artifacts'/'v16-2-6-propensity'; OUT.mkdir(parents=True,exist_ok=True)
DAYS=1000; SLOTS=14; SEED=1626

def load_pool():
    with MASTER.open(newline='',encoding='utf-8') as f: rows=list(csv.DictReader(f))
    existing=[r for r in rows if r['scope_type']=='existing_playable' and not any(x in r['final_disposition'] for x in ('removed','rejected','excluded','invalid'))]
    expanded=existing+[r for r in rows if r['scope_type']!='existing_playable' and r['final_disposition'] in {'ready_for_validated_import','ready_when_official_bulk_input_validates'}]
    return existing,expanded

def family(r): return (r.get('semantic_family') or r.get('domain') or r['tracker_id']).strip().lower()
def bucket(r): return (r.get('experience_bucket') or r.get('domain') or 'general').strip().lower()
def priority(r): return (r.get('generation_priority_final') or r.get('generation_priority_candidate') or 'standard').strip().lower()

def weight_v15(r,day,last_seen):
    # Recovered v16.2.5 behavior explicitly favored physical geography and had no category-history penalty.
    b=bucket(r); d=(r.get('domain') or '').lower()
    return 2.3 if ('physical geography' in b or 'geograph' in d) else 1.0

def weight_v16(r,day,last_seen):
    p={'anchor':3.6,'standard':2.0,'specialty':0.9}.get(priority(r),2.0)
    last=last_seen.get(r['tracker_id'])
    if last is not None:
        gap=day-last
        # Frozen v16.2.6 release rule: 0–3 very strong, 4–7 strong, 8–14 moderate, 15–21 light, 22+ none.
        penalty=18 if gap<=3 else 10 if gap<=7 else 4 if gap<=14 else 1.25 if gap<=21 else 0
        p/=1+penalty
    return p

def weighted_order(rng,eligible,weights):
    # Efraimidis-Spirakis weighted random order, deterministic under SEED.
    scored=[]
    for r,w in zip(eligible,weights):
        w=max(1e-9,w); scored.append((-math.log(max(1e-12,rng.random()))/w,r))
    scored.sort(key=lambda x:x[0]); return [r for _,r in scored]

def simulate(name,pool,weight_fn):
    rng=random.Random(SEED+(0 if name=='v16.2.5' else 626)); last_seen={}; counts=Counter(); fam_counts=Counter(); bucket_counts=Counter(); gaps=[]; failures=[]; days=[]
    for day in range(DAYS):
        selected=[]; used=set(); used_families=Counter(); used_buckets=Counter()
        # Select all 14 slots uniquely. Hard one-per-semantic-family is preferred; bounded relaxation prevents pathological dead ends.
        for slot in range(SLOTS):
            eligible=[r for r in pool if r['tracker_id'] not in used]
            weights=[]
            for r in eligible:
                w=weight_fn(r,day,last_seen)
                if used_families[family(r)]>=1: w*=0.08
                if used_buckets[bucket(r)]>=3: w*=0.25
                weights.append(w)
            order=weighted_order(rng,eligible,weights)
            if not order: failures.append(day); break
            pick=order[0]; selected.append(pick); used.add(pick['tracker_id']); used_families[family(pick)]+=1; used_buckets[bucket(pick)]+=1
        if len(selected)!=SLOTS: continue
        ids=[]
        for r in selected:
            cid=r['tracker_id']; ids.append(cid); counts[cid]+=1; fam_counts[family(r)]+=1; bucket_counts[bucket(r)]+=1
            if cid in last_seen: gaps.append(day-last_seen[cid])
            last_seen[cid]=day
        days.append(ids)
    top=counts.most_common(); total=sum(counts.values()); reached=len(counts)
    def share(n): return round(100*sum(v for _,v in top[:n])/total,3) if total else 0
    return {
      'version':name,'days_requested':DAYS,'days_completed':len(days),'slots_per_day':SLOTS,'total_category_slots':total,'pool_size':len(pool),
      'catalog_reach_count':reached,'catalog_reach_pct':round(100*reached/len(pool),3),'never_reached':sorted(set(r['tracker_id'] for r in pool)-set(counts)),
      'top10_share_pct':share(10),'top25_share_pct':share(25),'top50_share_pct':share(50),'most_exposed':top[:25],
      'repeat_intervals':{'le_3_days':sum(g<=3 for g in gaps),'le_7_days':sum(g<=7 for g in gaps),'median_days':(sorted(gaps)[len(gaps)//2] if gaps else None)},
      'family_exposure':fam_counts.most_common(),'bucket_exposure':bucket_counts.most_common(),'failures':failures,
    }

def main():
    base,new=load_pool(); a=simulate('v16.2.5',base,weight_v15); b=simulate('v16.2.6',new,weight_v16)
    report={'audit_type':'structural_category_policy_simulation','production_generator_regression':'scripts/test-v15-7-generator.cjs','seed':SEED,'daily_trio_geometry':'4+4+6','baseline':a,'v16_2_6':b}
    (OUT/'PROPENSITY_1000_DAY_COMPARISON.json').write_text(json.dumps(report,indent=2,sort_keys=True)+'\n')
    with (OUT/'PROPENSITY_1000_DAY_SUMMARY.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f,lineterminator='\n'); w.writerow(['version','days','pool_size','reach_pct','top10_share_pct','top25_share_pct','top50_share_pct','repeat_le_3','repeat_le_7','failures'])
        for x in (a,b): w.writerow([x['version'],x['days_completed'],x['pool_size'],x['catalog_reach_pct'],x['top10_share_pct'],x['top25_share_pct'],x['top50_share_pct'],x['repeat_intervals']['le_3_days'],x['repeat_intervals']['le_7_days'],len(x['failures'])])
    assert a['days_completed']==DAYS and b['days_completed']==DAYS and not a['failures'] and not b['failures']
    assert b['top10_share_pct'] < a['top10_share_pct'],(a['top10_share_pct'],b['top10_share_pct'])
    assert b['repeat_intervals']['le_3_days'] < a['repeat_intervals']['le_3_days'],(a['repeat_intervals'],b['repeat_intervals'])
    print(json.dumps({'baseline':{k:a[k] for k in ('pool_size','catalog_reach_pct','top10_share_pct','top25_share_pct')},'v16.2.6':{k:b[k] for k in ('pool_size','catalog_reach_pct','top10_share_pct','top25_share_pct')},'repeat_le_3':[a['repeat_intervals']['le_3_days'],b['repeat_intervals']['le_3_days']]},indent=2))
if __name__=='__main__': main()
