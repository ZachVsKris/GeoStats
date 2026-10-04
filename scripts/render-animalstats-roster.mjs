// Render original React artwork into the same attributed SVG used by the app.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const require=createRequire(join(root,'package.json'));
const ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {chromium}=require('playwright');
const data=JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
const audit=JSON.parse(await readFile(join(root,'data/animalstats/research/roster-expansion-audit.json'),'utf8'));
const ids=new Set([...Object.keys(audit.newAnimals).map(s=>s.toLowerCase().replaceAll(' ','_')),'enhydra_lutris','lemur_catta']);
const temp=await mkdtemp(join(tmpdir(),'animal-roster-art-'));
let browser;
try {
 const options={module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX};
 const profilePath=join(temp,'profiles.mjs'),componentPath=join(temp,'sprite.mjs');
 await writeFile(profilePath,ts.transpileModule(await readFile(join(root,'lib/animalstatsCartoons.ts'),'utf8'),{compilerOptions:options}).outputText);
 const code=ts.transpileModule(await readFile(join(root,'components/AnimalSprite.tsx'),'utf8'),{compilerOptions:options}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(require.resolve('react/jsx-runtime'))).replaceAll('"react"',JSON.stringify(require.resolve('react'))).replaceAll('"../lib/animalstatsCartoons"',JSON.stringify(profilePath));
 await writeFile(componentPath,code);
 const {AnimalSprite}=await import(pathToFileURL(componentPath));
 const {cartoonSpecies}=await import(pathToFileURL(profilePath));
 const animals=data.animals.filter(a=>ids.has(a.id));
 for(const animal of animals){
  const svg=renderToStaticMarkup(React.createElement(AnimalSprite,{animal})).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
  await writeFile(join(root,'public/animalstats',animal.id+'.svg'),svg+'\n');
  const assetUrl='/animalstats/'+animal.id+'.svg';
  data.photos=data.photos.filter(p=>p.animalId!==animal.id).concat({animalId:animal.id,assetUrl,originalUrl:assetUrl,creator:'AnimalStats original cartoon artwork',license:'Original project artwork',attribution:'Original species-specific SVG character design in components/AnimalSprite.tsx',approved:true});
 }
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1000,height:1100},deviceScaleFactor:1});
 const all=data.animals.filter(a=>cartoonSpecies.includes(a.id));
 await page.setContent(renderToStaticMarkup(React.createElement('div',null,all.map(animal=>React.createElement(AnimalSprite,{key:animal.id,animal})))));
 const frames=await page.locator('svg').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBBox();return{id:n.getAttribute('data-animal-id'),x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height};}));
 const overflow=frames.filter(b=>b.x<0||b.y<0||b.right>200||b.bottom>160);
 if(overflow.length)throw Error(JSON.stringify(overflow));
 const markup=animals.filter(a=>a.id!=='lemur_catta').map(animal=>'<figure>'+renderToStaticMarkup(React.createElement(AnimalSprite,{animal}))+'<figcaption>'+animal.commonName+'</figcaption></figure>').join('');
 await page.setContent('<html><head><style>body{margin:0;background:#fff7e6;font-family:Arial}main{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px}figure{margin:0;background:white;border-radius:14px;padding:8px;text-align:center}svg{width:100%;height:150px}figcaption{font-size:14px;font-weight:bold}</style></head><body><main>'+markup+'</main></body></html>');
 await page.screenshot({path:join(root,'artifacts/animalstats-roster-20261004.png'),fullPage:true});
 await writeFile(join(root,'data/animalstats/pilot.json'),JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({renderedAssets:animals.length,allCartoonsWithinFrame:frames.length}));
}finally{await browser?.close();await rm(temp,{recursive:true,force:true});}
