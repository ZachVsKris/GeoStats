const fs = require('node:fs');
const assert = require('node:assert/strict');
const { load } = require('./test-catalog-recovery.cjs');
const { buildCategoryCatalog } = load('lib/playableCatalog.ts');
const { canonicalizeDataset, validateRound } = load('lib/dataEngine.ts');
const { generateAnchoredRoundFromLoadedCatalog } = load('lib/puzzleEngine.ts');
const { STATIC_COUNTRIES: countries } = load('lib/staticCountries.ts');
const source = require('../audits/faostat-stock-source-2026-09-07.json');
const rows = JSON.parse(fs.readFileSync(process.argv[2]));
const values = JSON.parse(fs.readFileSync(process.argv[3]));
const proposals = {}, datasets = [];
for (const original of rows) {
  const series = source.series[original.id];
  if (!series && !original.computed_playable_v16_2) continue;
  let row = original;
  if (series) {
    const description = `Number of ${original.source_query.item.toLowerCase()} kept as livestock; FAOSTAT ${series.year} estimates`;
    row = { ...row,unit:'animals',value_type:'total',measurement_type:'total',plain_language_description:description,technical_definition:`FAOSTAT QCL ${row.source_query.item}, Stocks (${row.source_query.elementCode}). Source unit ${row.source_query.unit}; converted to individual animals. Missing countries are not treated as zero.`,unit_explanation:'Number of individual animals',common_year_coverage:series.coverage,validation_status:'verified',ranking_completeness_status:'top_end_complete',ranking_completeness_reason:'Official common-year stock series; reported countries include the principal producers. Missing countries are not assumed zero.',confusing:false,content_review_status:'approved',curation_status:'approved',editorial_status:'approved',player_quality_status:'approved',semantic_audit_status:'pass',semantic_audit_issues:[],source_query:{...row.source_query,displayUnit:'animals'},metadata:{...row.metadata,unit:'animals',sourceUnit:row.source_query.unit,boardDescription:description,plainLanguageDescription:description,unitExplanation:'Number of individual animals',measurementType:'total',measureType:'total',measureClass:'absolute-total',normalizationBasis:'none',normalizationType:'absolute',normalizationApproved:true,catalogTier:'daily',editorialOutcome:'approved',editorialOutcomeV15_6:'approved',faostatProductionOnlyV15_7:'accepted-livestock-population',gameplayMeasurePolicy:'total-production-and-livestock-population',sourceIntegrityStatus:'verified',sourceRecoveryArchiveSha256:source.archive_sha256} };
    proposals[row.id]=row;
    const sourceValues=series.observations.map(o=>[o.country_iso3,String(o.value)]);
    if (row.id.includes('camels')) assert.deepEqual(sourceValues.map(([c,v])=>[c,Number(v)]),values[row.id].map(([c,v])=>[c,Number(v)]));
    values[row.id]=sourceValues;
  }
  const category=buildCategoryCatalog([row],{playableOnly:!series})[0];assert.ok(category,row.id);
  const observations=values[row.id].map(([countryId,value])=>({countryId,countryName:countries.find(c=>c.id===countryId)?.name||countryId,value:Number(value),year:String(row.common_year)}));
  const dataset=canonicalizeDataset({category,year:String(row.common_year),observations});
  assert.equal(dataset.ranked.length,observations.length,row.id);datasets.push(dataset);
}
const loaded={datasets,catalogSize:datasets.length,datasetLoadFailures:0,datasetLoadErrorSamples:[],qualityRejections:0,candidateSources:{}};
const proofs=[];
for(const id of Object.keys(proposals))for(const difficulty of ['easy','normal','expert']){
  try{
    const category=buildCategoryCatalog([proposals[id]],{playableOnly:false})[0];
    const {round}=generateAnchoredRoundFromLoadedCatalog(countries,category.id,difficulty,loaded,`SOURCE-RECOVERY-${id}-${difficulty}`,true);
    assert.deepEqual(validateRound(round.categories,round.bank),[]);
    proofs.push({category_id:id,difficulty,reachable:true,checked_at:new Date().toISOString(),audit_version:'geostats-v16.3.4-source-recovery',witness:{categories:round.categories.map(d=>d.category.id),countries:round.bank.map(c=>c.id)}});
  }catch(e){proofs.push({category_id:id,difficulty,reachable:null,error:e.message});}
}
console.log(JSON.stringify({catalogSize:datasets.length,proposals,proofs}));
if(proofs.some(p=>p.reachable!==true))process.exitCode=1;
