import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';import {dirname,join} from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const root=dirname(dirname(fileURLToPath(import.meta.url))),require=createRequire(join(root,'package.json')),ts=require('typescript'),temp=await mkdtemp(join(tmpdir(),'animal-expand-'));
let seed=104729;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
try{
 for(const file of ['categorySemantics','gameRules','animalstats','animalstatsComposition','animalstatsCoverage','animalstatsCartoons']){const code=ts.transpileModule(await readFile(join(root,'lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"');await writeFile(join(temp,file+'.mjs'),code);}
 const {createAnimalBoardValidator}=await import(pathToFileURL(join(temp,'animalstats.mjs'))),{animalBoardComposition}=await import(pathToFileURL(join(temp,'animalstatsComposition.mjs'))),{publishedAnimalTraitIds}=await import(pathToFileURL(join(temp,'animalstatsCoverage.mjs')));
 const {cartoonSpecies}=await import(pathToFileURL(join(temp,'animalstatsCartoons.mjs')));
 const data=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8')),candidates=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8')),validate=createAnimalBoardValidator(data),published=publishedAnimalTraitIds(data);
 candidates.boards=candidates.boards.filter(b=>!b.id.startsWith('fair-expand-'));const seen=new Set(candidates.boards.map(b=>b.mode+'|'+b.animalIds.slice().sort()+'|'+b.traitIds.slice().sort()));
 const values=new Map(data.values.filter(v=>v.confidence==='approved').map(v=>[v.animalId+':'+v.traitId,v]));const targets=data.traits.filter(t=>published.has(t.id)&&(/pet_dog_(survey|akc)_/.test(t.id)||/^(raw_fledging_age|mammal_head_body_length)/.test(t.id)));const counts=new Map(targets.map(t=>[t.id,0])),boards=[];
 for(const kind of ['dog-breed','bird','wild-mammal'])for(const mode of ['easy','normal','expert']){
 const n=mode==='easy'?4:mode==='normal'?6:8,k=mode==='expert'?6:4; const modeCounts=new Map();
 const animals=data.animals.filter(a=>a.active&&cartoonSpecies.includes(a.id)&&data.photos.some(p=>p.animalId===a.id&&p.approved)&&(kind==='wild-mammal'?values.has(a.id+':mammal_head_body_length'):a.taxonomicGroup===kind)).map(a=>a.id);
 const poolTargets=targets.filter(t=>kind==='dog-breed'?t.id.startsWith('pet_dog_'):kind==='bird'?t.id.startsWith('raw_fledging_age'):t.id.startsWith('mammal_head_body_length'));
 if(!poolTargets.length)continue;
 for(let attempt=0;attempt<18000&&poolTargets.some(t=>(modeCounts.get(t.id)??0)<8);attempt++){
 const animalIds=shuffle(animals).slice(0,n);if(animalIds.length<n)continue;
 const options=data.traits.filter(t=>published.has(t.id)).flatMap(t=>{
 const rows=animalIds.map(a=>values.get(a+':'+t.id));if(rows.some(v=>!v||v.valueNumeric<=0||v.sourceId!==t.canonicalSourceId||v.unit!==t.unit||v.measurementBasis!==t.measurementBasis))return [];
 if(new Set(rows.map(v=>v.sex)).size!==1||new Set(rows.map(v=>v.lifeStage)).size!==1)return [];
 const sorted=[...rows].sort((a,b)=>a.valueNumeric-b.valueNumeric);if(sorted.slice(1).some((b,i)=>{const a=sorted[i];return (t.separationMethod==='distinct_ordinal'?a.valueNumeric===b.valueNumeric:b.valueNumeric/a.valueNumeric<1.05-1e-12)||(a.valueMax??a.valueNumeric)>=(b.valueMin??b.valueNumeric);}))return [];
 return [{t,winner:(t.direction==='higher_wins'?sorted.at(-1):sorted[0]).animalId}];});
 for(const focus of shuffle(options.filter(o=>poolTargets.some(t=>t.id===o.t.id)&&(modeCounts.get(o.t.id)??0)<8)).slice(0,4))for(let trial=0;trial<18;trial++){
 const selected=[focus];for(const o of shuffle(options)){
 if(selected.length===k)break;if(selected.some(s=>s.t.metricKey===o.t.metricKey||s.winner===o.winner))continue;
 const behavior=t=>/^pet_dog_(survey_|akc_)/.test(t.id)&&!t.id.includes('recognition');const fear=t=>/survey_(strangerfear|dogfear|nonsocialfear)/.test(t.id);
 if(behavior(o.t)&&selected.filter(s=>behavior(s.t)).length>=3)continue;if(fear(o.t)&&selected.some(s=>fear(s.t)))continue;selected.push(o);
 }
 if(selected.length!==k)continue;const traitIds=selected.map(s=>s.t.id),signature=mode+'|'+animalIds.slice().sort()+'|'+traitIds.slice().sort();if(seen.has(signature))continue;
 const board={id:'fair-expand-'+createHash('sha256').update(signature).digest('hex').slice(0,16),mode,boardType:'themed',animalIds,traitIds,editorial:{families:[...new Set(selected.map(s=>s.t.gameplayFamily))],multiTraitContenders:2,policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:mode==='expert'?4:3}};
 if(!validate(board).valid||!animalBoardComposition(data,board).eligible)continue;seen.add(signature);boards.push(board);for(const id of traitIds)if(counts.has(id)){counts.set(id,counts.get(id)+1);modeCounts.set(id,(modeCounts.get(id)??0)+1);}break;
 }
 }
 }
 candidates.boards.push(...boards);await writeFile(join(root,'data/animalstats/candidates.json'),JSON.stringify(candidates)+'\n');const report={approvedBoards:boards.length,byMode:Object.fromEntries(['easy','normal','expert'].map(m=>[m,boards.filter(b=>b.mode===m).length])),newPlayableDirections:[...counts].filter(([,n])=>n>0),heldDirections:[...counts].filter(([,n])=>n===0),intuitiveMajority:true,behaviorMaximum:3,fearMaximum:1};await writeFile(join(root,'data/animalstats/research/expansion-board-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await rm(temp,{recursive:true,force:true});}
