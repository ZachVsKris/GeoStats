import assert from 'node:assert/strict';import fs from'node:fs';import ts from'typescript';import{pathToFileURL}from'node:url';
const dir=fs.mkdtempSync('/tmp/animal-rotation-');try{
 for(const[name,file]of[['animalstatsComposition','lib/animalstatsComposition.ts'],['old','scripts/fixtures/animalstats-variety-before-optimization.txt'],['new','lib/animalstatsVariety.ts']])fs.writeFileSync(`${dir}/${name}.mjs`,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 const old=await import(pathToFileURL(`${dir}/old.mjs`)),next=await import(pathToFileURL(`${dir}/new.mjs`));
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
 const data={animals:parts.flatMap(p=>p.animals),traits:parts.flatMap(p=>p.traits)},boards=['candidates','group-boards','group-boards-2','extinct'].flatMap(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)).boards);
 function seeded(seed){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
 let checks=0;
 for(const mode of ['easy','normal','expert']){
  const source=boards.filter(b=>b.mode===mode),pool=[...source.slice(0,250),...source.filter(b=>b.id.startsWith('groups-marine-')).slice(0,100),...source.filter(b=>b.collection==='extinct-special').slice(0,50)];
  for(let seed=0;seed<40;seed++){const current=pool[seed%pool.length],recent=[pool[(seed+1)%pool.length],current];assert.equal(next.randomAnimalBoardIndex(data,pool,current,seeded(seed),recent),old.randomAnimalBoardIndex(data,pool,current,seeded(seed),recent));checks++;}
 }
 const sea=boards.find(b=>b.id.startsWith('groups-marine-'));assert.equal(next.animalBoardGroup(data,sea),'marine');
 const full=boards.filter(b=>b.mode==='expert'&&b.collection!=='extinct-special');let start=Date.now();const prior=old.randomAnimalBoardIndex(data,full,undefined,seeded(20261012));const oldMs=Date.now()-start;start=Date.now();const after=next.randomAnimalBoardIndex(data,full,undefined,seeded(20261012));const newMs=Date.now()-start;assert.equal(after,prior);
 console.log(JSON.stringify({seededRotationCases:checks,fullExpertBoards:full.length,fullPoolChoiceUnchanged:true,oldMilliseconds:oldMs,newMilliseconds:newMs,seaSpecialsHaveDedicatedRotation:true}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
