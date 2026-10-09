/** Explicit release board review. Does not approve the entire candidate pool. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),ts=require('typescript'),temp=await mkdtemp(join(tmpdir(),'animal-review-'));
try {
 for(const name of ['categorySemantics','gameRules','animalstats','animalstatsReview','animalstatsCoverage','animalstatsComposition']) {
  const code=ts.transpileModule(await readFile(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"');
  await writeFile(join(temp,name+'.mjs'),code);
 }
 const {animalBoardFingerprint,animalBoardDataFingerprint}=await import(pathToFileURL(join(temp,'animalstatsReview.mjs')));
 const {createAnimalBoardValidator}=await import(pathToFileURL(join(temp,'animalstats.mjs')));
 const {publishedAnimalTraitIds}=await import(pathToFileURL(join(temp,'animalstatsCoverage.mjs')));
 const {animalBoardComposition}=await import(pathToFileURL(join(temp,'animalstatsComposition.mjs')));
 const data=JSON.parse(await readFile('data/animalstats/pilot.json','utf8')),boards=JSON.parse(await readFile('data/animalstats/candidates.json','utf8')).boards;
 const validate=createAnimalBoardValidator(data),published=publishedAnimalTraitIds(data);
 const ids=['fair-pet-cat-easy-3313-20261006','ecbcf54fcb5c8fec','fair-expert-birds-1-20261005'];
 const manifest=ids.map(id=>{
  const board=boards.find(b=>b.id===id);if(!board||!validate(board).valid||!animalBoardComposition(data,board).eligible||!board.traitIds.every(id=>published.has(id)))throw Error('Reviewed board failed: '+id);
  return {boardId:id,status:'approved',reviewer:'Codex release review',reviewedAt:'2026-10-09T18:35:00Z',sourceChecks:'Reviewed pinned source identities, category definitions and existing approved observation provenance for these three boards. Pet source transcription records retained. This release review does not replace scientific observation review.',uncertaintyChecks:'No imputed or held observations; comparable sex/stage and units; source intervals do not overlap. Missing intervals remain not reported, not zero uncertainty.',playabilityChecks:'Reviewed familiar species/breed identities and intuitive-majority composition. Distinct winners permit a perfect score. One board per difficulty in this initial reviewed Daily set; it repeats until additional boards are reviewed.',fingerprint:animalBoardFingerprint(board),dataFingerprint:animalBoardDataFingerprint(data,board)};
 });
 await writeFile('data/animalstats/reviews.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.map(r=>({id:r.boardId,status:r.status}))));
} finally {await rm(temp,{recursive:true,force:true});}
