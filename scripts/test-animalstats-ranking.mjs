import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
const temp=fs.mkdtempSync('/tmp/animal-ranking-');
try {
 fs.writeFileSync(`${temp}/ranking.mjs`,ts.transpileModule(fs.readFileSync('lib/animalstatsRanking.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {rankAnimalValues,indexApprovedAnimalValues}=await import(pathToFileURL(`${temp}/ranking.mjs`));
 const row=(id,n,extra={})=>({animalId:id,traitId:'weight',valueNumeric:n,confidence:'approved',observationType:'observed',...extra});
 const values=[row('a',10),row('b',30),row('c',30),row('d',20)];
 assert.deepEqual(rankAnimalValues(values,'higher_wins').map(r=>[r.value.animalId,r.rank]),[['b',1],['c',1],['d',3],['a',4]]);
 assert.deepEqual(rankAnimalValues(values,'lower_wins').map(r=>[r.value.animalId,r.rank]),[['a',1],['d',2],['b',3],['c',3]]);
 assert.deepEqual(values.map(r=>r.animalId),['a','b','c','d'],'ranking must not mutate shared observations');
 assert.deepEqual(rankAnimalValues([],'higher_wins'),[]);
 const indexed=indexApprovedAnimalValues([...values,row('held',100,{confidence:'review'}),row('estimated',200,{observationType:'imputed'}),row('other',2,{traitId:'length'})]);
 assert.equal(indexed.get('weight').length,4);assert.equal(indexed.get('length').length,1);
 const names=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'];
 const parts=names.map(name=>JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)));
 const all=parts.flatMap(p=>p.values),traits=new Map(parts.flatMap(p=>p.traits).map(t=>[t.id,t]));
 const start=performance.now(),byTrait=indexApprovedAnimalValues(all);let checked=0;
 for(const [id,rows] of byTrait){
  const trait=traits.get(id);assert(trait);
  const ranked=rankAnimalValues(rows,trait.direction);
  assert.equal(ranked.length,rows.length);
  for(let i=0;i<ranked.length;i++){
   const prev=ranked[i-1],r=ranked[i];
   assert.equal(r.rank,prev&&prev.value.valueNumeric===r.value.valueNumeric?prev.rank:i+1);
   if(prev)assert(trait.direction==='higher_wins'?prev.value.valueNumeric>=r.value.valueNumeric:prev.value.valueNumeric<=r.value.valueNumeric);
   checked++;
  }
 }
 console.log(JSON.stringify({traits:byTrait.size,rankedObservations:checked,catalogTiesPreserved:true,heldAndImputedExcluded:true,milliseconds:Math.round(performance.now()-start)}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
