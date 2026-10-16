import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const guard=path.resolve('scripts/review-animalstats-fish-source-context.mjs');
const report=JSON.parse(fs.readFileSync('data/animalstats/research/fish-source-context-holds-20261016.json'));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'fish-context-regression-'));
try {
 const dataDir=path.join(temporary,'data/animalstats');fs.mkdirSync(dataDir,{recursive:true});
 const names=[...new Set(report.records.map(row=>row.dataset))];
 const originals=new Map(names.map(name=>[name,fs.readFileSync(`data/animalstats/${name}.json`,'utf8')]));
 for(const [name,content] of originals)fs.writeFileSync(path.join(dataDir,name+'.json'),content);
 const run=()=>spawnSync(process.execPath,[guard],{cwd:temporary,encoding:'utf8'});
 assert.equal(run().status,0,'Current source holds must pass');
 for(const held of report.records){
  const data=JSON.parse(originals.get(held.dataset));
  const row=data.values.find(value=>value.animalId===held.animalId&&value.traitId===held.traitId);
  assert.equal(row.valueNumeric,held.valueNumeric,'Raw number retained');
  assert.equal(row.sourceId,held.sourceId,'Raw source retained');
  row.confidence='approved';
  fs.writeFileSync(path.join(dataDir,held.dataset+'.json'),JSON.stringify(data));
  const result=run();assert.notEqual(result.status,0);assert(result.stderr.includes('Unresolved source-context cell reapproved'));
  fs.writeFileSync(path.join(dataDir,held.dataset+'.json'),originals.get(held.dataset));
 }
 console.log(`${report.records.length} attempted reapprovals blocked; original numbers and sources retained.`);
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
