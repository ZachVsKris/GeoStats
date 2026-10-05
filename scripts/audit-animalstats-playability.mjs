/** Reproducible release audit. Structural validation is not a fresh scientific review. */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),require=createRequire(join(root,'package.json')),ts=require('typescript');
const temp=await mkdtemp(join(tmpdir(),'animal-board-audit-'));
try {
 for(const file of ['categorySemantics','gameRules','animalstats','animalstatsComposition','animalstatsVariety','animalstatsDaily','animalstatsCartoons']) {
  const code=ts.transpileModule(await readFile(join(root,'lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"');
  await writeFile(join(temp,file+'.mjs'),code);
 }
 const {createAnimalBoardValidator,validateAnimalDataset}=await import(pathToFileURL(join(temp,'animalstats.mjs')));
 const {animalBoardComposition,commonAnimalIds}=await import(pathToFileURL(join(temp,'animalstatsComposition.mjs')));
 const {randomAnimalBoardIndex,animalBoardGroup}=await import(pathToFileURL(join(temp,'animalstatsVariety.mjs')));
 const {orderAnimalPilotBoards}=await import(pathToFileURL(join(temp,'animalstatsDaily.mjs')));
 const {cartoonSpecies}=await import(pathToFileURL(join(temp,'animalstatsCartoons.mjs')));
 const data=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const candidates=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8')).boards;
 const A=new Map(data.animals.map(a=>[a.id,a])),T=new Map(data.traits.map(t=>[t.id,t])),V=new Map(data.values.map(v=>[v.animalId+':'+v.traitId,v]));
 const count=(ids)=>{const out={};for(const id of ids)out[id]=(out[id]??0)+1;return out;};
 const validate=createAnimalBoardValidator(data),excluded=new Set(['adult_shoulder_height','adult_shoulder_height__low']);
 const evaluations=candidates.map(b=>({board:b,validation:validate(b),composition:animalBoardComposition(data,b)}));
 const valid=evaluations.filter(e=>e.validation.valid&&!e.board.traitIds.some(id=>excluded.has(id)));
 const defaultBoards=valid.filter(e=>e.composition.eligible).map(e=>e.board);
 const labels=new Set(defaultBoards.flatMap(b=>b.traitIds.map(id=>T.get(id).displayName)));
 const valuesUsed=defaultBoards.flatMap(b=>b.traitIds.flatMap(tid=>b.animalIds.map(aid=>V.get(aid+':'+tid))));
 const missingArt=[...new Set(defaultBoards.flatMap(b=>b.animalIds))].filter(id=>!cartoonSpecies.includes(id));
 const counterpartFailures=[];
 for(const t of data.traits.filter(t=>t.prototypeCategory&&t.counterTraitId)) {
  const counter=T.get(t.counterTraitId);
  if(!counter||counter.counterTraitId!==t.id||counter.direction===t.direction)counterpartFailures.push(t.id+':metadata');
  for(const v of data.values.filter(v=>v.traitId===t.id)) {
   const other=V.get(v.animalId+':'+t.counterTraitId);
   const {traitId,...payload}=v;const {traitId:otherId,...otherPayload}=other??{};
   if(JSON.stringify(payload)!==JSON.stringify(otherPayload))counterpartFailures.push(v.animalId+':'+t.id);
  }
 }
 let seed=123456789;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const simulations={};
 for(const mode of ['easy','normal','expert']) {
  const pool=defaultBoards.filter(b=>b.mode===mode),history=[],draws=[];let current;
  for(let i=0;i<3000;i++) {
   const selected=pool[randomAnimalBoardIndex(data,pool,current,random,history)];
   if(!animalBoardComposition(data,selected).eligible)throw Error('Unsafe composition selected');
   draws.push(selected);history.push(selected);if(history.length>12)history.shift();current=selected;
  }
  const availableAnimals=[...new Set(pool.flatMap(b=>b.animalIds))],availableLabels=[...new Set(pool.flatMap(b=>b.traitIds.map(id=>T.get(id).displayName)))];
  const animalCounts=count(draws.flatMap(b=>b.animalIds)),labelCounts=count(draws.flatMap(b=>b.traitIds.map(id=>T.get(id).displayName)));
  simulations[mode]={draws:draws.length,uniqueBoards:new Set(draws.map(b=>b.id)).size,groups:count(draws.map(b=>animalBoardGroup(data,b))),availableAnimals:availableAnimals.length,seenAnimals:Object.keys(animalCounts).length,availableLabels:availableLabels.length,seenLabels:Object.keys(labelCounts).length,unseenAnimals:availableAnimals.filter(id=>!animalCounts[id]),unseenLabels:availableLabels.filter(id=>!labelCounts[id]),animalCounts,labelCounts,immediateRepeatedLineups:draws.filter((b,i)=>i&&b.animalIds.slice().sort().join(',')===draws[i-1].animalIds.slice().sort().join(',')).length};
 }
 const openers=[];
 for(let i=0;i<90;i++) {
  const date=new Date(Date.UTC(2026,9,5+i)).toISOString().slice(0,10),ordered=orderAnimalPilotBoards(defaultBoards,date,data);
  for(const mode of ['easy','normal','expert']) {
   const board=ordered.find(b=>b.mode===mode);if(!board||!animalBoardComposition(data,board).eligible)throw Error('Opening board failed');
   openers.push({date,mode,boardId:board.id,group:animalBoardGroup(data,board),...animalBoardComposition(data,board)});
  }
 }
 const played=new Set(defaultBoards.flatMap(b=>b.animalIds)),usedTraits=new Set(defaultBoards.flatMap(b=>b.traitIds));
 const baseline={};
 for(const mode of ['easy','normal','expert']) {
  const pool=defaultBoards.filter(b=>b.mode===mode),groups=new Map();
  pool.forEach((b,i)=>{const g=animalBoardGroup(data,b);groups.set(g,[...(groups.get(g)??[]),i]);});
  const draws=[];let current;
  for(let i=0;i<3000;i++) {
   const currentGroup=current?animalBoardGroup(data,current):undefined;
   const alternatives=[...groups.keys()].filter(g=>g!==currentGroup),availableGroups=alternatives.length?alternatives:[...groups.keys()];
   const group=availableGroups[Math.floor(random()*availableGroups.length)];
   const fresh=groups.get(group).filter(index=>pool[index].animalIds.slice().sort().join(',')!==current?.animalIds.slice().sort().join(','));
   let options=fresh.length?fresh:groups.get(group);
   const oldRegions=new Set(current?.biogeographicRegions??[]),newRegions=[...new Set(options.flatMap(index=>pool[index].biogeographicRegions??[]))].filter(r=>!oldRegions.has(r));
   if(newRegions.length){const r=newRegions[Math.floor(random()*newRegions.length)];options=options.filter(index=>pool[index].biogeographicRegions?.includes(r));}
   current=pool[options[Math.floor(random()*options.length)]];draws.push(current);
  }
  baseline[mode]={labelCounts:count(draws.flatMap(b=>b.traitIds.map(id=>T.get(id).displayName))),animalCounts:count(draws.flatMap(b=>b.animalIds))};
 }
 const report={auditedAt:new Date().toISOString(),policy:{intuitiveMinimum:'3 of 4 or 4 of 6',commonAnimalMinimum:'1 of 4 or 2 of 6/8',rotation:'subject → prize label → animal, with last 12 boards downweighted',scope:'pinned release data and all candidate boards; source identity, units, eligibility, sex/stage, bounds, rank separation, winners and artwork checked. Does not re-verify every numerical claim against the original publication.'},summary:{catalogAnimals:data.animals.length,catalogObservations:data.values.length,candidateBoards:candidates.length,structurallyValidBoards:valid.length,defaultBoards:defaultBoards.length,defaultDistinctPrizeLabels:labels.size,defaultTraitDirections:usedTraits.size,defaultAnimals:played.size,legacyOnlyBoards:valid.length-defaultBoards.length,invalidBoards:evaluations.filter(e=>!e.validation.valid).length,excludedShoulderHeightBoards:evaluations.filter(e=>e.board.traitIds.some(id=>excluded.has(id))).length,missingArt,datasetErrors:validateAnimalDataset(data),counterpartFailures,comparisonsWithoutReportedBounds:valuesUsed.filter(v=>v.valueMin===undefined||v.valueMax===undefined).length,uniqueObservationsWithoutReportedBounds:new Set(valuesUsed.filter(v=>v.valueMin===undefined||v.valueMax===undefined).map(v=>v.animalId+':'+v.traitId)).size},rejections:evaluations.filter(e=>!e.validation.valid).map(e=>({id:e.board.id,reasons:e.validation.rejectionReasons})),legacyComposition:evaluations.filter(e=>e.validation.valid&&!e.composition.eligible).map(e=>({id:e.board.id,...e.composition})),animals:data.animals.map(a=>({id:a.id,name:a.commonName,group:a.taxonomicGroup,commonAnchor:commonAnimalIds(data).has(a.id),illustrated:cartoonSpecies.includes(a.id),defaultBoards:defaultBoards.filter(b=>b.animalIds.includes(a.id)).length,approvedRankingRows:data.values.filter(v=>v.animalId===a.id&&usedTraits.has(v.traitId)&&v.confidence==='approved'&&v.observationType!=='imputed').length})),categories:[...usedTraits].map(id=>({id,label:T.get(id).displayName,intuitive:T.get(id).categoryKind==='intuitive',source:T.get(id).canonicalSourceId,boards:defaultBoards.filter(b=>b.traitIds.includes(id)).length,coverage:data.values.filter(v=>v.traitId===id&&v.confidence==='approved'&&v.observationType!=='imputed').length})),simulations,baseline,openingBoards:openers};
 await writeFile(join(root,'data/animalstats/research/board-quality-audit.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({summary:report.summary,simulations:Object.fromEntries(Object.entries(simulations).map(([mode,s])=>[mode,{...s,animalCounts:undefined,labelCounts:undefined}]))},null,2));
 if(Object.values(simulations).some(s => s.unseenAnimals.length || s.unseenLabels.length || s.immediateRepeatedLineups))throw Error('Rotation coverage regression');
 if(report.summary.datasetErrors.length||missingArt.length||counterpartFailures.length||report.summary.invalidBoards)throw Error('Release integrity check failed');
} finally {await rm(temp,{recursive:true,force:true});}
