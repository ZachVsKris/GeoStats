import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { validateAnimalDataset, validateAnimalBoard, type AnimalDataset, type BoardCandidate } from '../lib/animalstats';
import { formatAnimalValue } from '../lib/animalstatsFormatting';
const data=JSON.parse(readFileSync(new URL('../data/animalstats/pilot.json',import.meta.url),'utf8')) as AnimalDataset;
const boards=JSON.parse(readFileSync(new URL('../data/animalstats/candidates.json',import.meta.url),'utf8')).boards as BoardCandidate[];
const paired=['measured_eye_length','behavioral_visual_acuity','recorded_chewing_rate','diet_prey_mass_span','raw_hatching_mass','scientific_description_age','iucn_extinction_risk'];
const singles=['diet_largest_prey','diet_smallest_prey'];
const used=new Set(boards.flatMap(b=>b.traitIds));

test('sixteen added labels have playable boards and preserve all earlier links',()=>{
 expect(validateAnimalDataset(data)).toEqual([]);
 expect(new Set(data.traits.filter(t=>used.has(t.id)).map(t=>t.displayName)).size).toBeGreaterThanOrEqual(100);
 for(const id of [...paired.flatMap(t=>[t,t+'__low']),...singles]){
  const matches=boards.filter(b=>b.traitIds.includes(id));expect(matches.length,id).toBeGreaterThan(0);
  expect(matches.every(b=>validateAnimalBoard(data,b).valid),id).toBe(true);
 }
 const old=JSON.parse(readFileSync(new URL('../data/animalstats/retained-live-boards.json',import.meta.url),'utf8')).boards as BoardCandidate[];
 for(const prior of old){const current=boards.find(b=>b.id===prior.id);expect(current?.animalIds).toEqual(prior.animalIds);expect(current?.traitIds).toEqual(prior.traitIds);}
});

test('source admission excludes inferred eyesight, dog-as-wolf and ambiguous maturity',()=>{
 const vision=data.values.filter(v=>v.traitId==='behavioral_visual_acuity');expect(vision).toHaveLength(7);
 expect(vision.find(v=>v.animalId==='macaca_mulatta')?.valueNumeric).toBe(53.6);
 expect(vision.some(v=>v.animalId==='giraffa_camelopardalis')).toBe(false);
 expect(data.values.some(v=>v.traitId==='measured_eye_length'&&v.animalId==='canis_lupus')).toBe(false);
 expect(data.values.some(v=>v.traitId==='recorded_chewing_rate'&&['canis_lupus','ursus_arctos','ursus_thibetanus'].includes(v.animalId))).toBe(false);
 expect(data.values.some(v=>v.animalId==='oryctolagus_cuniculus'&&v.traitId.startsWith('female_maturity'))).toBe(false);
 expect(data.values.find(v=>v.animalId==='oryctolagus_cuniculus'&&v.traitId==='recorded_chewing_rate')?.valueNumeric).toBeCloseTo(60000/180,10);
 const risk=data.values.filter(v=>v.traitId==='iucn_extinction_risk');expect(risk).toHaveLength(135);
 expect(risk.find(v=>v.animalId==='erinaceus_europaeus')?.valueNumeric).toBe(2);
 expect(formatAnimalValue(2,'IUCN category')).toBe('Near Threatened');
 expect(formatAnimalValue(5,'IUCN category')).toBe('Critically Endangered');
});

