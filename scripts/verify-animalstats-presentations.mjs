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
 assert(lifespanResponse.ok());const lifespan=await lifespanResponse.json();
 assert(lifespan.values.length>10);assert(!lifespan.values.some(v=>['proteus_anguinus','homarus_americanus','orcinus_orca','rhincodon_typus'].includes(v.animalId)));
 const catalogResponse=await page.request.get('http://localhost:3012/api/animals/data?scope=catalog');const fullCatalog=await catalogResponse.json();assert(!fullCatalog.data.values.some(v=>v.animalId==='proteus_anguinus'&&/lifespan/.test(v.traitId)));
 const animals=page.locator('[data-animal-id].penAnimal'), traits=page.locator('[data-trait-id].traitPodium');
 assert.equal(await animals.count(),4); await animals.nth(0).click();await traits.nth(0).click();
 const placed=await traits.nth(0).getAttribute('data-trait-id');const first=await animals.nth(0).getAttribute('data-animal-id');
 await page.getByRole('switch',{name:'Real animal photos'}).click();assert.equal(await page.locator('.penAnimal').count(),0);assert.equal(await page.locator('.country').count(),4);assert.equal(await page.locator(`[data-trait-id="${placed}"] .choice .pieceName`).textContent(),await page.locator(`.country[data-animal-id="${first}"] strong`).textContent());
 const slots=page.locator('.slot[data-trait-id]'); const info=slots.nth(1).getByRole('button',{name:/Definition of/});
 await info.hover();await page.getByRole('tooltip').waitFor();assert((await page.getByRole('tooltip').textContent()).length>30);await page.mouse.move(0,0);assert.equal(await page.getByRole('tooltip').count(),0);
 await info.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await page.getByRole('tooltip').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
 for(let i=1;i<4;i++){await page.locator('.country').nth(i).click();await slots.nth(i).click();}
 await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.country img')];return images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0);},{},{timeout:15000});
 await page.screenshot({path:join(root,'artifacts/animalstats-real-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();await page.locator('.resultWrap').first().waitFor();assert.equal(await page.locator('.perfectRow').count(),4);assert.equal(await page.locator('.scoreShareOptions').count(),1);assert.equal(await page.locator('.resultWrap').count(),4);assert.equal(await page.locator('.resultMain b').first().textContent(),'Your Choice');assert.equal(await page.locator('.mobileBestMatch').count(),4);
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
 await page.goto('http://localhost:3012/animals?board=fair-hibernation-easy-long-20261005',{waitUntil:'networkidle'});
 for(const [trait,animal] of [['maximum_hibernation_bout','myotis_lucifugus'],['adult_body_mass','tachyglossus_aculeatus'],['gestation__low','mesocricetus_auratus'],['scientific_description_age','erinaceus_europaeus']]){await page.locator(`.country[data-animal-id="${animal}"]`).click();await page.locator(`.slot[data-trait-id="${trait}"]`).click();}
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'400');assert.equal(await page.locator('.resultMain').filter({hasText:'Longest hibernation stretch'}).count(),1);
 await page.getByRole('button',{name:'View rankings',exact:true}).first().click();await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();await page.getByRole('button',{name:'Download full data (CSV)'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.sourceLoading'));assert.equal(await page.locator('.sourceDataRow').count(),4);assert((await page.locator('.sourceDataRow').first().textContent()).includes('1,152 hours'));await page.getByRole('button',{name:'Close data and source'}).click();
 await page.goto('http://localhost:3012/animals?board=fair-cognition-easy-high-20261005',{waitUntil:'networkidle'});
 for(const [trait,animal] of [['cylinder_treat_success','pan_troglodytes'],['adult_body_mass','gorilla_gorilla'],['gestation__low','canis_lupus'],['mammal_range_area__low','lemur_catta']]){await page.locator(`.country[data-animal-id="${animal}"]`).click();await page.locator(`.slot[data-trait-id="${trait}"]`).click();}
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'400');assert.equal(await page.locator('.perfectRow').count(),4);
 await page.getByRole('button',{name:'View rankings',exact:true}).first().click();assert.equal(await page.locator('.leaderboardCountry img').count(),4);await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.sourceLoading'));assert.equal(await page.locator('.sourceDataRow').count(),5);assert((await page.locator('.sourceHeroDescription').textContent()).includes('not a species-wide intelligence'));assert((await page.locator('.sourceDataTable').textContent()).includes('N=5'));await page.getByRole('button',{name:'Close data and source'}).click();
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
 for(const [side,pairs] of [
  ['long',[['measured_adult_ear_length','vulpes_vulpes'],['adult_body_mass','procyon_lotor'],['gestation__low','rattus_norvegicus'],['litter_size__low','myotis_lucifugus']]],
  ['short',[['measured_adult_ear_length__low','myotis_lucifugus'],['adult_body_mass','procyon_lotor'],['litter_size','mus_musculus'],['birth_weight','vulpes_vulpes']]],
 ]) {
  await page.goto(`http://localhost:3012/animals?board=fair-ears-easy-${side}-20261005`,{waitUntil:'networkidle'});
  for(const [trait,animal] of pairs){await page.locator(`.country[data-animal-id="${animal}"]`).click();await page.locator(`.slot[data-trait-id="${trait}"]`).click();}
  await page.getByRole('button',{name:'Submit answers',exact:true}).click();assert.equal(await page.locator('.scoreValue strong').textContent(),'400');
  await page.getByRole('button',{name:'View rankings',exact:true}).first().click();await page.locator('.leaderboard').getByRole('button',{name:'Data & Source',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.sourceLoading'));
  assert.equal(await page.locator('.sourceDataRow').count(),6);assert((await page.locator('.sourceHeroDescription').innerText()).includes('not species-wide maxima'));await page.getByRole('button',{name:'Close data and source'}).click();
 }
 const mddData=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const mddCandidates=JSON.parse(await readFile(join(root,'data/animalstats/candidates.json'),'utf8'));
 for(const id of ['mdd_country_count','mdd_country_count__low','mdd_continent_count','mdd_continent_count__low','mdd_family_species_count','mdd_family_species_count__low']) {
  const board=mddCandidates.boards.find(b=>b.id.startsWith(`fair-mdd-${id}-easy-`));assert(board);
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
 await page.goto('http://localhost:3012/animals?mode=expert',{waitUntil:'networkidle'});assert.equal(await page.locator('.country').count(),8);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({desktopAndPhone:true,modesPreserveChoicesAndResults:true,tooltips:true,fullRankings:true,pageErrors:errors}));
}finally{await browser?.close();server.kill('SIGTERM');}
