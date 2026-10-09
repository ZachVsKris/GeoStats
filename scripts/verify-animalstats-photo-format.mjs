import { readFile } from 'node:fs/promises';
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

 await page.addInitScript(()=>localStorage.setItem('animalstats-presentation-v1','real'));
 console.log('Starting photo layout checks');
 for(const viewport of (process.env.SMALL_ONLY ? [{width:390,height:667},{width:360,height:640}] : [{width:1440,height:900},{width:1366,height:768},{width:1280,height:650},{width:768,height:1024},{width:390,height:844},{width:390,height:667},{width:360,height:640}])) {
  await page.setViewportSize(viewport);
  for(const mode of ['easy','normal','expert']) {
   console.log(viewport.width,viewport.height,mode);
   await page.goto(`http://localhost:3012/animals?mode=${mode}`,{waitUntil:'networkidle'});
   await page.locator('.country').last().waitFor();
   assert.equal(await page.locator('.country').count(),mode==='easy'?4:mode==='normal'?6:8);
   await page.waitForFunction(()=>[...document.querySelectorAll('.country img')].every(i=>i.complete&&i.naturalWidth));
   const frames=await page.locator('.country img').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),c=n.closest('.country').getBoundingClientRect();return {w:r.width,h:r.height,inside:r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right};}));
   assert(frames.every(f=>Math.abs(f.w-f.h)<1&&f.inside),JSON.stringify(frames));assert(Math.max(...frames.map(f=>f.w))-Math.min(...frames.map(f=>f.w))<1.5,JSON.stringify(frames));
   const fit=async()=>page.evaluate(()=>{
 const targets=[...document.querySelectorAll('.country,.country strong,.slot,.slot .category,.slot .choice,.submitAnswersButton')];
 const bad=targets.map(n=>({name:n.className,rect:n.getBoundingClientRect().toJSON(),scroll:n.scrollHeight,client:n.clientHeight})).filter(x=>x.rect.top<0||x.rect.bottom>innerHeight+1||x.rect.left<0||x.rect.right>innerWidth+1||x.scroll>x.client+2);
 return {height:document.documentElement.scrollHeight,viewport:innerHeight,bad,panels:bad.length?[...document.querySelectorAll('.activePlay,.playGrid,.boardPanel,.slots,.lock')].map(n=>({name:n.className,rect:n.getBoundingClientRect().toJSON(),css:{height:getComputedStyle(n).height,minHeight:getComputedStyle(n).minHeight,flex:getComputedStyle(n).flex,padding:getComputedStyle(n).padding,overflow:getComputedStyle(n).overflow}})):[]};
});
   let result=await fit();assert(result.height<=viewport.height+1&&result.bad.length===0,JSON.stringify(result));
   for(let i=0;i<await page.locator('.slot').count();i++){await page.locator('.country').nth(i).click();await page.locator('.slot').nth(i).click();}
   result=await fit();assert(result.height<=viewport.height+1&&result.bad.length===0,'Filled '+JSON.stringify(result));
   while(await page.locator('.removePiece').count()) await page.locator('.removePiece').first().click();
   await page.locator('.country').first().click();const selected=await page.locator('.country.selected').getAttribute('data-animal-id');
   await page.getByRole('button',{name:'View photos',exact:true}).click();await page.getByRole('dialog',{name:'Animal photos'}).waitFor();
   assert.equal(await page.getByRole('dialog').locator('figure').count(),frames.length);
   const photo=await page.getByRole('dialog').locator('figure > img').first().boundingBox();assert(photo.width>frames[0].w);
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.country.selected').getAttribute('data-animal-id'),selected);
  }
 }
 for(const viewport of [{width:1366,height:768},{width:1280,height:650},{width:390,height:844},{width:390,height:667},{width:360,height:640}]) {
  await page.setViewportSize(viewport);
  for(const mode of ['easy','normal','expert']) {
   console.log('Cute',viewport.width,viewport.height,mode);
   await page.goto(`http://localhost:3012/animals?mode=${mode}`,{waitUntil:'networkidle'});
   await page.locator('.country').last().waitFor();await page.getByRole('switch',{name:'Static animal photos'}).click();
   const count=await page.locator('.traitPodium').count();
   for(let i=0;i<count;i++){await page.locator('.penAnimal').nth(i).click();await page.locator('.traitPodium').nth(i).click();}
   const result=await page.evaluate(()=>({height:document.documentElement.scrollHeight,bad:[...document.querySelectorAll('.penAnimal,.animalNameTag,.traitPodium,.animalTraitName,.podiumNameTag,.animalSubmit > button')].map(n=>({name:n.className,r:n.getBoundingClientRect().toJSON(),scroll:n.scrollHeight,client:n.clientHeight})).filter(x=>x.r.bottom>innerHeight+1||x.r.top<0||x.r.right>innerWidth+1||x.scroll>x.client+2)}));
   assert(result.height<=viewport.height+1&&result.bad.length===0,JSON.stringify(result));
  }
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({squareFrames:true,consistentSize:true,unclipped:true,allDifficulties:true,desktopAndPhone:true,photoGallery:true,preservesChoice:true,pageErrors:errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
