"""Build a complete, conservative editorial review from acquired research."""
import collections,csv,html,json,pathlib,math
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats';R=P/'research'
rows=list(csv.DictReader((R/'expanded-category-register.csv').open()))
discovery_path=R/'discovery-category-register.csv'
if discovery_path.exists():rows+=list(csv.DictReader(discovery_path.open()))
# Explicit editorial decisions: relevance is independent of scientific credibility.
KEEP=set('mass length height wingspan tail-length newborn-mass egg-mass maximum-speed travel-speed acceleration jump-height jump-distance migration-distance nonstop-journey daily-distance flight-altitude dive-depth dive-duration bite-force call-loudness food-class-breadth prey-species-breadth hostplant-breadth daily-food-mass fasting-duration water-independence heat-tolerance cold-tolerance social-group-size colony-size nest-width nest-mass building-time burrow-length burrow-depth mound-height dam-length global-abundance population-change threat-category range-loss tooth-count leg-count ear-length horn-length antler-length eye-diameter fur-length sleep-duration lifespan maturity-age growth-rate metamorphosis-duration pregnancy-duration incubation-duration offspring-count milk-duration care-duration reproduction-frequency seasonal-weight-change range-area country-count continent-count home-range fossil-first-occurrence description-year domestication-date extinction-date'.split())
REJECT={
'relative-growth':'A normalized growth metric is too abstract for the main prize pool; absolute growth remains a candidate.',
'nest-height':'Placement height is not nest height or nest size; remove ambiguous prize wording.',
'brain-mass':'Too specialist for the main pool and cannot serve as an intelligence ranking.',
'relative-pull':'Relative pulling performance is too niche and current evidence is single-species.',
'learning-trials':'No acquired standardized learning dataset supports this label; A-not-B training trials are not interchangeable learning ability.'}
SPECIAL=set('relative-growth highest-audible-frequency lowest-audible-frequency hearing-threshold odor-detection odor-discrimination local-density torpor-duration relative-jump relative-bite relative-pull turn-radius turn-speed egg-length brain-mass beak-length maximum-elevation habitat-depth cylinder-task a-not-b-task learning-trials wound-closure tail-regrowth larval-duration relative-food-intake'.split())
CURRENT={'mass':['mass'],'length':['length'],'wingspan':['wingspan'],'tail-length':['tail'],'newborn-mass':['birth_weight','raw_birth_mass'],'egg-mass':['raw_egg_mass'],'lifespan':['lifespan'],'maturity-age':['maturity'],'pregnancy-duration':['pregnancy'],'incubation-duration':['incubation'],'offspring-count':['offspring'],'milk-duration':['weaning'],'reproduction-frequency':['breeding'],'range-area':['range'],'home-range':['home-range'],'sleep-duration':['sleep'],'dive-duration':['dive-duration'],'beak-length':['beak-length']}
pilot=json.loads((P/'pilot.json').read_text());traits=pilot['traits'];values=pilot['values']
updates={'eye-diameter':('eyes-vertebrates.csv','Axial_diameter_mm','Dataset_name','Eye axial diameter (mm), kept separate from corneal/transverse diameter; no predictions.'),'building-time':('nest-Dataset-S1.csv','Building time average (days)','Species scientific name','Average nest construction time (days), kept separate from bounds.'),'nest-width':('nest-Dataset-S1.csv','Nest size','Species scientific name','Size is prose; diameter, height, length and volume must be extracted separately.'),'ear-length':('FRUGINT','Ear_length','Frug_species','Only six source rows; mixed units and aggregation require original-reference audit.'),'fur-length':('pollinators-bee_trait_20240922.csv','HairLength_F','Species','Bee hair length is not mammal fur length; units and method unresolved. No substitution.')}
evidence={}
for name,field,taxon in [(x[0],x[1],x[2]) for x in updates.values() if x[0] not in ('FRUGINT',)]:
 b=(P/'source'/name).read_bytes()
 for enc in ('utf-8-sig','cp1252','latin1'):
  try:text=b.decode(enc);break
  except UnicodeDecodeError:pass
 import io
 rr=list(csv.DictReader(io.StringIO(text),delimiter=';' if 'pollinators' in name else ',')); numeric=[]
 for row in rr:
  try:v=float(row.get(field,'').replace(',','.'))
  except (ValueError,AttributeError):continue
  if math.isfinite(v):numeric.append(row)
 evidence[(name,field)]={'numeric_rows':len(numeric),'source_taxon_labels':len({x[taxon] for x in numeric if x.get(taxon)}),'group_counts':dict(collections.Counter(x.get('Group','birds' if 'nest-' in name else 'bees') for x in numeric))}
