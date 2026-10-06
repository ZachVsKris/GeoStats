import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const require=createRequire(join(root,'package.json'));
const {chromium}=require('playwright');
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3012'],{cwd:root,env:{...process.env,ANIMALSTATS_PREVIEW_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
let browser,logs=''; server.stderr.on('data',x=>logs+=x);
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout '+logs)),60000);server.stdout.on('data',x=>{logs+=x;if(logs.includes('Ready in')){clearTimeout(timer);resolve();}});server.on('exit',()=>reject(Error(logs)));});
 browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));

 await mkdir(join(root,'artifacts'),{recursive:true});
 const data=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const boards=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8')).boards;
 const tested=[];
 for(const kind of ['dog','cat']) {
  const board=boards.find(b=>b.id.startsWith('fair-pet-'+kind+'-easy-'));assert(board);
  await page.goto('http://localhost:3012/animals?board='+board.id,{waitUntil:'networkidle',timeout:120000});
  const lever=page.getByRole('switch',{name:'Real animal photos'});
  if(await lever.getAttribute('aria-checked')==='true')await lever.click();
  assert.equal(await page.locator('.penAnimal .animalSprite').count(),4);
  await page.screenshot({path:join(root,'artifacts/pets-'+kind+'-cute.png'),fullPage:true});
  await lever.click();
  assert.equal(await page.locator('.country').count(),4);
  await page.waitForFunction(()=>[...document.querySelectorAll('.country img')].length===4&&[...document.querySelectorAll('.country img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:join(root,'artifacts/pets-'+kind+'-real.png'),fullPage:true});
  for(const tid of board.traitIds){
   const trait=data.traits.find(t=>t.id===tid);assert.equal(trait.categoryKind,'intuitive');
   const rows=data.values.filter(v=>v.traitId===tid&&board.animalIds.includes(v.animalId)).sort((a,b)=>trait.direction==='higher_wins'?b.valueNumeric-a.valueNumeric:a.valueNumeric-b.valueNumeric);
   await page.locator('.country[data-animal-id="'+rows[0].animalId+'"]').click();
   await page.locator('.slot[data-trait-id="'+tid+'"]').click();
  }
  await lever.click();assert.equal(await page.locator('.traitPodium .animalSprite').count(),4);
  await lever.click();assert.equal(await page.locator('.choice.filled').count(),4);
  await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'400');
  assert.equal(await page.locator('.resultWrap').count(),4);
  for(const tid of board.traitIds){
   const trait=data.traits.find(t=>t.id===tid),expected=data.values.filter(v=>v.traitId===tid&&v.confidence==='approved');
   const api=await page.request.get('http://localhost:3012/api/animals/data?trait='+tid);assert(api.ok());const payload=await api.json();assert.equal(payload.values.length,expected.length);
   assert(payload.values.every(v=>v.sourceId===trait.canonicalSourceId));
   const row=page.locator('.result').filter({hasText:trait.displayName});await row.getByRole('button',{name:'View rankings',exact:true}).click();
   await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.sourceLoading'));
   assert.equal(await page.locator('.sourceDataRow').count(),expected.length);
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download full data (CSV)'}).click();assert((await download).suggestedFilename().endsWith('.csv'));
   await page.getByRole('button',{name:'Close data and source'}).click();
  }
  await lever.click();assert.equal(await page.locator('.resultMain .animalSprite').count(),4);
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:join(root,'artifacts/pets-'+kind+'-phone-results.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:900});tested.push(board.id);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({petBoards:tested,perfectScores:true,bothModes:true,fullSourceRowsAndCSVs:true,phone:true,pageErrors:errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
