import assert from 'node:assert/strict';import {spawn}from'node:child_process';import {createRequire}from'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),...(process.env.ANIMAL_VERIFY_PRODUCTION==='1'?['start']:['dev','--webpack']),'--hostname','127.0.0.1','--port','3012'],{env:{...process.env,ANIMALSTATS_PREVIEW_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
let browser,release,logs='';for(const stream of [server.stdout,server.stderr])stream.on('data',x=>logs+=x);
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),60000);server.stdout.on('data',()=>{if(logs.includes('Ready in')){clearTimeout(timer);resolve();}});server.on('exit',()=>reject(Error(logs)));});
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:667}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requested;const requestStarted=new Promise(resolve=>requested=resolve);const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/animals/boards',async route=>{requested();try {const response=await route.fetch({timeout:120000});await gate;await route.fulfill({response});} catch(error) {console.error('Catalog interception:',error.message);}});
 const started=Date.now();const response=await page.goto('http://localhost:3012/animals',{waitUntil:'domcontentloaded',timeout:120000});
 const initialResponseMilliseconds=Date.now()-started;console.log('SSR loaded; awaiting hydration');await requestStarted;console.log('Hydrated; interacting before catalog');await page.locator('.penAnimal').last().waitFor();const ids=await page.locator('.penAnimal').evaluateAll(nodes=>nodes.map(n=>n.dataset.animalId));
 await page.locator('.penAnimal').first().focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.penAnimal')?.getAttribute('aria-pressed')==='true');await page.locator('.traitPodium').first().focus();await page.keyboard.press('Enter');
 const choice=await page.locator('.traitPodium').first().locator('.podiumNameTag').textContent();
 console.log('Selection made; releasing catalog');const loaded=page.waitForResponse('**/api/animals/boards',{timeout:120000});release();const catalogResponse=await loaded;assert.equal(catalogResponse.status(),200);assert.equal(catalogResponse.headers()['x-animalstats-validation'],'build-audit','production must use the exact audited snapshot');await page.waitForTimeout(500);
 assert.deepEqual(await page.locator('.penAnimal').evaluateAll(nodes=>nodes.map(n=>n.dataset.animalId)),ids);assert.equal(await page.locator('.traitPodium').first().locator('.podiumNameTag').textContent(),choice);
 assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
 await page.getByRole('switch',{name:'Static animal images'}).click();assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
 assert.deepEqual(errors,[]);const bytes=Buffer.byteLength(await response.text());
 console.log(JSON.stringify({initialHtmlBytes:bytes,initialResponseMilliseconds,playableBeforeFullCatalog:true,selectionPreservedAfterLoad:true,cuteAndStaticPhoneFit:true,pageErrors:errors}));
}catch(error){console.error('Verification failure:',error.message,logs);throw error;}finally{release?.();await browser?.close();server.kill('SIGTERM');}
