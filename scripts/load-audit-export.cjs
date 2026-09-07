const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {load}=require('./test-catalog-recovery.cjs');
function loadAuditExport(directory){
  const rows=[0,90,180,270,360].flatMap(offset=>JSON.parse(fs.readFileSync(path.join(directory,`continue-catalog-${offset}.json`))));
  const hashes=JSON.parse(fs.readFileSync(path.join(directory,'continue-source-hashes.json')));
  const values=JSON.parse(fs.readFileSync(path.join(directory,'maximum-observations-full-precision.json')));
  const stock=require('../audits/faostat-stock-source-2026-09-07.json');
  for(const [id,s] of Object.entries(stock.series))values[id]=s.observations.map(o=>[o.country_iso3,String(o.value)]);
  const {buildPlayableCategoryCatalog}=load('lib/playableCatalog.ts');
  const {canonicalizeDataset}=load('lib/dataEngine.ts');
  const {STATIC_COUNTRIES:countries}=load('lib/staticCountries.ts');
  const mapping={},datasets=[];
  assert.equal(rows.length,hashes.length);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  for(const row of rows){
    const expected=hashes.find(h=>h.id===row.id);assert.ok(expected,row.id);
    assert.equal(row.common_year,expected.common_year);
    const observations=values[row.id];assert.equal(observations.length,expected.n);assert.equal(observations.length,row.common_year_coverage);
    const fingerprint=crypto.createHash('md5').update([...observations].sort((a,b)=>a[0].localeCompare(b[0])).map(([id,value])=>{const b=Buffer.alloc(8);b.writeDoubleBE(Number(value));return id+':'+b.toString('hex')}).join(',')).digest('hex');
    assert.equal(fingerprint,expected.hash,'Live source values changed: '+row.id);
    const category=buildPlayableCategoryCatalog([row])[0];assert.ok(category,row.id);assert.ok(!mapping[category.id]);mapping[category.id]=row.id;
    const dataset=canonicalizeDataset({category,year:String(row.common_year),observations:observations.map(([countryId,value])=>({countryId,countryName:countries.find(c=>c.id===countryId)?.name||countryId,value:Number(value),year:String(row.common_year)}))});
    assert.equal(dataset.ranked.length,observations.length);datasets.push(dataset);
  }
  return {rows,hashes,mapping,countries,loaded:{datasets,catalogSize:datasets.length,datasetLoadFailures:0,datasetLoadErrorSamples:[],qualityRejections:0,candidateSources:{}}};
}
module.exports={loadAuditExport};
