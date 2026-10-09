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
 await page.goto('http://localhost:3012/animals',{waitUntil:'networkidle',timeout:120000});
 const lifespanResponse=await page.request.get('http://localhost:3012/api/animals/data?trait=wild_recorded_lifespan');
 assert.equal(lifespanResponse.status(),404);
 const catalogResponse=await page.request.get('http://localhost:3012/api/animals/data?scope=catalog');const fullCatalog=await catalogResponse.json();assert(!fullCatalog.data.values.some(v=>v.animalId==='proteus_anguinus'&&/lifespan/.test(v.traitId)));
 const animals=page.locator('[data-animal-id].penAnimal'), traits=page.locator('[data-trait-id].traitPodium');
 assert.equal(await animals.count(),4); await animals.nth(0).click();await traits.nth(0).click();
 const placed=await traits.nth(0).getAttribute('data-trait-id');const first=await animals.nth(0).getAttribute('data-animal-id');
 await page.getByRole('switch',{name:'Static animal photos'}).click();assert.equal(await page.locator('.penAnimal').count(),0);assert.equal(await page.locator('.country').count(),4);assert.equal(await page.locator(`[data-trait-id="${placed}"] .choice .pieceName`).textContent(),await page.locator(`.country[data-animal-id="${first}"] strong`).textContent());
 const slots=page.locator('.slot[data-trait-id]'); const info=slots.nth(1).getByRole('button',{name:/Definition of/});
 await info.hover();await page.getByRole('tooltip').waitFor();assert((await page.getByRole('tooltip').textContent()).length>30);await page.mouse.move(0,0);assert.equal(await page.getByRole('tooltip').count(),0);
 await info.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await page.getByRole('tooltip').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
 for(let i=1;i<4;i++){await page.locator('.country').nth(i).click();await slots.nth(i).click();}
 await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.country img')];return images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0);},{},{timeout:15000});
 await page.screenshot({path:join(root,'artifacts/animalstats-real-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();await page.locator('.resultWrap').first().waitFor();const points=await page.locator('.placementSummary strong').allTextContents();assert.deepEqual(points.map(t=>parseInt(t)),points.map(t=>parseInt(t)).sort((a,b)=>b-a));assert.equal(await page.locator('.perfectRow').count(),4);assert.equal(await page.locator('.scoreShareOptions').count(),1);assert.equal(await page.locator('.resultWrap').count(),4);assert.equal(await page.locator('.resultMain b').first().textContent(),'Your Choice');assert.equal(await page.locator('.mobileBestMatch').count(),4);
 await page.getByRole('button',{name:'View rankings',exact:true}).first().click();assert.equal(await page.locator('.leaderboard').count(),1);await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close data and source'}).click();
 await page.screenshot({path:join(root,'artifacts/animalstats-results-desktop.png'),fullPage:true});
 await page.getByRole('switch').click();assert.equal(await page.locator('.resultWrap').count(),4);assert.equal(await page.locator('.resultMain .animalSprite').count(),4);
 await page.getByRole('button',{name:'Generate another board'}).click();await page.setViewportSize({width:390,height:844});await page.getByRole('switch').click();await page.screenshot({path:join(root,'artifacts/animalstats-real-phone.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByRole('switch').click();await page.screenshot({path:join(root,'artifacts/animalstats-cute-phone.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByRole('switch').click();
 const mobileSlot=page.locator('.slot').first();await mobileSlot.getByRole('button',{name:/Definition of/}).click();await page.getByRole('tooltip').waitFor();assert.equal(await page.locator('.choice.filled').count(),0);await Promise.all([page.waitForURL('http://localhost:3012/animals'),page.locator('.animalGeoBrand').click()]);await page.waitForLoadState('networkidle');await page.locator('.realAnimalPage').waitFor();
 const lever=page.getByRole('switch');if(await lever.getAttribute('aria-checked')==='false')await lever.click();
 async function drag(from,to){const a=await from.boundingBox(),b=await to.boundingBox();assert(a&&b);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();}
 await page.setViewportSize({width:1440,height:900});
 await drag(page.locator('.country').nth(0),page.locator('.slot').nth(0));assert.equal(await page.locator('.choice.filled').count(),1);
 await drag(page.locator('.slot').nth(1).locator('.categoryCopy'),page.locator('.country').nth(1));assert.equal(await page.locator('.choice.filled').count(),2);
 await drag(page.locator('.slot').nth(0).locator('.choice'),page.locator('.bankPanel .panelTitle'));assert.equal(await page.locator('.choice.filled').count(),1);
 await page.getByRole('button',{name:/^Remove /}).click();assert.equal(await page.locator('.choice.filled').count(),0);
 for(const [label,count,prizes] of [['Adventurer',6,4],['Expert',8,6],['Scout',4,4]]){await page.getByRole('navigation',{name:'Difficulty',exact:true}).getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.country').count(),count);assert.equal(await page.locator('.slot').count(),prizes);await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.country img')];return images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0);},{},{timeout:15000});}
 await page.getByText('Help & tools',{exact:true}).click();await page.getByRole('button',{name:'Photo credits',exact:true}).click();await page.getByRole('dialog',{name:'Animal photo credits'}).waitFor();assert(await page.locator('.animalPhotoCredits li').count()>90);await page.getByRole('button',{name:'Close photo credits'}).click();
 for(const id of ['maximum_hibernation_bout','cylinder_treat_success','measured_adult_ear_length','cylinder_practice_trials','daily_sleep','field_travel_speed']) assert.equal((await page.request.get(`http://localhost:3012/api/animals/data?trait=${id}`)).status(),404);
 await page.goto('http://localhost:3012/animals?board=fair-hibernation-easy-long-20261005',{waitUntil:'networkidle'});
 assert((await page.getByRole('status').allTextContents()).some(t=>t.includes('updated data checks')));
 const petData=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const petBoards=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8')).boards;
 const cat=petBoards.find(b=>b.id==='fair-pet-cat-easy-3313-20261006');
 await page.goto(`http://localhost:3012/animals?board=${cat.id}`,{waitUntil:'networkidle'});
 for(const tid of cat.traitIds){const t=petData.traits.find(t=>t.id===tid);const winner=petData.values.filter(v=>v.traitId===tid&&cat.animalIds.includes(v.animalId)).sort((a,b)=>t.direction==='higher_wins'?b.valueNumeric-a.valueNumeric:a.valueNumeric-b.valueNumeric)[0];await page.locator(`.country[data-animal-id="${winner.animalId}"]`).click();await page.locator(`.slot[data-trait-id="${tid}"]`).click();}
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'400');
 await page.getByRole('button',{name:'Score image',exact:true}).click();
 await page.getByRole('link',{name:'Download image',exact:true}).waitFor();
 const scoreImage=page.locator('.scoreImagePreview img');
 assert((await scoreImage.getAttribute('alt')).includes('400 out of 400'));
 const imageDimensions=await scoreImage.evaluate(img=>[img.naturalWidth,img.naturalHeight]);
 assert.deepEqual(imageDimensions,[1000,640]);
 const imageDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Download image',exact:true}).click();
 assert.equal((await imageDownload).suggestedFilename(),'animalstats-score.png');
 await page.getByRole('button',{name:'Share image',exact:true}).click();assert((await page.locator('.scoreActions').innerText()).includes('Download the image'));
 await page.getByRole('button',{name:'Close preview',exact:true}).click();assert.equal(await page.locator('.scoreImagePreview').count(),0);
 await page.screenshot({path:join(root,'artifacts/animalstats-cognition-results.png'),fullPage:true});
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Blocked','NotAllowedError');};});await page.locator('.scoreShareOptions summary').click();await page.getByRole('button',{name:'Copy score',exact:true}).click();await page.getByRole('dialog',{name:'Copy your score',exact:true}).waitFor();assert((await page.getByRole('textbox',{name:'Score to copy'}).inputValue()).includes('400/400'));await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Copy your score',exact:true}).count(),0);
 const mddData=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const mddCandidates=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8'));
 for(const id of ['mdd_country_count','mdd_country_count__low','mdd_continent_count','mdd_continent_count__low','mdd_family_species_count','mdd_family_species_count__low']) {
  const covered=new Set(JSON.parse(await readFile(join(root,'data/animalstats/research/coverage-audit-20261009.json'),'utf8')).audit.filter(r=>r.eligible).map(r=>r.traitId));
  const board=mddCandidates.boards.find(b=>b.id.startsWith(`fair-mdd-${id}-easy-`)&&b.traitIds.every(t=>covered.has(t)));if(!board){assert((await page.request.get(`http://localhost:3012/api/animals/data?trait=${id}`)).ok());continue;}
  await page.goto(`http://localhost:3012/animals?board=${board.id}`,{waitUntil:'networkidle'});
  for(const tid of board.traitIds){
   const trait=mddData.traits.find(t=>t.id===tid);
   const ranked=mddData.values.filter(v=>v.traitId===tid&&board.animalIds.includes(v.animalId)).sort((a,b)=>trait.direction==='higher_wins'?b.valueNumeric-a.valueNumeric:a.valueNumeric-b.valueNumeric);
   await page.locator(`.country[data-animal-id="${ranked[0].animalId}"]`).click();await page.locator(`.slot[data-trait-id="${tid}"]`).click();
  }
  await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'400');
  const row=page.locator('.result').filter({hasText:mddData.traits.find(t=>t.id===id).displayName});await row.getByRole('button',{name:'View rankings',exact:true}).click();
  await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.sourceLoading'));
  assert((await page.locator('.sourceDataRow').count())>=40);await page.getByRole('button',{name:'Close data and source'}).click();
 }
 const expertBird=mddCandidates.boards.find(b=>b.id.startsWith('fair-expert-birds-'));assert(expertBird);
 await page.goto(`http://localhost:3012/animals?board=${expertBird.id}`,{waitUntil:'networkidle'});assert.equal(await page.locator('.country').count(),8);
 for(const tid of expertBird.traitIds){
  const trait=mddData.traits.find(t=>t.id===tid);
  const ranked=mddData.values.filter(v=>v.traitId===tid&&expertBird.animalIds.includes(v.animalId)).sort((a,b)=>trait.direction==='higher_wins'?b.valueNumeric-a.valueNumeric:a.valueNumeric-b.valueNumeric);
  await page.locator(`.country[data-animal-id="${ranked[0].animalId}"]`).click();await page.locator(`.slot[data-trait-id="${tid}"]`).click();
 }
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'600');assert.equal(await page.locator('.perfectRow').count(),6);
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('animalstats-presentation-v1','real');});
 await page.goto('http://localhost:3012/animals?mode=expert',{waitUntil:'networkidle'});assert.equal(await page.locator('.country').count(),8);

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
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({desktopAndPhone:true,modesPreserveChoicesAndResults:true,tooltips:true,fullRankings:true,pageErrors:errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
