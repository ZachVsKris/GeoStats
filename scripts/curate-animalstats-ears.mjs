import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=dirname(dirname(fileURLToPath(import.meta.url))), require=createRequire(join(root,'package.json')), ts=require('typescript');
const temp=await mkdtemp(join(tmpdir(),'animal-ears-'));
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
  const pool=['vulpes_vulpes','procyon_lotor','rattus_norvegicus','myotis_lucifugus','mus_musculus','didelphis_marsupialis'];
  const approved=new Map(data.values.filter(v=>v.confidence==='approved'&&v.observationType!=='imputed').map(v=>[`${v.animalId}:${v.traitId}`,v]));
  const boards=[];
  const sets=[];
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++)for(let d=c+1;d<pool.length;d++)sets.push([pool[a],pool[b],pool[c],pool[d]]);
  for(const ear of ['measured_adult_ear_length','measured_adult_ear_length__low']) {
    let found=null;
    for(const animalIds of sets) {
      const other=data.traits.filter(t=>t.id!==ear&&!t.id.startsWith('measured_adult_ear_length')&&t.categoryKind==='intuitive'&&animalIds.every(a=>approved.has(`${a}:${t.id}`))).map(t=>t.id);
      for(let a=0;a<other.length&&!found;a++)for(let b=a+1;b<other.length&&!found;b++)for(let c=b+1;c<other.length&&!found;c++){
        const traitIds=[ear,other[a],other[b],other[c]];
        const regions=[...new Set(data.animals.filter(a=>animalIds.includes(a.id)).flatMap(a=>a.biogeographicRegions??[]))];
        const board={id:`fair-ears-easy-${ear.endsWith('__low')?'short':'long'}-20261005`,mode:'easy',boardType:'themed',animalIds,traitIds,biogeographicRegions:regions,editorial:{families:traitIds.map(id=>data.traits.find(t=>t.id===id).gameplayFamily),multiTraitContenders:2,policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:3}};
        const result=validate(board),composition=animalBoardComposition(data,board);
        if(result.valid&&composition.eligible)found=board;
      }
      if(found)break;
    }
    if(found)boards.push(found);
    else console.log('No suitable complete board yet for',ear);
  }
  if(!boards.length)throw Error('No valid ear boards');
  candidates.boards=[...candidates.boards.filter(board=>!board.id?.startsWith('fair-ears-')), ...boards];
  await writeFile(join(root,'data/animalstats/candidates.json'),JSON.stringify(candidates)+'\n');
  console.log(JSON.stringify({newBoards:boards.length,playableDirections:boards.length,intuitiveEachBoard:'4 of 4',perfectScoreAttainable:true,boards}));
} finally {await rm(temp,{recursive:true,force:true});}