for row in rows:
 id=row['id'];decision='keep' if id in KEEP else 'hold';reason='Strong intuitive concept; retain for review, subject to the evidence gate.' if decision=='keep' else 'Optional specialist concept or insufficiently defined broad comparison; defer pending better evidence.'
 if id in REJECT:decision='reject';reason=REJECT[id]
 if row.get('discovery_evidence'):decision=row['recommendation'];reason=row['recommendation_reason']
 row['recommendation']=decision;row['recommendation_reason']=reason;row['interest']='specialist' if id in SPECIAL else row['interest'];row['interest_score']='5' if row['interest']=='intuitive' else '2';row['interest_scale']='Editorial 1–5; 5 immediately understandable, 2 specialist. Not player-tested.'
 ids={t['id'] for t in traits if t.get('metricKey') in CURRENT.get(id,[]) or t['id'] in CURRENT.get(id,[])}
 row['existing_local_concept']='yes' if ids else 'no';row['local_observation_animals']=str(len({v['animalId'] for v in values if v['traitId'] in ids}));row['evidence_readiness']='acquired but endpoint audit incomplete' if row['status']=='downloaded_source_requires_endpoint_audit' else 'source located; comparable data not acquired' if row['status']=='evidence_lead' else 'insufficient comparable evidence';row['verified_new_numeric_rows']='';row['verified_new_taxon_labels']='';row['verified_group_counts']='';row['verified_geography']='Not established for this endpoint; source coverage below is descriptive, not a validated distribution.'
 if id in updates:
  name,field,taxon,gate=updates[id];row['evidence_gate']=gate+' '+row['evidence_gate']
  if id!='fur-length':row['status']='downloaded_source_requires_endpoint_audit';row['evidence_readiness']='acquired; original-reference/definition audit required';row['source_ids']+=';'+name
  if (name,field) in evidence:
   e=evidence[(name,field)];row['verified_new_numeric_rows']=str(e['numeric_rows']);row['verified_new_taxon_labels']=str(e['source_taxon_labels']);row['verified_group_counts']=json.dumps(e['group_counts'])
  if id=='eye-diameter':row['source_urls']='https://github.com/knthomas/anuran-eye-size';row['coverage']='Measured axial-diameter subset across vertebrate groups; counts verified below.'
  if id in ('nest-width','building-time'):row['source_urls']='https://github.com/catherinesheard/global-nest-data';row['coverage']='Birds only; global compilation. Construction-time subset geography not yet verified.'
  if id=='ear-length':row['source_urls']='https://zenodo.org/records/18016801';row['coverage']='16 mammal rows from Spain; six ear-length cells; inadequate varied board coverage alone.';row['verified_geography']='Spain / Doñana compilation; not global.'
 row['source_assessment']='Comparative catalog/research source located; author, method, original references and measurement provenance must be checked per endpoint. Credibility does not certify comparability.';row['manual_decision']='awaiting_user_review';row['game_approved']='False'
 if id in ('heart-rate','breathing-rate','breath-volume','heart-stroke-volume','resting-energy'):row['coverage']='Aquatic and terrestrial mammals; source conditions audited, original references still pending.';row['verified_geography']='Study sites not yet consolidated; aquatic versus terrestrial is not geographic spread.'
 if id=='heart-rate':row['verified_new_numeric_rows']='32';row['verified_new_taxon_labels']='31';row['verified_group_counts']='Mammals; adult/resting/unsedated filter only.'
 if id=='breathing-rate':row['verified_new_numeric_rows']='76';row['verified_new_taxon_labels']='76';row['verified_group_counts']='Mammals; adult/resting/unsedated filter only.'
 if id=='vocal-repertoire':row['coverage']='Acquired bird and primate tables; distinct species and call-type definition audit pending.'
 if id=='prey-mass':row['coverage']='108 mammalian carnivores reported in source; PDF table acquired, values not extracted yet.'
 if id=='whisker-length':row['coverage']='Eleven small nonflying mammal species in experiment; specimen/whisker identity audit pending.'
 if id in ('eye-opening-age','teat-count','dispersal-age','newborn-length'):row['coverage']='Worldwide mammal catalog already acquired; valid reported observations must be separated from estimates and missing values.'
 # All reverse labels must be nonidentical; eligibility stays shared.
 assert row['high_label'] and row['high_label']!=row['low_label']
