const fs=require('fs'),assert=require('node:assert/strict');
const {load}=require('./test-catalog-recovery.cjs');
const {buildCategoryRegistry}=load('lib/playableCatalog.ts');
const {canonicalizeDataset,validateRound}=load('lib/dataEngine.ts');
const {STATIC_COUNTRIES:countries}=load('lib/staticCountries.ts');
const before=JSON.parse(fs.readFileSync('/tmp/geostats-extremes-live-rows.json'));
const current=JSON.parse(fs.readFileSync('/tmp/geostats-extremes-post-import-rows.json'));
const values=JSON.parse(fs.readFileSync('/tmp/geostats-owner-live-values.json'));
const source=require('../audits/country-extremes-source-2026-09-08.json');
for(const c of source.categories)values[c.id]=c.values;
const patches=[],datasets=new Map();
for(const row of current){
 const prior=before.find(r=>r.id===row.id),patch={id:row.id};
 for(const key of ['title','plain_language_description','value_type','measurement_type'])if(row[key]!==prior[key])patch[key]=prior[key];
 const metadata={};for(const key of ['broadDomain','knowledgeCluster'])if(row.metadata?.[key]!==prior.metadata?.[key])metadata[key]=prior.metadata[key];
 if(Object.keys(metadata).length)patch.metadata=metadata;
 if(Object.keys(patch).length>1)patches.push(patch);
 const restored={...row,...patch,metadata:{...row.metadata,...metadata}};
 const [category]=buildCategoryRegistry([restored]);assert.ok(category,row.id);
 datasets.set(row.id,canonicalizeDataset({category,year:String(row.common_year),observations:values[row.id].map(([countryId,value])=>({countryId,countryName:countries.find(c=>c.id===countryId)?.name??countryId,value,year:String(row.common_year)}))}));
}
const audit=structuredClone(require('../audits/country-extremes-verification-2026-09-08.json'));
for(const p of audit.proofs){const ds=p.witness.categories.map(id=>datasets.get(id)),bank=p.witness.countries.map(id=>countries.find(c=>c.id===id));assert.deepEqual(validateRound(ds,bank),[],p.category_id+' '+p.difficulty);p.checked_at=new Date().toISOString();p.audit_version='boundary-import-recovery-2026-09-08';}
fs.writeFileSync('audits/boundary-import-recovery-2026-09-08.json',JSON.stringify({patches,proofs:audit.proofs,verifiedAt:new Date().toISOString()},null,2)+'\n');
console.log(`${patches.length} definitions restored; ${audit.proofs.length} existing board witnesses independently revalidated`);
