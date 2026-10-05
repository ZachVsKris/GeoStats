import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url))), require=createRequire(join(root,'package.json')), ts=require('typescript');
const temp=await mkdtemp(join(tmpdir(),'animal-hibernation-'));
try {
  for (const file of ['categorySemantics','gameRules','animalstats','animalstatsComposition']) {
    const code=ts.transpileModule(await readFile(join(root,'lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"');
    await writeFile(join(temp,file+'.mjs'),code);
  }
  const {createAnimalBoardValidator}=await import(pathToFileURL(join(temp,'animalstats.mjs')));
  const {animalBoardComposition}=await import(pathToFileURL(join(temp,'animalstatsComposition.mjs')));
  const data=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
  const candidates=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8'));
  const validate=createAnimalBoardValidator(data);
  const existing=candidates.boards.filter(b=>!b.id?.startsWith('fair-mdd-'));
  const values=new Map(data.values.filter(v=>v.confidence==='approved'&&v.observationType!=='imputed').map(v=>[`${v.animalId}:${v.traitId}`,v]));
  const labels=['mdd_country_count','mdd_country_count__low','mdd_continent_count','mdd_continent_count__low','mdd_family_species_count','mdd_family_species_count__low'];
  const traits=new Map(data.traits.map(t=>[t.id,t]));
  const boards=[];
  for(const newTrait of labels) {
    const seen=new Set();let count=0;
    for(const original of existing) {
      if(!original.animalIds.every(id=>values.has(`${id}:${newTrait}`)))continue;
      if(!animalBoardComposition(data,original).eligible)continue;
      for(let slot=0;slot<original.traitIds.length;slot++) {
        const traitIds=[...original.traitIds];traitIds[slot]=newTrait;
        const key=original.mode+':'+[...original.animalIds].sort().join(',');
        if(seen.has(key))continue;
        const board={...original,id:`fair-mdd-${newTrait}-${original.mode}-${count+1}-20261005`,traitIds,editorial:{...original.editorial,policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:original.mode==='expert'?4:3,families:traitIds.map(id=>traits.get(id).gameplayFamily)}};
        const result=validate(board),composition=animalBoardComposition(data,board);
        if(result.valid&&composition.eligible){boards.push(board);seen.add(key);count++;break;}
      }
      if(count>=20)break;
    }
    console.log(newTrait,count,'valid distinct lineups');
  }
  if(!boards.length)throw Error('No valid MDD boards');
  candidates.boards=[...candidates.boards.filter(board=>!board.id?.startsWith('fair-mdd-')), ...boards];
  await writeFile(join(root,'data/animalstats/candidates.json'),JSON.stringify(candidates)+'\n');
  console.log(JSON.stringify({newBoards:boards.length,intuitiveMajority:true,perfectScoreAttainable:true,modes:boards.reduce((x,b)=>(x[b.mode]=(x[b.mode]??0)+1,x),{})}));
} finally {await rm(temp,{recursive:true,force:true});}
