const fs=require('node:fs'),assert=require('node:assert/strict');
const {load}=require('./test-catalog-recovery.cjs');
const {buildCategoryCatalog}=load('lib/playableCatalog.ts');
const {canonicalizeDataset,validateRound}=load('lib/dataEngine.ts');
const {datasetHasEnoughDisplayedVariety}=load('lib/puzzleEngine.ts');
const {ROUND_CONFIGS}=load('lib/gameRules.ts');
const {STATIC_COUNTRIES:countries}=load('lib/staticCountries.ts');
const base=JSON.parse(fs.readFileSync(process.argv[2]));
const values=JSON.parse(fs.readFileSync(process.argv[3]));
const repaired=JSON.parse(fs.readFileSync(process.argv[4]));
const source=require('../audits/faostat-stock-source-2026-09-07.json');
const saved=require('../audits/faostat-stock-proofs-2026-09-07.json');
const byId=new Map();
for(const row of [...base.filter(r=>r.computed_playable_v16_2),...repaired]){
  const newRow=!!source.series[row.id];
  const category=buildCategoryCatalog([row],{playableOnly:!newRow||process.argv.includes('--live')})[0];assert.ok(category,row.id);
  const observations=newRow?source.series[row.id].observations.map(o=>({countryId:o.country_iso3,countryName:o.country_name,value:o.value,year:String(o.data_year)})):values[row.id].map(([countryId,value])=>({countryId,countryName:countryId,value:Number(value),year:String(row.common_year)}));
  const d=canonicalizeDataset({category,year:String(row.common_year),observations});assert.equal(d.ranked.length,observations.length);assert.ok(!byId.has(category.id));byId.set(category.id,d);
}
for(const p of saved.proofs){
  assert.equal(p.reachable,true);
  const categories=p.witness.categories.map(id=>{assert.ok(byId.has(id),id);return byId.get(id)});
  const bank=p.witness.countries.map(id=>{const c=countries.find(c=>c.id===id);assert.ok(c,id);return c});
  assert.deepEqual(validateRound(categories,bank),[],p.category_id+'/'+p.difficulty);
  assert.equal(bank.length,ROUND_CONFIGS[p.difficulty].countryCount);
  assert.equal(categories.length,ROUND_CONFIGS[p.difficulty].categoryCount);
  assert.ok(categories.every(d=>datasetHasEnoughDisplayedVariety(d,ROUND_CONFIGS[p.difficulty])));
}
console.log(JSON.stringify({catalogSize:byId.size,verifiedProofs:saved.proofs.length,strictLive:process.argv.includes('--live')}));
