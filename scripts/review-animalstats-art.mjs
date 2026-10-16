// Render the production TSX with React's real JSX runtime. Playwright's test
// transform replaces JSX with component-test objects, so render before loading
// the SVG into Chromium for geometry checks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright');
const temp = await mkdtemp(join(tmpdir(), 'animal-art-'));
let browser;
try {
 const options = {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX};
 const profilePath = join(temp,'profiles.mjs');
 const componentPath = join(temp,'sprite.mjs');
 const cephalopodPath = join(temp,'cephalopod.mjs');
 const familiarMammalPath=join(temp,'familiar-mammal.mjs');
 const reviewedFishPath=join(temp,'reviewed-fish.mjs');
 await writeFile(reviewedFishPath,ts.transpileModule(await readFile(join(root,'components/AnimalReviewedFish.tsx'),'utf8'),{compilerOptions:options}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(require.resolve('react/jsx-runtime'))));
 await writeFile(familiarMammalPath,ts.transpileModule(await readFile(join(root,'components/AnimalFamiliarMammal.tsx'),'utf8'),{compilerOptions:options}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(require.resolve('react/jsx-runtime'))));
 await writeFile(cephalopodPath,ts.transpileModule(await readFile(join(root,'components/AnimalCephalopod.tsx'),'utf8'),{compilerOptions:options}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(require.resolve('react/jsx-runtime'))));
 await writeFile(profilePath,ts.transpileModule(await readFile(join(root,'lib/animalstatsCartoons.ts'),'utf8'),{compilerOptions:options}).outputText);
 const code = ts.transpileModule(await readFile(join(root,'components/AnimalSprite.tsx'),'utf8'),{compilerOptions:options}).outputText
  .replaceAll('"react/jsx-runtime"',JSON.stringify(require.resolve('react/jsx-runtime')))
  .replaceAll('"react"',JSON.stringify(require.resolve('react')))
  .replaceAll('"../lib/animalstatsCartoons"',JSON.stringify(profilePath))
  .replaceAll('"./AnimalCephalopod"',JSON.stringify(cephalopodPath))
  .replaceAll('"./AnimalFamiliarMammal"',JSON.stringify(familiarMammalPath))
  .replaceAll('"./AnimalReviewedFish"',JSON.stringify(reviewedFishPath));
 await writeFile(componentPath,code);
 const { AnimalSprite } = await import(pathToFileURL(componentPath));
 const { cartoonSpecies } = await import(pathToFileURL(profilePath));
 const data = JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const expanded=JSON.parse(await readFile(join(root,'data/animalstats/underrepresented.json'),'utf8'));const ladybirds=JSON.parse(await readFile(join(root,'data/animalstats/insect-ladybirds.json'),'utf8'));const coverage=JSON.parse(await readFile(join(root,'data/animalstats/existing-coverage.json'),'utf8'));data.animals.push(...expanded.animals,...ladybirds.animals,...coverage.animals);
 const selectedIds=process.argv.slice(2);
 const animals = data.animals.filter(a=>selectedIds.length ? selectedIds.includes(a.id) : cartoonSpecies.includes(a.id));
 assert.equal(animals.length,selectedIds.length||cartoonSpecies.length);
 const photos=[...JSON.parse(await readFile(join(root,'data/animalstats/photos.json'),'utf8')),...expanded.photos,...ladybirds.photos,...coverage.photos];
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1200,height:820}});
 for(let start=0;start<animals.length;start+=20){
 const cards=[];
 for(const animal of animals.slice(start,start+20)){
 const photo=photos.find(p=>p.animalId===animal.id&&p.approved&&!p.assetUrl.endsWith('.svg'));
 const bytes=photo?await readFile(join(root,'public',photo.assetUrl)):null;
 const image=bytes?'<img src="data:image/jpeg;base64,'+bytes.toString('base64')+'">':'';
 cards.push('<figure><div>'+renderToStaticMarkup(React.createElement(AnimalSprite,{animal}))+image+'</div><figcaption>'+animal.commonName+'</figcaption><small>'+animal.scientificName+'</small></figure>');
 }
 await page.setContent('<html><style>body{margin:0;background:#f5fbf7;font:14px Arial;color:#193c30}main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}figure{margin:0;padding:8px;background:white;border:1px solid #bcd7c7;border-radius:8px}figure>div{display:flex;align-items:center;height:112px}svg{width:160px;height:128px}img{width:100px;height:100px;object-fit:contain}figcaption{font-weight:bold;margin-top:8px}small{font-size:11px;color:#537163}</style><main>'+cards.join('')+'</main></html>');
 await page.screenshot({path:join(root,'artifacts',`animal-recognition-${selectedIds.length?"targeted-":""}${Math.floor(start/20)+1}.png`),fullPage:true});
 }
 console.log('Rendered '+animals.length+' cartoon/photo recognition comparisons.');

} finally {
 await browser?.close();
 await rm(temp,{recursive:true,force:true});
}
