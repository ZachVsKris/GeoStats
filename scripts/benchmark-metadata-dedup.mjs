// Local-only experiment; no production connection or mutations.
// Usage: node scripts/benchmark-metadata-dedup.mjs LAB_DIRECTORY
// LAB_DIRECTORY contains pinned @electric-sql/pglite@0.3.14, manifest.json,
// and pgcrypto-compressed part-N.b64 exports (geography observations only).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const lab = path.resolve(process.argv[2]);
const { PGlite } = await import(pathToFileURL(path.join(lab,'node_modules/@electric-sql/pglite/dist/index.js')));
const db = await PGlite.create(path.join(lab,'pgdata'));
const q = async (sql, params=[]) => (await db.query(sql,params)).rows;
const report = { runtime: (await q('select version()'))[0].version, limitations: [
  'Single-session WebAssembly PostgreSQL, not native Supabase hardware or a concurrent load test.',
  'Fresh baseline isolates deduplication savings from pre-existing table/index bloat.',
  'Compatibility view is a read prototype; existing ON CONFLICT import writes are not compatible.',
  'Exports were taken in separate bounded read transactions, not one global snapshot.'
] };
console.log(report.runtime);
await db.exec(`set work_mem='32MB'; create table if not exists baseline (
 category_id text not null,country_iso3 text not null,country_name text not null,
 data_year smallint not null,value double precision not null,source_url text,
 source_record_id text,imported_at timestamptz not null,metadata jsonb not null);
 create table if not exists loaded_parts(part integer primary key,sha256 text not null,n integer not null);`);
const manifest=JSON.parse(fs.readFileSync(path.join(lab,'manifest.json'),'utf8'));
for(const part of manifest){
  if((await q('select 1 from loaded_parts where part=$1',[part.part])).length) continue;
  const encrypted=Buffer.from(fs.readFileSync(path.join(lab,`part-${part.part}.b64`),'utf8'),'base64');
  const decrypted=spawnSync('gpg',['--batch','--pinentry-mode','loopback','--passphrase','geostats-local-metadata-lab','--decrypt'],{input:encrypted,maxBuffer:64*1024*1024});
  assert.equal(decrypted.status,0,decrypted.stderr.toString());
  assert.equal(createHash('sha256').update(decrypted.stdout).digest('hex'),part.sha256);
  await db.transaction(async tx=>{
    const inserted=await tx.query('insert into baseline select * from jsonb_populate_recordset(null::baseline,$1::jsonb)',[decrypted.stdout.toString()]);
    assert.equal(inserted.affectedRows,Number(part.n));
    await tx.query('insert into loaded_parts values($1,$2,$3)',[part.part,part.sha256,part.n]);
  });
  console.log(`Loaded verified part ${part.part}: ${part.n} rows`);
}
report.rowCount=Number((await q('select count(*) as n from baseline'))[0].n);
assert.equal(report.rowCount,manifest.reduce((a,p)=>a+Number(p.n),0));
if(!(await q("select 1 from pg_class where relname='compatibility_observations'")).length){
 console.log('Building dictionaries and compact copy');
 await db.exec(fs.readFileSync(new URL('../supabase/maintenance/metadata-dedup-lab.sql',import.meta.url),'utf8'));
}
for(const table of ['baseline','compact_observations']){
 await db.exec(`create unique index if not exists ${table}_pkey on ${table}(category_id,country_iso3,data_year);
 create index if not exists ${table}_category_year_idx on ${table}(category_id,data_year desc);
 create index if not exists ${table}_country_idx on ${table}(country_iso3);
 create index if not exists ${table}_category_year_country_idx on ${table}(category_id,data_year,country_iso3);
 create index if not exists ${table}_category_year_value_country_idx on ${table}(category_id,data_year,value,country_iso3);`);
 await db.exec(`vacuum analyze ${table}`);
}
await db.exec('vacuum analyze metadata_dictionary');
await db.exec('vacuum analyze source_dictionary');
report.sizes=await q(`select relname,pg_table_size(oid)::bigint as table_bytes,
 pg_indexes_size(oid)::bigint as index_bytes,pg_total_relation_size(oid)::bigint as total_bytes
 from pg_class where relname in ('baseline','compact_observations','metadata_dictionary','source_dictionary') order by relname`);
report.dictionaryCounts=await q('select (select count(*) from metadata_dictionary) as metadata,(select count(*) from source_dictionary) as urls');
console.log('Checking full row reconstruction');
report.differentRows=Number((await q(`select count(*) as n from (
 (select * from baseline except all select * from compatibility_observations)
 union all (select * from compatibility_observations except all select * from baseline)) d`))[0].n);
assert.equal(report.differentRows,0);
const categories=await q('select category_id,max(data_year) as year,count(*) as n from baseline group by category_id order by category_id');
const sample=categories.filter((_,i)=>i%Math.max(1,Math.floor(categories.length/40))===0);
const cases=sample.map(c=>({name:'single-category',params:[c.category_id,c.year],sql:'select country_iso3,country_name,data_year,value from TABLE where category_id=$1 and data_year=$2 order by country_iso3 limit 500'}));
const years=[...new Set(sample.map(c=>c.year))];
for(const year of years){
 const ids=categories.filter(c=>c.year===year).slice(0,32).map(c=>c.category_id);
 cases.push({name:'bulk-category',params:[ids,year],sql:'select category_id,country_iso3,country_name,data_year,value from TABLE where category_id=any($1::text[]) and data_year=$2 order by category_id,country_iso3 limit 1000'});
}
report.queryCases=cases.length; report.benchmarks=[]; report.unexpectedDictionaryScans=0;
const timings={baseline:[],compatibility_observations:[]};
for(const test of cases){
 const paired={name:test.name,category:test.params[0],year:test.params[1],baseline:[],compatibility_observations:[]};
 const before=await q(test.sql.replace('TABLE','baseline'),test.params);
 const after=await q(test.sql.replace('TABLE','compatibility_observations'),test.params);
 assert.deepEqual(after,before);
 for(let round=0;round<31;round++){
  const order=round%2?['compatibility_observations','baseline']:['baseline','compatibility_observations'];
  for(const table of order){
   const plan=(await q('explain (analyze,buffers,format json) '+test.sql.replace('TABLE',table),test.params))[0]['QUERY PLAN'][0];
   if(table==='compatibility_observations'&&/metadata_dictionary|source_dictionary/.test(JSON.stringify(plan.Plan))) report.unexpectedDictionaryScans++;
   if(round>0){timings[table].push(plan['Execution Time']);paired[table].push(plan['Execution Time']);}
  }
 }
 for(const table of ['baseline','compatibility_observations']){
  const values=paired[table].sort((a,b)=>a-b);
  paired[table]={median_ms:values[Math.floor(values.length*.5)],p95_ms:values[Math.floor(values.length*.95)]};
 }
 (report.pairedCases??=[]).push(paired);
}
assert.equal(report.unexpectedDictionaryScans,0);
for(const [table,values] of Object.entries(timings)){
 values.sort((a,b)=>a-b);
 report.benchmarks.push({table,samples:values.length,median_ms:values[Math.floor(values.length*.5)],p95_ms:values[Math.floor(values.length*.95)]});
}
// Reproduce the existing importer's upsert requirement without changing any data.
try {
 await db.query(`insert into compatibility_observations select * from baseline limit 0
 on conflict(category_id,country_iso3,data_year) do update set value=excluded.value`);
 report.existingImporterUpsert='unexpectedly accepted';
}catch(e){report.existingImporterUpsert={code:e.code,message:e.message};}
fs.writeFileSync(path.join(lab,'results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
await db.close();
