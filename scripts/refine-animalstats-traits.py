#!/usr/bin/env python3
"""Classify independent life-history questions without changing source measurements."""
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats/pilot.json'
d=json.loads(P.read_text())
family={
 'development':['gestation','shortest_gestation','raw_gestation','raw_short_gestation','incubation','raw_incubation'],
 'offspring':['litter_size','raw_litter_size','clutch_size','raw_clutch_size','egg_clutch_size','amphibian_max_clutch','shark_litter_size','fewest_shark_pups'],
 'maturity':['female_maturity','male_maturity','earliest_female_maturity','raw_female_maturity','raw_early_female_maturity','amphibian_min_maturity'],
 'care':['weaning_age','earliest_weaning','raw_weaning_age','raw_fledging_age'],
 'breeding':['litters_per_year','interbirth_interval','raw_litter_frequency','clutches_per_year','raw_clutch_frequency','amphibian_max_events'],
 'offspring-size':['birth_weight','lightest_newborn','raw_birth_mass','hatching_mass','raw_hatching_mass','raw_egg_mass','raw_egg_length','raw_egg_width','weaning_mass','raw_weaning_mass','raw_fledging_mass']}
hints={
 'earliest_female_maturity':'Youngest age at female reproductive maturity. Lower wins.',
 'earliest_weaning':'Fewest days until the young stop depending on milk.',
 'shortest_gestation':'Fewest days spent pregnant. Lower wins.',
 'adult_body_mass':'Typical adult weight. Big portraits do not mean big animals.',
 'maximum_documented_lifespan':'The oldest documented captive record—not the average life.',
 'gestation':'Time spent pregnant, from conception to birth.',
 'raw_gestation':'Time spent pregnant, from conception to birth.',
 'litter_size':'How many young arrive in one birth—not in a year.',
 'raw_litter_size':'How many young arrive in one birth—not in a year.',
 'raw_incubation':'Days from laying an egg to hatching.',
 'raw_clutch_size':'Eggs laid in one clutch. Bigger is not always more.',
 'amphibian_max_clutch':'Largest reported number of eggs in a single clutch.',
 'amphibian_min_maturity':'Earliest reported age of reproductive maturity.',
 'female_maturity':'Reported age when females can first reproduce.',
 'raw_female_maturity':'Reported age when females can first reproduce.',
 'raw_weaning_age':'How long the young depend on milk.',
 'weaning_age':'How long the young depend on milk.',
 'raw_birth_mass':'Weight of a newborn—not the grown-up animal.',
 'birth_weight':'Weight of a newborn—not the grown-up animal.',
 'raw_egg_mass':'Weight of one egg, including its contents.',
 'frog_max_svl':'Longest recorded body, from snout to vent. Legs excluded.',
 'amphibian_max_mass':'Largest reported adult weight in the source.'}
labels={'earliest_female_maturity':'First to grow up','earliest_weaning':'Fastest off milk','shortest_gestation':'Shortest pregnancy','raw_female_maturity':'Latest start to parenthood','female_maturity':'Latest start to parenthood','amphibian_min_maturity':'First to grow up','raw_weaning_age':'Longest time on milk','weaning_age':'Longest time on milk','raw_birth_mass':'Heaviest newborn','birth_weight':'Heaviest newborn','raw_egg_mass':'Heaviest egg','amphibian_max_clutch':'Most eggs in one clutch','egg_clutch_size':'Most eggs in one clutch'}
for t in d['traits']:
 for f,ids in family.items():
  if t['id'] in ids:t['gameplayFamily']=f
 if t['id'] in hints:t['playerHint']=hints[t['id']]
 if t['id'] in labels:t['displayName']=labels[t['id']]
P.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
