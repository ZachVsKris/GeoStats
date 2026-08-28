#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'artifacts/v16-2-6-propensity/PROPENSITY_1000_DAY_COMPARISON.json'
assert p.exists(),'propensity artifact missing'
r=json.loads(p.read_text()); a=r['baseline']; b=r['v16_2_6']
assert a['days_completed']==1000 and b['days_completed']==1000
assert not a['failures'] and not b['failures']
assert a['total_category_slots']==14000 and b['total_category_slots']==14000
assert b['top10_share_pct'] < a['top10_share_pct']
assert b['repeat_intervals']['le_3_days'] < a['repeat_intervals']['le_3_days']
print('v16.2.6 committed 1,000-day propensity artifact checks passed.')
