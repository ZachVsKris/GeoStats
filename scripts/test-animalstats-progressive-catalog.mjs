import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';import {pathToFileURL} from 'node:url';
const temp=fs.mkdtempSync('/tmp/animal-progressive-');
try {
 for(const name of ['animalstatsDataTransport','animalstatsBoardTransport'])fs.writeFileSync(`${temp}/${name}.mjs`,ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {packAnimalData,unpackAnimalData}=await import(pathToFileURL(`${temp}/animalstatsDataTransport.mjs`));const {openingAnimalBoards,appendAnimalBoards}=await import(pathToFileURL(`${temp}/animalstatsBoardTransport.mjs`));
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
 const data=Object.fromEntries(['animals','traits','values','sources','photos'].map(k=>[k,parts.flatMap(p=>p[k])]));
 const project=v=>({animalId:v.animalId,traitId:v.traitId,valueNumeric:v.valueNumeric,unit:v.unit,sourceId:v.sourceId,confidence:v.confidence,observationType:v.observationType,sex:v.sex,lifeStage:v.lifeStage,valueMin:v.valueMin,valueMax:v.valueMax,notes:'',measurementBasis:''});
 const client={...data,values:data.values.map(project)},packed=packAnimalData(client),decoded=unpackAnimalData(JSON.parse(JSON.stringify(packed)));
 assert.deepEqual(decoded,client,'source identity, numeric values, stage/sex and disagreement envelopes must survive network serialization');
 const before=Buffer.byteLength(JSON.stringify(client)),after=Buffer.byteLength(JSON.stringify(packed));assert(after<before/2);
 const detailedBytes=Buffer.byteLength(JSON.stringify(data)),packedDetails=packAnimalData(data);assert(Buffer.byteLength(JSON.stringify(packedDetails))<detailedBytes/2,'Browsing should defer full source notes rather than downloading them for every animal');
 const boards=['candidates','group-boards','group-boards-2','extinct'].flatMap(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)).boards);
 const shared=boards.at(-1).id,approved=boards.slice(-10).map(b=>b.id),opening=openingAnimalBoards(boards,approved,shared),full=appendAnimalBoards(opening,boards);
 assert(opening.length<500);assert.equal(new Set(full.map(b=>b.id)).size,new Set(boards.map(b=>b.id)).size);
 assert.deepEqual(new Set(opening.flatMap(b=>b.traitIds)),new Set(boards.flatMap(b=>b.traitIds)));
 for(const id of [...approved,shared])assert(opening.some(b=>b.id===id));
 for(const mode of ['easy','normal','expert'])for(const collection of ['living','extinct-special'])for(const trait of [null,...new Set(opening.flatMap(b=>b.traitIds))]){
  const filter=b=>b.mode===mode&&(b.collection??'living')===collection&&(!trait||b.traitIds.includes(trait));
  const prefix=opening.filter(filter),expanded=full.filter(filter);assert.deepEqual(expanded.slice(0,prefix.length),prefix,'loading the catalog must never move an active board or category-focused round');
 }
 console.log(JSON.stringify({values:data.values.length,fullObservationBytes:detailedBytes,dataBytesBefore:before,dataBytesAfter:after,dataReductionPercent:Math.round((1-after/before)*100),openingBoards:opening.length,fullBoards:full.length,everyCategoryInitiallyReachable:true,activeRoundOrderPreserved:true}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