test('one-sided categories do not weaken paired or ordinal validation',()=>{
 const copy=structuredClone(data);const single=copy.traits.find(t=>t.id==='diet_smallest_prey')!;
 expect(single.oneSided).toBe(true);expect(single.counterTraitId).toBeUndefined();
 single.oneSided=false;expect(validateAnimalDataset(copy)).toContain('trait diet_smallest_prey: invalid counter category');
 single.oneSided=true;single.counterTraitId='diet_largest_prey';expect(validateAnimalDataset(copy)).toContain('trait diet_smallest_prey: one-sided category cannot have a counter');
 const invalid=structuredClone(data);invalid.values.find(v=>v.traitId==='iucn_extinction_risk')!.valueNumeric=3.5;
 expect(validateAnimalDataset(invalid).some(r=>r.includes('invalid ordered conservation category'))).toBe(true);
 const board=boards.find(b=>b.traitIds.includes('iucn_extinction_risk'))!;const tied=structuredClone(data);
 const rows=board.animalIds.map(id=>tied.values.find(v=>v.animalId===id&&v.traitId==='iucn_extinction_risk')!);rows[1].valueNumeric=rows[0].valueNumeric;
 expect(validateAnimalBoard(tied,board).valid).toBe(false);
});

test.skip(process.env.ANIMALSTATS_PREVIEW_ENABLED!=='true','Animal preview flag required');
test('new source families play, score and return complete rankings',async({page,request})=>{
 for(const id of [...paired,...singles]){
  const board=boards.find(b=>b.mode==='easy'&&b.traitIds.includes(id))!;
  await page.goto('/animals?board='+board.id);
  await expect(page.locator('.animalTrait').filter({hasText:data.traits.find(t=>t.id===id)!.displayName})).toBeVisible();
  for(let i=0;i<4;i++){await page.locator('.animalTrait').nth(i).click();await page.locator('.animalCard').nth(i).click();}
  await page.getByRole('button',{name:'Submit answers'}).click();await expect(page.locator('.resultWrap')).toHaveCount(4);
  const response=await request.get('/api/animals/data?trait='+id);expect(response.status()).toBe(200);
  const body=await response.json();expect(body.values.length).toBe(data.values.filter(v=>v.traitId===id&&v.confidence==='approved').length);
  if(id==='iucn_extinction_risk'){
   await page.locator('.resultWrap').filter({hasText:'Most threatened'}).getByRole('button',{name:'View rankings'}).click();
   await page.getByRole('button',{name:'Data & Source',exact:true}).click();
   await expect(page.locator('.sourceDataRow')).toHaveCount(135);await expect(page.locator('.sourceLoading')).toHaveCount(0);await expect(page.locator('.sourceLoadError')).toHaveCount(0);
   await expect(page.locator('.sourceDataRow').first()).toContainText('Critically Endangered');
   await page.getByRole('button',{name:'Close data and source'}).click();
  }
 }
});
test('category browser shows the one-sided low direction and hides absent opposites',async({page})=>{
 await page.goto('/animals');await page.locator('.animalGeoMenu summary').click();await page.getByRole('button',{name:'Categories',exact:true}).click();
 await page.getByLabel('Find a category',{exact:true}).fill('smallest prey');
 const row=page.locator('.animalDataTable tbody tr');await expect(row).toHaveCount(1);
 await expect(row.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await expect(row.getByRole('button',{name:'Play opposite'})).toHaveCount(0);
 await row.getByRole('button',{name:'Play',exact:true}).click();
 await expect(page.locator('.animalTrait').filter({hasText:'Smallest prey in published diet'})).toBeVisible();
});
test('five new mammals have specific animated art and labels',async({page,request})=>{
 for(const id of ['equus_caballus','camelus_dromedarius','oryctolagus_cuniculus','mus_musculus','lemur_catta']){
  const board=boards.find(b=>b.mode==='easy'&&b.animalIds.includes(id))!;expect(board).toBeTruthy();
  await page.goto('/animals?board='+board.id);const sprite=page.locator(`.animalCard [data-animal-id="${id}"]`);
  await expect(sprite).toBeVisible();await expect(sprite).toHaveAttribute('data-normalized-size','142');
  await expect(sprite).toHaveAttribute('data-anatomy',/horse|camel|rabbit|mouse|lemur/);
  const asset=await request.get('/animalstats/'+id+'.svg');expect(asset.status()).toBe(200);
 }
});