assert len({r['id'] for r in rows})==len(rows)
# Additional extraction counts remain pending, never certify game eligibility.
audit_path=R/'expansion-endpoint-audit.csv'
if audit_path.exists():
 audits={a['concept']:a for a in csv.DictReader(audit_path.open())}
 for row in rows:
  a=audits.get(row['id'])
  if not a:continue
  row['verified_new_numeric_rows']=a['numeric_rows']
  row['verified_new_taxon_labels']=a['source_taxon_labels']
  row['coverage']='Extracted source labels, not unique specimens or globally balanced coverage. Units: '+a['units']
  row['evidence_readiness']='Numeric candidates extracted; no certified fair-board pool yet.'
  row['source_assessment']=a['remaining_gates']
  row['evidence_gate']+=' '+a['remaining_gates']
behavior_path=R/'behavior-evidence-summary.json'
if behavior_path.exists():
 report=json.loads(behavior_path.read_text())
 mapping={'chewing-rate':['chewing-rate'],'eye-diameter':['eye-axial-size'],'torpor-duration':['torpor-bout-duration'],'dive-duration':['dive-duration'],'cylinder-task':['self-control-cylinder'],'a-not-b-task':['self-control-a-not-b']}
 endpoints={e['concept']:e for e in report['endpoints']}
 for row in rows:
  matches=[endpoints[c] for c in mapping.get(row['id'],[]) if c in endpoints]
  if not matches:continue
  row['verified_new_numeric_rows']=str(sum(e['numeric_rows'] for e in matches))
  row['verified_new_taxon_labels']='; '.join(str(e['source_taxon_labels']) for e in matches)
  row['evidence_readiness']='Traceable numeric candidates extracted; protocol and uncertainty audit pending.'
  row['source_assessment']='Source observations kept separately with row locations, original references and conditions. No species aggregation, inferred values or gameplay approval.'
