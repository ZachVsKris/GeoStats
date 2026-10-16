import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'body-length-overlap-'));
try {
 for(const name of ['categorySemantics','gameRules','animalstats','animalstatsDatasetAssembly'])fs.writeFileSync(path.join(temporary,name+'.mjs'),ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 const {createAnimalBoardValidator}=await import(pathToFileURL(path.join(temporary,'animalstats.mjs')));
 const {assembleAnimalDataset}=await import(pathToFileURL(path.join(temporary,'animalstatsDatasetAssembly.mjs')));
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'].map(name=>JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)));
 const data=assembleAnimalDataset(parts,parts[4].photos),validate=createAnimalBoardValidator(data),traits=new Map(data.traits.map(t=>[t.id,t]));
 const retired=JSON.parse(fs.readFileSync('data/animalstats/research/body-length-overlap-review-20261016.json')).retiredBoards;
 let checks=0;
 for(const {board} of retired){
  assert(validate(board).rejectionReasons.includes('closely related traits on the same board'));checks++;
  const index=board.traitIds.findIndex(id=>['fish_record_length','aquatic_cited_total_length','aquatic_length_upper'].includes(id.replace(/__low$/,'')));
  const opposite=traits.get(board.traitIds[index]).counterTraitId;
  assert(opposite);const changed={...board,traitIds:board.traitIds.map((id,i)=>i===index?opposite:id)};
  assert(validate(changed).rejectionReasons.includes('closely related traits on the same board'));checks++;
 }
 const valid=JSON.parse(fs.readFileSync('data/animalstats/candidates.json')).boards.find(board=>board.id==='reviewed-fish-20261016-fish-easy-2eb6788be882');
 assert(valid&&validate(valid).valid,'Halibut board with distinct length, depth, egg size and egg count remains playable');
 console.log(`${checks} overlapping-length and opposite-direction checks passed; distinct-category halibut round retained.`);
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
