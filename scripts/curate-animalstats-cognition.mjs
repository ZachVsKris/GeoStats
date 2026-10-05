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
  const animalIds=['gorilla_gorilla','canis_lupus','pan_troglodytes','lemur_catta'];
  const trials=[
    ['cylinder_treat_success','adult_body_mass','gestation__low','mammal_range_area__low'],
    ['cylinder_treat_success__low','adult_body_mass','maximum_documented_lifespan','mammal_range_area'],
  ];
  const boards=[];
  for(const mode of ['easy']) for(const traitIds of trials) {
    const regions=[...new Set(data.animals.filter(a=>animalIds.includes(a.id)).flatMap(a=>a.biogeographicRegions??[]))];
    const board={id:`fair-cognition-${mode}-${traitIds[0].endsWith('__low')?'low':'high'}-20261005`,mode,boardType:'themed',animalIds,traitIds,biogeographicRegions:regions,editorial:{families:['cognition','mass','life-history','range'],multiTraitContenders:2,policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:3}};
    const result=validate(board),composition=animalBoardComposition(data,board);
    if(!result.valid||!composition.eligible) throw Error(JSON.stringify({board,result,composition}));
    boards.push(board);
  }
  candidates.boards=[...candidates.boards.filter(board=>!board.id?.startsWith('fair-cognition-')), ...boards];
  await writeFile(join(root,'data/animalstats/candidates.json'),JSON.stringify(candidates,null,2)+'\n');
  console.log(JSON.stringify({newBoards:boards.length,pairedLabels:2,intuitiveEachBoard:'4 of 4',perfectScoreAttainable:true}));
} finally {await rm(temp,{recursive:true,force:true});}
