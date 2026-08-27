const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root,f),'utf8');
const exists = (f) => fs.existsSync(path.join(root,f));
const failures=[]; const check=(c,m)=>{if(!c) failures.push(m)};
const pkg=JSON.parse(read('package.json')); const version=read('lib/version.ts');
check(pkg.version==='16.2.6','package version is not 16.2.6');
check(version.includes('APP_VERSION = "16.2.6"') && version.includes('RULES_VERSION = "16.2.6"'),'app/rules version mismatch');
check(version.includes('SCORING_VERSION = "placements-v16.2.4"'),'scoring model must remain placements-v16.2.4');
for (const f of [
  'supabase/migrations/047_v16_2_6_full_release.sql','RUN_THIS_IN_SUPABASE_FOR_V16_2_6.sql','VERIFY_V16_2_6.sql','ROLLBACK_V16_2_6.sql',
  'V16_2_6_INSTALLATION.md','RELEASE_NOTES_V16_2_6.md','VALIDATION_V16_2_6.md','V16_2_6_MASTER_TRACKER.csv','V16_2_6_RELEASE_TRACKER.csv',
  '.github/workflows/import-v16-2-6-expansion.yml',
]) check(exists(f), `${f} missing`);
const playable=read('lib/playableCatalog.ts');
check(!/HARD_RETIRED_CATEGORY_IDS[\s\S]*natural-earth:northernmost-country/.test(playable),'Northernmost country is still hard-retired');
check(!/HARD_RETIRED_CATEGORY_IDS[\s\S]*natural-earth:southernmost-country/.test(playable),'Southernmost country is still hard-retired');
check(playable.includes('Largest population in the largest city'),'largest-city absolute title correction missing');
check(!playable.includes('[/^Largest population in largest city$/i, "Highest share living in largest city"]'),'incorrect largest-city share rewrite remains');
const results=read('components/GeoSecondComingGame.tsx');
for (const token of ['World Rank','globalRank']) check(results.includes(token), `Results world-rank implementation missing ${token}`);
const randomLayout=read('app/random/layout.tsx');
check(randomLayout.includes('internalTesterAccess') && randomLayout.includes('redirect("/daily")'),'Random route is not private QA');
const seeded=read('app/api/seeded/[difficulty]/route.ts');
check(seeded.includes('internalTesterAccess'),'Random/seeded API lacks server-side tester authorization');
const analytics=read('lib/analytics.ts');
check(analytics.includes('utmSource') && analytics.includes('visitorState'),'analytics acquisition/new-returning metadata missing');
const apiAnalytics=read('app/api/analytics/events/route.ts');
check(apiAnalytics.includes('utm_source') && apiAnalytics.includes('visitor_state'),'analytics API schema fields missing');
const admin=read('app/admin/AdminDashboard.tsx');
check(admin.includes('Average %') && admin.includes('Integrity-blocked'),'Admin terminology cleanup missing');
check(admin.includes('normalized title-token overlap'),'similarity labeling remains misleading');
const sourceRegistry=read('lib/sourceRegistry.ts'); const dataSources=read('lib/dataSources.ts'); const trust=read('lib/categoryTrust.ts');
for (const id of ['unwpp','worldbankclimate','imfweo','unescoich','noaatsunami','aquastat','faofisheries','usgsminerals','whoghed','undesamigrant','wtoservices','untourismdirect']) {
  check(sourceRegistry.includes(`${id}:`), `source registry missing ${id}`);
  check(dataSources.includes(`"${id}"`), `runtime data source router missing ${id}`);
  check(trust.includes(`case "${id}"`), `category trust routing missing ${id}`);
}

const masterRows=read('V16_2_6_MASTER_TRACKER.csv').trim().split(/\r?\n/);
const releaseRows=read('V16_2_6_RELEASE_TRACKER.csv').trim().split(/\r?\n/);
check(masterRows.length===534,`master tracker must contain header + 533 resolved rows; got ${masterRows.length}`);
check(releaseRows.length>=32,`release tracker must contain header + resolved workstreams; got ${releaseRows.length}`);
check(!read('V16_2_6_MASTER_TRACKER.csv').includes('pending_source_validation'),'master tracker still contains obsolete pending-source statuses');
check(!read('V16_2_6_RELEASE_TRACKER.csv').match(/,pending(?:,|\r?$)/m),'release tracker still contains pending status');
for (const verifier of [...sourceRegistry.matchAll(/verifier:\s*"([^"]+)"/g)].map((m)=>m[1])) {
  if (!verifier.startsWith('scripts/')) continue;
  const script=verifier.split(/\s+/)[0];
  check(exists(script),`source registry verifier does not exist: ${verifier}`);
}

const integrity=read('scripts/data_pipeline/integrity.py');
for (const token of ['100,000','currency','denominator','percentage']) check(integrity.toLowerCase().includes(token.toLowerCase()), `comparability integrity logic missing ${token}`);
const recovery=read('scripts/recover-world-bank-catalog.py');
check(recovery.includes('--repair-evidence') && recovery.includes('v16_2_6_same_source_retry'),'same-source rejected-row retry safeguard missing');
const categoryGen=read('lib/categoryGeneration.ts'); const daily=read('lib/dailyBoardService.ts');
for (const token of ['WorldKnowledgeBucket','GenerationPriority','categoryRecencyPenalty']) check(categoryGen.includes(token), `generator exposure model missing ${token}`);
check(daily.includes('maxDays = 21') && daily.includes('day <= 3 ? 18') && daily.includes('day <= 7 ? 10') && daily.includes('day <= 14 ? 4') && daily.includes(': 1.25'),'21-day category history weights missing');
const css=read('app/v15-7-clean.css');
check(css.includes('v16.2.6 phone-space rebalance') && css.includes('max-height:700px'),'small-phone gameplay CSS missing');
const expansionWorkflow=read('.github/workflows/import-v16-2-6-expansion.yml');
for (const token of ['run_source naturalearth','run_source constitute','run_source ipu']) check(expansionWorkflow.includes(token), `v16.2.6 expansion workflow missing ${token}`);
if (failures.length) { console.error('GeoStats v16.2.6 static checks FAILED:\n'+failures.map(x=>' - '+x).join('\n')); process.exit(1); }
console.log('GeoStats v16.2.6 static checks passed.');
