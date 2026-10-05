/** Source semantic review gate. Run after importing/rebuilding the catalog. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),ts=createRequire(join(root,'package.json'))('typescript');
const data=JSON.parse(await readFile('data/animalstats/pilot.json','utf8'));
const review=JSON.parse(await readFile('data/animalstats/research/longevity-review-decisions.json','utf8'));
const holds=new Map(review.decisions.filter(r=>r.decision==='hold').map(r=>[r.animalId,r]));
let held=0;
for(const v of data.values) if(v.sourceId==='anage-15'&&holds.has(v.animalId)&&/lifespan|longevity/.test(v.traitId)) {
 v.confidence='review';
 const note='Longevity review 2026-10-05: '+holds.get(v.animalId).reason;
 if(!v.notes.includes(note))v.notes+='; '+note;
 held++;
}
await writeFile('data/animalstats/pilot.json',JSON.stringify(data,null,2)+'\n');
const temp=await mkdtemp(join(tmpdir(),'animal-longevity-'));
try {
 for(const file of ['categorySemantics','gameRules','animalstats']) {
 const code=ts.transpileModule(await readFile(join(root,'lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"');
 await writeFile(join(temp,file+'.mjs'),code);
 }
 const {createAnimalBoardValidator}=await import(pathToFileURL(join(temp,'animalstats.mjs')));
 const validate=createAnimalBoardValidator(data),p='data/animalstats/candidates.json',pool=JSON.parse(await readFile(p,'utf8'));
 const withdrawn=[];
 pool.boards=pool.boards.filter(b=>{const result=validate(b);if(result.valid)return true;withdrawn.push({id:b.id,reasons:result.rejectionReasons});return false;});
 await writeFile(p,JSON.stringify(pool,null,2)+'\n');
 await writeFile('data/animalstats/research/longevity-withdrawn-boards.json',JSON.stringify({heldObservations:held,remainingBoards:pool.boards.length,withdrawn},null,2)+'\n');
 console.log({heldObservations:held,remainingBoards:pool.boards.length,withdrawnBoards:withdrawn.length});
} finally {await rm(temp,{recursive:true,force:true});}
