import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';import {dirname,join} from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url))),require=createRequire(join(root,'package.json')),ts=require('typescript'),temp=await mkdtemp(join(tmpdir(),'animal-pets-'));
const combinations=(a,n)=>n===0?[[]]:a.flatMap((v,i)=>combinations(a.slice(i+1),n-1).map(s=>[v,...s]));
try{
 for(const file of ['categorySemantics','gameRules','animalstats','animalstatsComposition']){
  const code=ts.transpileModule(await readFile(join(root,'lib',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"');await writeFile(join(temp,file+'.mjs'),code);
 }
 const {createAnimalBoardValidator}=await import(pathToFileURL(join(temp,'animalstats.mjs'))),{animalBoardComposition}=await import(pathToFileURL(join(temp,'animalstatsComposition.mjs')));
 const data=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8')),candidates=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8')),validate=createAnimalBoardValidator(data);
 const values=new Map(data.values.filter(v=>v.confidence==='approved').map(v=>[v.animalId+':'+v.traitId,v]));
 const boards=[],rejects={};let count=0;
 for(const kind of ['dog','cat']){
  const keys=[`pet_${kind}_adult_mass`,`pet_${kind}_popularity`,`pet_${kind}_litter`,kind==='cat'?'pet_cat_lifespan':'pet_dog_survival'];
  const animals=data.animals.filter(a=>a.taxonomicGroup===kind+'-breed'&&data.photos.some(p=>p.animalId===a.id&&p.approved)&&keys.every(k=>values.has(a.id+':'+k))).map(a=>a.id);
  for(const mode of ['easy','normal']) for(const animalIds of combinations(animals,mode==='easy'?4:6)){
   // Fast separation checks before the full source/composition/winner validator.
   if(keys.some(k=>{const rows=animalIds.map(a=>values.get(a+':'+k)).sort((a,b)=>a.valueNumeric-b.valueNumeric);return rows.slice(1).some((b,i)=>{const a=rows[i];return b.valueNumeric/a.valueNumeric<1.05-1e-12||(a.valueMax??a.valueNumeric)>=(b.valueMin??b.valueNumeric);});}))continue;
   for(let mask=0;mask<16;mask++){
    const traitIds=keys.map((k,i)=>k+(mask&(1<<i)?'__low':''));
    const board={id:`fair-pet-${kind}-${mode}-${count++}-20261006`,mode,boardType:'themed',animalIds,traitIds,editorial:{families:['mass','population','offspring','longevity'],multiTraitContenders:2,policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:4}};
    const result=validate(board),composition=animalBoardComposition(data,board);
    if(result.valid&&composition.eligible)boards.push(board);else for(const reason of result.rejectionReasons)rejects[reason]=(rejects[reason]??0)+1;
   }
  }
 }
 candidates.boards=[...candidates.boards.filter(b=>!b.id?.startsWith('fair-pet-')),...boards];await writeFile(join(root,'data/animalstats/candidates.json'),JSON.stringify(candidates)+'\n');
 const report={approvedBoards:boards.length,dogBoards:boards.filter(b=>b.id.includes('-dog-')).length,catBoards:boards.filter(b=>b.id.includes('-cat-')).length,playedBreeds:[...new Set(boards.flatMap(b=>b.animalIds))],lineups:new Set(boards.map(b=>b.animalIds.slice().sort().join(','))).size,allFourPrizesIntuitive:true,independentWinnersAndReportedBounds:true,rejectionCounts:rejects};await writeFile(join(root,'data/animalstats/research/pet-board-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await rm(temp,{recursive:true,force:true});}
