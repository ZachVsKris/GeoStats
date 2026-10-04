import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { validateAnimalBoard, type AnimalDataset, type BoardCandidate } from '../lib/animalstats';
const data=JSON.parse(readFileSync(new URL('../data/animalstats/pilot.json',import.meta.url),'utf8')) as AnimalDataset;
const boards=JSON.parse(readFileSync(new URL('../data/animalstats/candidates.json',import.meta.url),'utf8')).boards as BoardCandidate[];
const added=['adult_intestine_length','weaning_mass','male_maturity'];
test('each new direction has playable boards and preserves earlier shared challenges',()=>{
 const retained=JSON.parse(readFileSync(new URL('../data/animalstats/retained-live-boards.json',import.meta.url),'utf8')).boards as BoardCandidate[];
 for(const base of added)for(const id of [base,base+'__low']){
  const matching=boards.filter(b=>b.traitIds.includes(id));expect(matching.length).toBeGreaterThan(0);
  expect(matching.every(b=>validateAnimalBoard(data,b).valid)).toBe(true);
 }
 for(const old of retained){const now=boards.find(b=>b.id===old.id);expect(now?.animalIds).toEqual(old.animalIds);expect(now?.traitIds).toEqual(old.traitIds);}
 const rows=data.values.filter(v=>v.traitId==='adult_intestine_length');expect(rows).toHaveLength(8);
 expect(rows.some(v=>v.animalId==='ailuropoda_melanoleuca')).toBe(false);
 expect(rows.some(v=>v.animalId==='giraffa_camelopardalis'&&v.valueNumeric===5648)).toBe(true);
 expect(rows.every(v=>v.lifeStage==='adult'&&v.observationType==='compiled'&&v.valueMin===undefined)).toBe(true);
});
test.skip(process.env.ANIMALSTATS_PREVIEW_ENABLED!=='true','Animal preview flag required');
test('new prizes play, score and expose the full sourced rankings',async({page,request})=>{
 for(const base of added){
  const board=boards.find(b=>b.mode==='easy'&&b.traitIds.includes(base))!;
  await page.goto('/animals?board='+board.id);
  await expect(page.locator('.animalTrait').filter({hasText:data.traits.find(t=>t.id===base)!.displayName})).toBeVisible();
  for(let i=0;i<4;i++){await page.locator('.animalTrait').nth(i).click();await page.locator('.animalCard').nth(i).click();}
  await page.getByRole('button',{name:'Submit answers'}).click();await expect(page.locator('.resultWrap')).toHaveCount(4);
  const response=await request.get('/api/animals/data?trait='+base);expect(response.status()).toBe(200);
  const body=await response.json();expect(body.values.length).toBe(data.values.filter(v=>v.traitId===base&&v.confidence==='approved').length);
 }
});
