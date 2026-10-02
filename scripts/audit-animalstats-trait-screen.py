#!/usr/bin/env python3
"""Apply explicit editorial field decisions; observation approval remains a separate audit."""
import collections,csv,gzip,json,math
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats/research'
# Editorial mapping chosen after reading the source field lists; equivalent concepts share a key.
concepts={}
def candidate(key,labels,fields,reason,interest='intuitive'):
 for catalog,names in fields.items():
  for f in names:concepts[catalog,f]=dict(concept=key,high=labels[0],low=labels[1],interest=interest,decision='keep_candidate',reason=reason,observationApproval='pending')
candidate('mass',('Heaviest','Lightest'),{'amphibio':['Body_mass_g'],'amniote':['adult_body_mass_g'],'pantheria':['5-1_AdultBodyMass_g'],'avonet':['Mass'],'squambase':['mean female mass (g)'],'combine-reported':['adult_mass_g'],'fishbase':['Weight','WeightFemale']},'Familiar comparison. Keep mean, maximum, sex and life stage distinct; reject inferred mass and review original source. These fields do not automatically form one cross-source ranking.')
candidate('length',('Longest','Shortest'),{'amphibio':['Body_size_mm'],'pantheria':['13-1_AdultHeadBodyLen_mm'],'squambase':['maximum total length (mm)','mean female total length (mm)'],'combine-reported':['adult_body_length_mm'],'fishbase':['Length','LengthFemale'],'odonate':['body_lengths','female_body_lengths']},'Familiar concept, but total length, head-body length and sex/summary endpoints must be distinguished. No substitution for height.')
candidate('lifespan',('Longest lifespan','Shortest lifespan'),{'amphibio':['Longevity_max_y'],'amniote':['maximum_longevity_y'],'pantheria':['17-1_MaxLongevity_m'],'squambase':['Maximum Longevity (years)'],'combine-reported':['max_longevity_d'],'fishbase':['LongevityWild','LongevityCaptive']},'Separate wild/captive and maximum/typical. Retain reported years and source age-verification methods.')
candidate('offspring',('Most young per birth','Fewest young per birth'),{'amphibio':['Litter_size_min_n','Litter_size_max_n'],'amniote':['litter_or_clutch_size_n'],'pantheria':['15-1_LitterSize'],'squambase':['smallest brood','largest brood','minimum mean brood size','maximum mean brood size'],'combine-reported':['litter_size_n']},'Intuitive, but eggs, live young and brood definitions differ. One lifecycle concept, not multiple duplicate categories.')
candidate('pregnancy',('Longest pregnancy','Shortest pregnancy'),{'amniote':['gestation_d'],'pantheria':['9-1_GestationLen_d'],'combine-reported':['gestation_length_d']},'Intuitive; pregnancy includes specified developmental endpoints only. Do not compare gestation with incubation.')
candidate('incubation',('Longest wait to hatch','Shortest wait to hatch'),{'amniote':['incubation_d']},'Intuitive lifecycle fact; at most one lifecycle family on introductory boards.')
candidate('wingspan',('Largest wingspan','Smallest wingspan'),{'leptraits':['WS_U','WS_L','WS_U_Fem','WS_L_Fem','WS_U_Mal','WS_L_Mal'],'leptraits-records':['WingSpanLower_Unspecified','WingSpanUpper_Unspecified','WingSpanLower_Female','WingSpanUpper_Female','WingSpanLower_Male','WingSpanUpper_Male']},'Strong insect candidate. Consensus endpoints are aggregate values, not world records; review record-level source units and sex, duplicate taxa and all reported ranges.')
candidate('social-group',('Largest groups','Smallest groups'),{'pantheria':['10-2_SocialGrpSize'],'combine-reported':['social_group_n']},'Promising mammal behavior. Distinguish social group from population group and colony; local conditions and summary uncertainty require review.')
candidate('diet-types',('Most varied diet','Least varied diet'),{'pantheria':['6-1_DietBreadth'],'combine-reported':['det_diet_breadth_n']},'Hold front labels until dictionary checked: counts of broad food categories are not prey-species counts, diet proportions or nutritional diversity.')
candidate('home-range',('Largest territory','Smallest territory'),{'pantheria':['22-1_HomeRange_km2','22-2_HomeRange_Indiv_km2'],'combine-reported':['home_range_km2'],'squambase':['Minimum home range size (m2)','Maximum home range size (m^2)','Average home range size (minimum; m^2)','Average home range size (maximum; m^2)']},'Intuitive area comparison, but home range is not necessarily defended territory. Use home range wording in game if retained; sex, season and population vary.')
candidate('range',('Largest range','Smallest range'),{'pantheria':['26-1_GR_Area_km2'],'avonet':['Range.Size'],'squambase':['Geographic range size (GARD 1.7, Caetano et al. 2023; km^2)','Geographic range size range size (IUCN, August 2022; km^2)']},'Familiar species range concept. Historical maps and taxonomies differ; record dates, method and breeding/overall extent explicitly.')
candidate('newborn-mass',('Heaviest newborn','Lightest newborn'),{'amniote':['birth_or_hatching_weight_g'],'pantheria':['5-3_NeonateBodyMass_g'],'combine-reported':['neonate_mass_g'],'squambase':['hatchling/neonate mass (g)']},'Interesting occasional fact; neonatal/hatchling endpoints differ. Do not overfill boards with related life-history facts.','specialist')
candidate('milk-duration',('Longest time on milk','Shortest time on milk'),{'amniote':['weaning_d'],'pantheria':['25-1_WeaningAge_d'],'combine-reported':['weaning_age_d']},'Understandable but reproductive concentration risk. Species-level definitions and earliest/latest endpoints need review.','specialist')
candidate('egg-mass',('Heaviest egg','Lightest egg'),{'amniote':['egg_mass_g']},'Occasional intuitive anatomy fact; not a distinct lifecycle decision alongside several other egg metrics.','specialist')
candidate('egg-length',('Longest egg','Shortest egg'),{'amniote':['egg_length_mm']},'Specialist supplement only; egg length and width count as one anatomy family.','specialist')
candidate('tail-length',('Longest tail','Shortest tail'),{'avonet':['Tail.Length']},'Useful visual fact. Feather/tissue tail endpoints differ across groups; source definitions must match.','specialist')
candidate('beak-length',('Longest beak','Shortest beak'),{'avonet':['Beak.Length_Culmen']},'Occasional visible feature; measurement positions are specialist and must not count as separate intuitive prizes.','specialist')
candidate('reproduction-frequency',('Most broods per year','Fewest broods per year'),{'amniote':['litters_or_clutches_per_y'],'pantheria':['16-1_LittersPerYear'],'squambase':['Yearly broods (minimum)','Yearly broods (maximum)'],'combine-reported':['litters_per_year_n']},'Seasonal and lifetime definitions must agree; same lifecycle family.','specialist')
candidate('population-density',('Most crowded','Least crowded'),{'pantheria':['21-1_PopulationDensity_n/km2'],'combine-reported':['density_n_km2'],'squambase':['Minimum population density (ha^-1)','Maximum population density (ha^-1)']},'Potentially understandable, but very site/season dependent. Not total population; local-study variation could swamp species differences.','specialist')
candidate('habitat-depth',('Deepest habitat','Shallowest habitat'),{'fishbase':['DepthRangeDeep']},'Habitat occurrence limit, not diving performance. Specialist quota; confirm depth reference and uncertainty.','specialist')
candidate('hostplant-breadth',('Most food-plant families','Fewest food-plant families'),{'leptraits':['NumberOfHostplantFamilies']},'Interesting insect ecology, but specialist label and source effort bias. Larval host plants are not adult nectar diet.','specialist')
candidate('bite-force',('Strongest bite','Weakest bite'),{'insect-bite':['mean.bf.ID.geom']},'Direct voluntary bite assay. Require independent sample counts, specimen ranges and matching bite position; do not compare measured force with modeled mammal bite-force estimates.')
candidate('mass',('Heaviest','Lightest'),{'animaltraits':['body mass'],'sealifebase':['Weight','WeightFemale']},'Mass is familiar; verify original units, sex, life stage and original measurement origin.')
candidate('length',('Longest','Shortest'),{'insect-bite':['mean.ID.body.l.geom'],'sealifebase':['Length','LengthFemale']},'Require source length type, sex/life stage and consistent maximum versus geometric-mean endpoint.')
candidate('lifespan',('Longest lifespan','Shortest lifespan'),{'sealifebase':['LongevityWild','LongevityCaptive']},'Preserve wild/captive basis and primary reference IDs.')
candidate('brain-mass',('Largest brain','Smallest brain'),{'animaltraits':['brain size']},'Specialist supplement; direct brain weights only, excluding volume-to-mass conversion. Not intelligence.','specialist')
candidate('metabolism',('Most resting energy use','Least resting energy use'),{'animaltraits':['metabolic rate']},'Specialist supplement only; units, temperature, basal/standard/routine state and acclimation differ.','specialist')

