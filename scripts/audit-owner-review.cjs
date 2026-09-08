const fs = require('node:fs');
const assert = require('node:assert/strict');
const {load} = require('./test-catalog-recovery.cjs');
const notes = require('../audits/owner-review-2026-09-08.json');
const rows = JSON.parse(fs.readFileSync('/tmp/geostats-owner-live-rows.json'));
const values = JSON.parse(fs.readFileSync('/tmp/geostats-owner-live-values.json'));
const {buildPlayableCategoryCatalog,buildCategoryRegistry} = load('lib/playableCatalog.ts');
const {canonicalizeDataset,validateRound} = load('lib/dataEngine.ts');
const {STATIC_COUNTRIES:countries} = load('lib/staticCountries.ts');
const {generateAnchoredRoundFromLoadedCatalog,generateDailyTrioFromLoadedCatalog} = load('lib/puzzleEngine.ts');
const {validateDailyTrio} = load('lib/dailyTrioRules.ts');
const retired = new Set(notes.filter(n=>n.action==='retire').map(n=>n.id));
const retiredRuntimeIds = rows.filter(r=>retired.has(r.id)).flatMap(r=>buildCategoryRegistry([r]).map(c=>c.id));
assert.equal(retiredRuntimeIds.length,49);
fs.writeFileSync('lib/ownerCategoryRetirements.ts',
  '// Owner-approved editorial retirements. Existing dated boards retain their scoring data.\n'+
  'const retired = new Set('+JSON.stringify(retiredRuntimeIds,null,2)+');\n'+
  'export function isPreservedOwnerRetirement(id: string, date: string) {\n'+
  '  return /^\\d{4}-\\d{2}-\\d{2}$/.test(date) && date <= "2026-09-08" && retired.has(id);\n}\n');
const mapping = {}, datasets = [];
for(const row of rows) {
  if(retired.has(row.id)) continue;
  const note = notes.find(n=>n.id===row.id);
  const updated = structuredClone(row);
  if(note?.action==='clarify') updated.metadata={...updated.metadata,ownerReviewTitle:note.new_title,ownerReviewDescription:note.new_description};
  const category = buildPlayableCategoryCatalog([updated])[0];
  assert.ok(category,row.id);
  if(note?.new_description) assert.equal(category.boardDescription,note.new_description);
  assert.ok(!/(?<=[A-Za-z])-(?=[A-Za-z])/.test(category.name),category.name);
  mapping[category.id]=row.id;
  datasets.push(canonicalizeDataset({category,year:String(row.common_year),observations:values[row.id].map(([countryId,value])=>({countryId,countryName:countries.find(c=>c.id===countryId)?.name??countryId,value:Number(value),year:String(row.common_year)}))}));
}
assert.equal(datasets.length,365);
const loaded={datasets,catalogSize:datasets.length,datasetLoadFailures:0,datasetLoadErrorSamples:[],qualityRejections:0,candidateSources:{}};
const report={catalogSize:365,retired:49,proofs:[],days:[],failures:[]};
const save=()=>fs.writeFileSync('audits/owner-review-verification-2026-09-08.json',JSON.stringify(report,null,2)+'\n');
for(const d of datasets) {
 for(const difficulty of d.category.playableDifficulties??['easy','normal','expert']) {
  try {
   const {round}=generateAnchoredRoundFromLoadedCatalog(countries,d.category.id,difficulty,loaded,`OWNER-REVIEW-${d.category.id}-${difficulty}`,true);
   assert.deepEqual(validateRound(round.categories,round.bank),[]);
   assert.ok(round.categories.some(x=>x.category.id===d.category.id));
   assert.ok(round.categories.every(x=>!retired.has(mapping[x.category.id])));
   report.proofs.push({category_id:mapping[d.category.id],difficulty,reachable:true,audit_version:'owner-review-live-source-2026-09-08',checked_at:new Date().toISOString(),witness:{categories:round.categories.map(x=>mapping[x.category.id]),countries:round.bank.map(c=>c.id)}});
  } catch(e) {report.failures.push({id:d.category.id,difficulty,error:e.message});}
 }
 if((report.proofs.length+report.failures.length)%30===0){save();console.log(`${report.proofs.length} valid witnesses, ${report.failures.length} failures`);}
}
for(const date of ['2026-09-09','2026-09-10','2026-09-11']) {
 try {
  const {trio}=generateDailyTrioFromLoadedCatalog(countries,date,loaded,{},'OWNER-REVIEW',{budgetMs:30000,candidateTarget:40,jointSearch:true,jointFirst:true});
  assert.deepEqual(validateDailyTrio(trio),[]);
  for(const round of Object.values(trio))assert.deepEqual(validateRound(round.categories,round.bank),[]);
  report.days.push({date,valid:true,categories:Object.values(trio).flatMap(r=>r.categories.map(c=>mapping[c.category.id]))});
 }catch(e){report.failures.push({date,error:e.message});}
 save();
}
report.completedAt=new Date().toISOString();save();
assert.equal(report.failures.length,0,JSON.stringify(report.failures));
console.log(`PASS: ${report.proofs.length} source-backed board witnesses; ${report.days.length} Daily trios`);