with (R/'category-editorial-review.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(dict.fromkeys(k for r in rows for k in r)));w.writeheader();w.writerows(rows)
summary={'concepts':len(rows),'proposed_prize_categories':sum(1+bool(r['low_label']) for r in rows),'recommendations':dict(collections.Counter(r['recommendation'] for r in rows)),'interest':dict(collections.Counter(r['interest'] for r in rows)),'new_game_approvals':0,'verified_endpoint_counts':{f'{k[0]}:{k[1]}':v for k,v in evidence.items()},'balance':json.loads((R/'animal-group-balance.json').read_text()),'limits':['Keep is an editorial recommendation, not data or game approval.','No concept duplicates or reversed endpoints counted as new concepts.','Numeric rows are not independent animals; no source values averaged or imputed.','Global group/geographic balance remains unverified for most endpoints.','Existing local concept mapping is conservative and does not certify existing values.']}
(R/'category-editorial-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
DATA=json.dumps(rows,ensure_ascii=False).replace('</','<\\/')
page='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AnimalStats category review</title><style>body{font:16px system-ui;margin:30px auto;max-width:1150px;padding:0 20px;background:#fffdf5;color:#263327}h1{font-size:30px}input,select{padding:10px;margin:5px;border:1px solid #aaa;border-radius:7px}.card{border:1px solid #ddd;border-radius:12px;padding:18px;margin:14px 0;background:white}.pair{font-size:20px;font-weight:700}.tag{font-size:13px;background:#edf4df;padding:4px 7px;border-radius:5px}p{line-height:1.5}summary{cursor:pointer}small{color:#536151}</style><h1>AnimalStats category review</h1><p>__CONCEPTS__ measurement/attribute concepts, proposing __PRIZES__ prize categories. Opposites stay together and each counts separately; one-sided categories are allowed. “Keep” means worth pursuing; it does not mean ready to play. No new game categories are approved by this review.</p><p><b>Balance gap:</b> current playable pool has 35 mammals, 31 birds, 6 reptiles and 5 fish (sharks). Insects and spiders are absent. Large research catalogs do not establish balanced playable boards. Geographic balance is still unverified for most endpoints.</p><input id="q" placeholder="Search prizes, sources, animals…" aria-label="Search"><select id="decision"><option value="">All recommendations</option><option>keep</option><option>hold</option><option>reject</option></select><select id="interest"><option value="">All interest levels</option><option>intuitive</option><option>specialist</option></select><select id="existing"><option value="">All concepts</option><option value="no">Potential additions</option><option value="yes">Existing local concepts</option></select><p id="count"></p><main id="cards"></main><script>const q=document.getElementById('q'),decision=document.getElementById('decision'),interest=document.getElementById('interest'),existing=document.getElementById('existing'),count=document.getElementById('count'),cards=document.getElementById('cards');const rows=__DATA__;function esc(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}function render(){const subset=rows.filter(r=>(!decision.value||r.recommendation===decision.value)&&(!interest.value||r.interest===interest.value)&&(!existing.value||r.existing_local_concept===existing.value)&&JSON.stringify(r).toLowerCase().includes(q.value.toLowerCase()));count.textContent=subset.length+' concepts shown';cards.innerHTML=subset.map(r=>`<article class="card"><div class="pair">${esc(r.high_label)}${r.low_label?' / '+esc(r.low_label):' (one-sided)'}</div><p><span class="tag">${esc(r.recommendation)}</span> · ${esc(r.bucket)} · ${esc(r.interest)} · ${r.existing_local_concept==='yes'?'Existing local concept':'Potential addition'}</p><p>${esc(r.recommendation_reason)}</p><p><b>Evidence:</b> ${esc(r.evidence_readiness)}${r.verified_new_numeric_rows?' · '+esc(r.verified_new_numeric_rows)+' numeric rows / '+esc(r.verified_new_taxon_labels)+' source taxon labels':''}</p><p><b>Coverage:</b> ${esc(r.coverage)}</p><p><b>Required checks:</b> ${esc(r.evidence_gate)}</p><details><summary>Sources and coverage details</summary><p>${r.source_urls.split(';').map(u=>u.startsWith('https://')?'<a target="_blank" rel="noopener" href="'+esc(u)+'">'+esc(u)+'</a>':esc(u)).join('<br>')}</p><p>${esc(r.source_assessment)}</p><p>Verified groups: ${esc(r.verified_group_counts||'Not established for this endpoint')}</p><p>Geography: ${esc(r.verified_geography)}</p><small>Paired prizes reverse the same eligible observations; one-sided attributes require their own eligibility check. Editorial interest score ${r.interest_score}/5; not player-tested.</small></details></article>`).join('')}document.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',render));render();</script>'''.replace('__DATA__',DATA).replace('__CONCEPTS__',str(summary['concepts'])).replace('__PRIZES__',str(summary['proposed_prize_categories']))
(R/'AnimalStats_Category_Review.html').write_text(page)
print(json.dumps(summary,indent=2))