# All other fields are deliberately retained for provenance/context, not promoted into prizes.
rows=[];counts=collections.Counter();coverage={}
for filename in ['broad-catalog-manifest.json','gap-source-manifest.json','manifest.json']:
 source=json.loads((P/filename).read_text());catalogs=source.get('catalogs',source)
 for catalog,meta in catalogs.items():
  for field,n in meta.get('fieldCoverage',meta.get('numericCoverage',{})).items():
   decision=concepts.get((catalog,field))
   if decision is None:
    f=field.lower()
    if catalog=='disperse':reason='Fuzzy-coded bands and mixed taxonomic ranks; cannot support exact species rankings.';status='reject_numeric_prize'
    elif any(s in f for s in ['derived from allometric','_ext','mass_equation','vulnerability','pd50']):reason='Modeled, extrapolated or derived estimate; excluded from measured gameplay.';status='reject_numeric_prize'
    elif catalog=='globtherm':reason='Thermal endpoints and methods differ (CTmax, lethal limits, thermoneutral bounds); retain for protocol review, no pooled heat/cold-tolerance ranking.';status='hold'
    elif catalog=='carnidiet' and field in {'scientificNamePrey','percentage','foodType'}:reason='Retain diet evidence. Study effort and incompatible frequency/biomass measures prevent a direct global diet-diversity ranking.';status='hold'
    elif any(s in f for s in ['svl','forearm','tarsus','kipps','nares','brain','maturity','interbirth','inter_litter','trophic','elevation','altitude','wing.length','forewing','hindwing']):reason='Specialist endpoint or abstract ecological proxy; not selected for the intuitive pool. Preserve for later selective review.';status='defer_specialist'
    else:reason='Taxonomy, provenance, nominal category, source context or unselected specialist field. No numerical prize or assumed ordering.';status='context_only'
    decision=dict(concept='',high='',low='',interest='not selected',decision=status,reason=reason,observationApproval='not approved')
   counts[decision['decision']]+=1;rows.append(dict(catalog=catalog,field=field,nonMissing=n,**decision))
with (P/'screened-traits.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
# Count positive parseable values only as a screening indicator, not source approval.
for catalog in sorted({x['catalog'] for x in rows if x['decision']=='keep_candidate'}):
 selected={x['field'] for x in rows if x['catalog']==catalog and x['decision']=='keep_candidate'};num=collections.Counter()
 for line in gzip.open(P/(catalog+'.jsonl.gz'),'rt'):
  r=json.loads(line)
  for field in selected:
   try:v=float(r['measurements'].get(field))
   except (TypeError,ValueError):continue
   if math.isfinite(v) and v>0:num[field]+=1
 coverage[catalog]=dict(num)
(P/'trait-screen-summary.json').write_text(json.dumps(dict(scope='Field-level editorial screening, not observation-level validation',fields=len(rows),decisions=dict(counts),distinctCandidateConcepts=len({x['concept'] for x in rows if x['decision']=='keep_candidate'}),numericCandidateCoverage=coverage,gameApproved=0),indent=2)+'\n')
print('Screened',len(rows),'fields;',dict(counts),'concepts',len({x['concept'] for x in rows if x['decision']=='keep_candidate'}))
