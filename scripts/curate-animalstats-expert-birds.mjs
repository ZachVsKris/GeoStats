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
  const original=candidates.boards.filter(b=>!b.id?.startsWith('fair-expert-birds-'));
  const birds=data.animals.filter(a=>a.taxonomicGroup==='bird'&&a.active&&a.familiarityTier!=='edge').map(a=>a.id);
  const traits=new Map(data.traits.map(t=>[t.id,t])), values=new Map(data.values.filter(v=>v.confidence==='approved').map(v=>[`${v.animalId}:${v.traitId}`,v]));
  const intuitive=['bird_mass','bird_range_area','raw_incubation','raw_hatching_mass','ringing_longevity','cruising_flight_speed','measured_wingspan','wild_recorded_lifespan','raw_clutch_size'];
  const specialist=['bird_beak_length','bird_tail_length','raw_egg_mass'];
  const combos=(arr,n)=>{const out=[];function visit(start,chosen){if(chosen.length===n){out.push(chosen);return;}for(let i=start;i<=arr.length-(n-chosen.length);i++)visit(i+1,[...chosen,arr[i]]);}visit(0,[]);return out;};
  const added=[],seen=new Set();let cliques=0,traitSets=0;
  outer: for(const its of combos(intuitive,4)) for(const sts of combos(specialist,2)) {
    const tids=[...its,...sts];if(tids.some(t=>!traits.get(t)?.prototypeCategory))continue;
    if(its.includes('ringing_longevity')&&its.includes('wild_recorded_lifespan'))continue;
    const eligible=birds.filter(a=>tids.every(t=>values.has(`${a}:${t}`)));
    if(eligible.length<8)continue;traitSets++;
    const separated=(a,b,t)=>{
      const x=values.get(`${a}:${t}`),y=values.get(`${b}:${t}`);
      if(Math.max(x.valueNumeric,y.valueNumeric)/Math.min(x.valueNumeric,y.valueNumeric)<1.05-1e-12)return false;
      return (x.valueMin??x.valueNumeric)>(y.valueMax??y.valueNumeric)||
        (y.valueMin??y.valueNumeric)>(x.valueMax??x.valueNumeric);
    };
    const neighbors=new Map(eligible.map(a=>[a,new Set(eligible.filter(b=>a!==b&&tids.every(t=>separated(a,b,t))))]));
    function visit(chosen,remaining){if(chosen.length===8){cliques++;
      for(let mask=0;mask<64;mask++){
        const traitIds=tids.map((t,i)=>mask&(1<<i)?traits.get(t).counterTraitId:t);if(traitIds.some(t=>!t))continue;
        const winners=traitIds.map(t=>chosen.reduce((best,a)=>{const d=values.get(`${a}:${t}`).valueNumeric-values.get(`${best}:${t}`).valueNumeric;return (traits.get(t).direction==='higher_wins'?d>0:d<0)?a:best;}));
        if(new Set(winners).size!==6)continue;
        const key=[...chosen].sort().join(',')+':'+traitIds.join(',');if(seen.has(key))continue;
        const board={id:`fair-expert-birds-${added.length+1}-20261005`,mode:'expert',animalIds:chosen,traitIds,editorial:{policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:4,families:traitIds.map(t=>traits.get(t).gameplayFamily)}};
        if(validate(board).valid&&animalBoardComposition(data,board).eligible){added.push(board);seen.add(key);if(added.length>=80)return true;}
      }
      return false;
    }
    for(let i=0;i<remaining.length;i++){if(chosen.length+remaining.length-i<8)break;const a=remaining[i];const next=remaining.slice(i+1).filter(b=>neighbors.get(a).has(b));if(visit([...chosen,a],next))return true;}return false;}
    if(visit([],eligible))break outer;
  }
  console.log(JSON.stringify({traitSets,cliques,newExpertBirdBoards:added.length}));
  if(added.length){candidates.boards=[...original,...added];await writeFile(join(root,'data/animalstats/candidates.json'),JSON.stringify(candidates)+'\n');}
} finally {await rm(temp,{recursive:true,force:true});}
