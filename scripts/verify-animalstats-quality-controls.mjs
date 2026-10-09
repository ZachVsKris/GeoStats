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
 await page.goto('http://localhost:3012/animals',{waitUntil:'networkidle'});await page.getByRole('switch',{name:'Static animal photos'}).click();
 for(const mode of ['easy','normal','expert']) {
  await page.goto(`http://localhost:3012/animals?mode=${mode}`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Daily',exact:true}).click();if(await page.getByRole('switch').getAttribute('aria-checked')==='false')await page.getByRole('switch').click();await page.locator('.country').nth(mode==='easy'?3:mode==='normal'?5:7).waitFor();assert.equal(await page.locator('.country').count(),mode==='easy'?4:mode==='normal'?6:8);
  await page.getByRole('button',{name:'New random board',exact:true}).click();assert((await page.locator('.challengeIdentity').textContent()).includes('Random'));
 }
 await page.getByRole('switch').click();
 const colors=await page.locator('.podiumBadge').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));assert.equal(new Set(colors).size,6);
 await page.getByText('Help & tools',{exact:true}).click();await page.getByRole('button',{name:'How to play',exact:true}).click();await page.getByRole('dialog',{name:'How to play'}).waitFor();await page.getByRole('button',{name:'Back to game',exact:true}).click();
 await page.getByText('Help & tools',{exact:true}).click();await page.getByRole('button',{name:'Scoring',exact:true}).click();await page.getByRole('dialog',{name:'Scoring'}).waitFor();await page.keyboard.press('Escape');
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Blocked','NotAllowedError');};});await page.getByRole('button',{name:'Copy link',exact:true}).click();await page.getByRole('dialog',{name:'Copy challenge link'}).waitFor();assert(new URL(await page.getByRole('textbox',{name:'Challenge link to copy'}).inputValue()).searchParams.get('board'));await page.keyboard.press('Escape');
 await page.getByText('Help & tools',{exact:true}).click();await page.getByRole('button',{name:'Categories',exact:true}).click();await page.locator('.animalDataTable').waitFor();assert(await page.getByRole('button',{name:'Play',exact:true}).count()>0);await page.getByRole('button',{name:'Play',exact:true}).first().click();await page.locator('.traitPodium').first().waitFor();
 await page.getByText('Help & tools',{exact:true}).click();await page.getByRole('button',{name:'Full data',exact:true}).click();await page.locator('.animalDataTable').waitFor();assert((await page.locator('.animalDataBrowser').textContent()).includes('217'));
 await page.getByRole('button',{name:'Back to game',exact:true}).click();
 await page.setViewportSize({width:390,height:667});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.setViewportSize({width:1440,height:900});await page.goto('http://localhost:3012/animals?board=fair-pet-cat-easy-3313-20261006',{waitUntil:'networkidle'});
 if(await page.getByRole('switch').getAttribute('aria-checked')==='false')await page.getByRole('switch').click();
 for(let i=0;i<4;i++){await page.locator('.country').nth(i).click();await page.locator('.slot').nth(i).click();}
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();
 await page.route('**/api/animals/data?trait=*',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.getByRole('button',{name:'View rankings',exact:true}).first().click();await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();
 await page.getByRole('button',{name:'Download saved data (CSV)'}).waitFor();assert(await page.getByRole('button',{name:'Download saved data (CSV)'}).isEnabled());
 assert.deepEqual(errors,[]);console.log(JSON.stringify({dailyModes:true,ribbonColors:6,help:true,manualCopy:true,catalogNavigation:true,phoneFit:true,sourceFallback:true,pageErrors:errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
