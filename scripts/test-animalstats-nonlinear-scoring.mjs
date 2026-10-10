import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';import {createRequire} from 'node:module';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';
const ts=createRequire(import.meta.url)('typescript'),temp=await mkdtemp(join(tmpdir(),'animal-scores-'));
try {
 for(const name of ['categorySemantics','gameRules','animalstats','animalstatsScoring','animalstatsHistory'])await writeFile(join(temp,name+'.mjs'),ts.transpileModule(await readFile('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 const {ROUND_CONFIGS}=await import(pathToFileURL(join(temp,'gameRules.mjs'))),{readAnimalHistory,animalStats}=await import(pathToFileURL(join(temp,'animalstatsHistory.mjs'))),{scoreAnimalAssignments}=await import(pathToFileURL(join(temp,'animalstatsScoring.mjs')));
 const expected={easy:[100,65,45,25],normal:[100,70,45,25,10,0],expert:[100,75,55,40,25,15,5,0]};
 for(const mode of Object.keys(expected)) {
  assert.deepEqual(ROUND_CONFIGS[mode].pointsByRank,expected[mode]);assert(expected[mode].every(p=>p%5===0));
  for(let rank=1;rank<=expected[mode].length;rank++) {
   const ranks=Array(ROUND_CONFIGS[mode].categoryCount).fill(rank),row={id:'saved',boardId:'old',date:'2026-10-08',completedAt:'2026-10-08T12:00:00Z',mode,kind:'daily',score:ROUND_CONFIGS[mode].maxScore,optimalChoices:0,averagePlacement:1,ranks};
   const parsed=readAnimalHistory(JSON.stringify([row]));assert.equal(parsed[0].score,expected[mode][rank-1]*ranks.length);assert.equal(parsed[0].optimalChoices,rank===1?ranks.length:0);assert.equal(parsed[0].averagePlacement,rank);assert.equal(animalStats(parsed,mode).best,parsed[0].score);
   assert.deepEqual(readAnimalHistory(JSON.stringify([{...row,ranks:ranks.map(()=>0)}])),[]);
  }
 }
 const d=JSON.parse(await readFile('data/animalstats/pilot.json','utf8')),boards=JSON.parse(await readFile('data/animalstats/candidates.json','utf8')).boards;
 for(const mode of Object.keys(expected)) {
  let passed=0;
  for(const b of boards.filter(b=>b.mode===mode)) {
   const input=Object.fromEntries(b.traitIds.map((id,i)=>[id,b.animalIds[i]])),result=scoreAnimalAssignments(d,b,input);if(!result)continue;
   assert.equal(result.score,result.ranks.reduce((sum,r)=>sum+expected[mode][r-1],0));assert.equal(result.optimalChoices,result.ranks.filter(r=>r===1).length);if(++passed===10)break;
  }
  assert.equal(passed,10);
 }
 console.log('All scoring placements, saved-history recalculation, invalid-rank rejection and 30 server-scored boards passed.');
}finally{await rm(temp,{recursive:true,force:true})}
