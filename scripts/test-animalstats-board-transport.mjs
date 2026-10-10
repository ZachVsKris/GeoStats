import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const ts=createRequire(import.meta.url)('typescript'),temp=await mkdtemp(join(tmpdir(),'animal-transport-'));
try {
 await writeFile(join(temp,'transport.mjs'),ts.transpileModule(await readFile('lib/animalstatsBoardTransport.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 const {packAnimalBoards,unpackAnimalBoards}=await import(pathToFileURL(join(temp,'transport.mjs')));
 const boards=[];
 for(const file of ['candidates.json','group-boards.json','group-boards-2.json','extinct.json'])boards.push(...JSON.parse(await readFile('data/animalstats/'+file,'utf8')).boards);
 const project=b=>({id:b.id,mode:b.mode,boardType:b.boardType,collection:b.collection,animalIds:b.animalIds,traitIds:b.traitIds,biogeographicRegions:b.biogeographicRegions});
 const packed=packAnimalBoards(boards),decoded=unpackAnimalBoards(JSON.parse(JSON.stringify(packed)));
 assert.deepEqual(decoded,boards.map(project),'all challenge identifiers, order, animals, traits and regions must survive network serialization');
 const bytesBefore=Buffer.byteLength(JSON.stringify(boards.map(project))),bytesAfter=Buffer.byteLength(JSON.stringify(packed));
 assert(bytesAfter<bytesBefore/2,'dictionary transport must halve catalog bytes');
 const minimal={mode:'easy',boardType:'mixed',animalIds:['a'],traitIds:['t']};
 assert.deepEqual(unpackAnimalBoards(packAnimalBoards([minimal])),[project(minimal)]);
 console.log(JSON.stringify({boards:boards.length,bytesBefore,bytesAfter,reductionPercent:Math.round((1-bytesAfter/bytesBefore)*1000)/10}));
}finally{await rm(temp,{recursive:true,force:true});}
