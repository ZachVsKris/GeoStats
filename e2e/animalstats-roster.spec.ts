import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createAnimalBoardValidator,validateAnimalBoard,type AnimalDataset,type BoardCandidate} from '../lib/animalstats';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../data/animalstats/'+name,import.meta.url),'utf8'));
const data=read('pilot.json') as AnimalDataset;
const boards=read('candidates.json').boards as BoardCandidate[];
const audit=read('research/roster-expansion-audit.json');
test('every roster addition appears in playable rounds with documented comparable values',()=>{
 const validate=createAnimalBoardValidator(data);
 for(const scientific of Object.keys(audit.newAnimals)){
  const id=scientific.toLowerCase().replaceAll(' ','_');
  const matches=boards.filter(b=>b.animalIds.includes(id));
  expect(matches.length,id).toBeGreaterThan(0);
  expect(matches.every(b=>validate(b).valid),id).toBe(true);
  expect(data.values.filter(v=>v.animalId===id&&v.confidence==='approved').length,id).toBeGreaterThan(0);
 }
});
test('cached validator retains an isolated snapshot and fresh validation sees mutations',()=>{
 const mutable=structuredClone(data),board=boards[0];
 const validate=createAnimalBoardValidator(mutable);
 expect(validate(board)).toEqual(validateAnimalBoard(mutable,board));
 mutable.values.find(v=>v.animalId===board.animalIds[0]&&v.traitId===board.traitIds[0])!.confidence='rejected';
 expect(validateAnimalBoard(mutable,board).valid).toBe(false);
 expect(validate(board).valid).toBe(true);
 expect(createAnimalBoardValidator(mutable)(board).valid).toBe(false);
});
test.skip(process.env.ANIMALSTATS_PREVIEW_ENABLED!=='true','Animal preview flag required');
test('full rankings include the new animals even outside the current round',async({request})=>{
 test.setTimeout(120_000);
 for(const tid of new Set(boards.flatMap(b=>b.traitIds))){
  const response=await request.get('/api/animals/data?trait='+tid);expect(response.status()).toBe(200);
  const body=await response.json();
  const expected=data.values.filter(v=>v.traitId===tid&&v.confidence==='approved');
  expect(body.values.length).toBe(expected.length);
  for(const row of expected.filter(v=>Object.keys(audit.newAnimals).some(n=>n.toLowerCase().replaceAll(' ','_')===v.animalId))){
   expect(body.values.some((v:{animalId:string,valueNumeric:number})=>v.animalId===row.animalId&&Math.abs(v.valueNumeric-row.valueNumeric)<1e-9),row.animalId+' '+tid).toBe(true);
  }
 }
});
