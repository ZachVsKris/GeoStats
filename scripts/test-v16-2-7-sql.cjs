const fs=require('fs');
const path=require('path');
const fail=(m)=>{console.error('FAIL:',m);process.exitCode=1};
const migrationNames=[
  '054_v16_2_7_catalog_generator_rebuild.sql',
  '055_v16_2_7_macro_domain_product_exclusions_hotfix.sql',
  '056_v16_2_7_women_category_product_exclusion.sql',
  '057_v16_2_7_durable_editorial_enforcement.sql',
  '058_v16_2_7_legacy_reaudit_circular_block_hotfix.sql',
  '059_v16_2_7_taxonomy_and_antiproliferation_hotfix.sql',
];
const migrations=migrationNames.map((name)=>({name,sql:fs.readFileSync(path.join('supabase','migrations',name),'utf8')}));
const s=migrations[0].sql;
const installer=fs.readFileSync('RUN_THIS_IN_SUPABASE_FOR_V16_2_7.sql','utf8');
for(const {name,sql} of migrations){
  if(!/^begin;/m.test(sql)||!/commit;\s*$/m.test(sql)) fail(`${name} is not transaction wrapped`);
  if(!installer.includes(`-- BEGIN ${name}\n${sql.trimEnd()}\n-- END ${name}`)) fail(`one-file installer is missing exact ${name} content`);
}
if(!installer.startsWith('-- GeoStats v16.2.7 complete one-file Supabase installer.')) fail('one-file installer generated header missing');
if(!s.includes("eligible_universe_type,'universal') universe_type")) fail('ranking audit does not read eligible universe');
if(!s.includes("universe_type='defined_subset'")) fail('defined-subset ranking rule missing');
if(!s.includes("ranking_direction='low'")) fail('lowest-wins universal fail-closed rule missing');
if(!s.includes("decision_class='legacy_generic_exclusion' and not p.durable")) fail('legacy re-audit does not distinguish durable exclusions');
if(!s.includes('stage_v16_2_7_candidate_catalog')) fail('candidate staging function missing');
if(!s.includes('stagedForReachabilityV16_2_7')) fail('staging does not mark audited candidate state');
if(!s.includes("not r.reachable")) fail('release assertion does not block unreachable categories');
if(!s.includes("count(*)=3")) fail('release assertion does not require all three difficulty proofs');
if(!s.includes("not (c.enabled and c.eligible_daily)")) fail('routine refresh does not preserve non-public staging');
if(!s.includes("having count(*)=3 and bool_and(r.reachable)")) fail('routine refresh can activate a new category without all-mode proof');
if(!s.includes("hashtext('geostats-v16.2.7-finalize-catalog')")) fail('v16.2.7 atomic finalizer override missing');
const assertPos=s.indexOf('perform public.assert_v16_2_7_release();', s.indexOf("hashtext('geostats-v16.2.7-finalize-catalog')"));
const publishPos=s.indexOf('set enabled=v.computed_playable_v16_2,eligible_daily=v.computed_playable_v16_2', s.indexOf("hashtext('geostats-v16.2.7-finalize-catalog')"));
if(assertPos<0||publishPos<0||assertPos>publishPos) fail('finalizer publishes before the v16.2.7 release assertion');
const hotfixes=migrations.slice(1).map(({sql})=>sql).join('\n');
if(!hotfixes.includes('v16.2.7 durable product decision')) fail('durable product-exclusion hotfixes missing');
if(!hotfixes.includes('legacy_generic_exclusion')) fail('legacy circular-block recovery hotfix missing');
if(!hotfixes.includes('food-agriculture')) fail('corrected macro-domain taxonomy hotfix missing');
if(!hotfixes.includes('greenhouse-gas subcomponent')) fail('anti-proliferation hotfix missing');
if(!process.exitCode) console.log('GeoStats v16.2.7 SQL policy and installer-sync checks passed.');
