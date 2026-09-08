const fs = require('node:fs');
const assert = require('node:assert/strict');
const {load} = require('./test-catalog-recovery.cjs');
const notes = require('../audits/owner-review-2026-09-08.json');
const rows = JSON.parse(fs.readFileSync('/tmp/geostats-extremes-live-rows.json'));
const values = JSON.parse(fs.readFileSync('/tmp/geostats-owner-live-values.json'));
const {buildPlayableCategoryCatalog,buildCategoryRegistry} = load('lib/playableCatalog.ts');
const {canonicalizeDataset,validateRound} = load('lib/dataEngine.ts');
const {STATIC_COUNTRIES:countries} = load('lib/staticCountries.ts');
const {generateAnchoredRoundFromLoadedCatalog,generateDailyTrioFromLoadedCatalog} = load('lib/puzzleEngine.ts');
const {validateDailyTrio} = load('lib/dailyTrioRules.ts');
const retired = new Set(notes.filter(n=>n.action==='retire').map(n=>n.id));
retired.add("unwpp:lowest-death-rate");
const boundary = require("../audits/country-extremes-source-2026-09-08.json");
const mapping = {}, datasets = [];
for(const row of rows) {
  if(retired.has(row.id)) continue;
  const note = notes.find(n=>n.id===row.id);
  const updated = structuredClone(row);
  if(note?.action==='clarify') updated.metadata={...updated.metadata,ownerReviewTitle:note.new_title,ownerReviewDescription:note.new_description};
  const patch=boundary.categories.find(c=>c.id===row.id);
  if(patch) { updated.metadata={...updated.metadata,ownerReviewDescription:patch.description}; updated.derivation_version=boundary.derivationVersion; values[row.id]=patch.values; }
  const category = buildPlayableCategoryCatalog([updated])[0];
  assert.ok(category,row.id);
  if(note?.new_description) assert.equal(category.boardDescription,note.new_description);
  assert.ok(!/(?<=[A-Za-z])-(?=[A-Za-z])/.test(category.name),category.name);
  mapping[category.id]=row.id;
  datasets.push(canonicalizeDataset({category,year:String(row.common_year),observations:values[row.id].map(([countryId,value])=>({countryId,countryName:countries.find(c=>c.id===countryId)?.name??countryId,value:Number(value),year:String(row.common_year)}))}));
}
assert.equal(datasets.length,364);
// Preserve the original audit traversal order for deterministic solver tie breaks.
const auditOrder=JSON.parse(fs.readFileSync("/tmp/geostats-owner-live-rows.json")).map(r=>r.id);
datasets.sort((a,b)=>auditOrder.indexOf(mapping[a.category.id])-auditOrder.indexOf(mapping[b.category.id]));
const loaded={datasets,catalogSize:datasets.length,datasetLoadFailures:0,datasetLoadErrorSamples:[],qualityRejections:0,candidateSources:{}};
const retry=process.argv.includes('--retry');
const report=retry ? require('../audits/country-extremes-verification-2026-09-08.json') : {catalogSize:364,retired:50,proofs:[],days:[],failures:[]};
const failed=report.failures; if(retry) report.failures=[];
const save=()=>fs.writeFileSync('audits/country-extremes-verification-2026-09-08.json',JSON.stringify(report,null,2)+'\n');
for(const d of datasets) {
 for(const difficulty of d.category.playableDifficulties??['easy','normal','expert']) {
  if(retry && !failed.some(f=>f.id===d.category.id && f.difficulty===difficulty)) continue;
  try {
   const {round}=generateAnchoredRoundFromLoadedCatalog(countries,d.category.id,difficulty,loaded,`COUNTRY-EXTREMES-${d.category.id}-${difficulty}`,true);
   assert.deepEqual(validateRound(round.categories,round.bank),[]);
   assert.ok(round.categories.some(x=>x.category.id===d.category.id));
   assert.ok(round.categories.every(x=>!retired.has(mapping[x.category.id])));
   report.proofs.push({category_id:mapping[d.category.id],difficulty,reachable:true,audit_version:'country-extremes-live-source-2026-09-08',checked_at:new Date().toISOString(),witness:{categories:round.categories.map(x=>mapping[x.category.id]),countries:round.bank.map(c=>c.id)}});
  } catch(e) {report.failures.push({id:d.category.id,difficulty,error:e.message});}
 }
 if((report.proofs.length+report.failures.length)%30===0){save();console.log(`${report.proofs.length} valid witnesses, ${report.failures.length} failures`);}
}
for(const date of retry ? [] : ['2026-09-09','2026-09-10','2026-09-11']) {
 try {
  const {trio}=generateDailyTrioFromLoadedCatalog(countries,date,loaded,{},'COUNTRY-EXTREMES',{budgetMs:30000,candidateTarget:40,jointSearch:true,jointFirst:true});
  assert.deepEqual(validateDailyTrio(trio),[]);
  for(const round of Object.values(trio))assert.deepEqual(validateRound(round.categories,round.bank),[]);
  report.days.push({date,valid:true,categories:Object.values(trio).flatMap(r=>r.categories.map(c=>mapping[c.category.id]))});
 }catch(e){report.failures.push({date,error:e.message});}
 save();
}
report.completedAt=new Date().toISOString();save();
assert.equal(report.failures.length,0,JSON.stringify(report.failures));
console.log(`PASS: ${report.proofs.length} source-backed board witnesses; ${report.days.length} Daily trios`);
