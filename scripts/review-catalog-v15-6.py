#!/usr/bin/env python3
"""Export a complete v15.6 review CSV from Supabase and apply deterministic policy screens.
The script never auto-promotes a category; it rewrites/retire/demotes high-confidence cases and leaves ambiguous cases for review.
"""
import csv, os, re
from pathlib import Path
from data_pipeline.supabase import SupabaseWarehouse

REWRITES=[(re.compile(r"highest stocks traded,? total value",re.I),"Most stock trading"),(re.compile(r"safely managed drinking",re.I),"Best access to safe drinking water"),(re.compile(r"STEM graduate share",re.I),"Most graduates in STEM"),(re.compile(r"protected-land share",re.I),"Most land protected"),(re.compile(r"mapped river density",re.I),"Highest river density")]
RETIRE=[re.compile(x,re.I) for x in [r"total reserves.*(minus|excluding) gold",r"largest continuous land area",r"largest mapped land area",r"net errors and omissions",r"urban agglomerations of more than 1 million"]]

def decision(row):
    title=str(row.get('title') or '')
    code=str(row.get('source_indicator_code') or row.get('indicator_code') or '')
    source=str(row.get('source_organization') or '')
    if 'FAO' in source.upper():
        m=re.search(r"QCL:'?[^:]+:(\d+)",code,re.I)
        if m and m.group(1) not in {'5510','5513'}:
            return 'retired',title,'Non-production FAOSTAT element excluded.'
    if any(p.search(title) for p in RETIRE): return 'retired',title,'Contrived or misleading concept.'
    for p,new in REWRITES:
        if p.search(title): return 'rewrite',new,'Good concept retained with clearer player wording.'
    if len(title.split())>8 or len(title)>58: return 'quarantined',title,'Requires deliberate editorial rewrite or retirement.'
    return ('daily' if row.get('eligible_daily') else 'random'),title,'Retained pending duplicate and integrity gates.'

def main():
    url=os.environ['SUPABASE_URL']; key=os.environ.get('SUPABASE_SECRET_KEY') or os.environ['SUPABASE_SERVICE_ROLE_KEY']
    wh=SupabaseWarehouse(url,key,timeout=180)
    rows=wh.get_json('stat_categories?select=*&order=source_organization.asc,title.asc&limit=5000')
    out=Path(os.environ.get('OUTPUT','catalog-editorial-decisions-v15-6.csv'))
    fields=['category_id','source_indicator_code','original_title','player_title','player_description','decision','decision_reason','preferred_category_id','knowledge_cluster','strategy_family','broad_domain']
    with out.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for r in rows:
            d,pt,reason=decision(r)
            w.writerow({'category_id':r['id'],'source_indicator_code':r.get('source_indicator_code') or r.get('indicator_code'),'original_title':r.get('title'),'player_title':pt,'player_description':r.get('plain_language_description') or r.get('description'),'decision':d,'decision_reason':reason,'preferred_category_id':'','knowledge_cluster':(r.get('metadata') or {}).get('knowledgeCluster',''),'strategy_family':(r.get('metadata') or {}).get('strategyFamily',''),'broad_domain':(r.get('metadata') or {}).get('broadDomain','')})
    print(f'Wrote {len(rows)} decisions to {out}')
if __name__=='__main__': main()
