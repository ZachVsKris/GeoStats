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
 await writeFile(profilePath,ts.transpileModule(await readFile(join(root,'lib/animalstatsCartoons.ts'),'utf8'),{compilerOptions:options}).outputText);
 const code = ts.transpileModule(await readFile(join(root,'components/AnimalSprite.tsx'),'utf8'),{compilerOptions:options}).outputText
  .replaceAll('"react/jsx-runtime"',JSON.stringify(require.resolve('react/jsx-runtime')))
  .replaceAll('"react"',JSON.stringify(require.resolve('react')))
  .replaceAll('"../lib/animalstatsCartoons"',JSON.stringify(profilePath));
 await writeFile(componentPath,code);
 const { AnimalSprite } = await import(pathToFileURL(componentPath));
 const { cartoonSpecies } = await import(pathToFileURL(profilePath));
 const data = JSON.parse(await readFile(join(root,'data/animalstats/pilot.json'),'utf8'));
 const animals = data.animals.filter(a=>cartoonSpecies.includes(a.id));
 assert.equal(animals.length,cartoonSpecies.length);
 const html = renderToStaticMarkup(React.createElement('div',null,animals.map(animal=>React.createElement(AnimalSprite,{key:animal.id,animal}))));
 browser = await chromium.launch();
 const page = await browser.newPage();
 await page.setContent(html);
 const checks = await page.locator('svg').evaluateAll(nodes=>nodes.map(node=>{
  const b=node.getBBox(), neck=node.querySelector('[data-anatomy="long-neck"]'), feet=node.querySelector('.cartoonFeet');
  return {id:node.getAttribute('data-animal-id'),x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height,neck:neck?.getBBox().height,feet:feet?.getBBox().height};
 }));
 assert.equal(checks.length,cartoonSpecies.length);
 assert.deepEqual(checks.filter(b=>b.x<0||b.y<0||b.right>200||b.bottom>160),[],'Artwork extends outside its fixed frame');
 const clipIds = await page.locator('clipPath').evaluateAll(nodes=>nodes.map(node=>node.id));
 assert.equal(new Set(clipIds).size,clipIds.length,'Coat masks must not collide between animals');
 for(const id of ['struthio_camelus','dromaius_novaehollandiae','ardea_cinerea']){
  const bird=checks.find(b=>b.id===id);
  assert(bird.neck>50,`${id} lost its long neck`);
  assert(bird.feet>40,`${id} lost its long legs`);
 }
 await page.locator('svg[data-animal-id="cavia_porcellus"]').screenshot({path:join(root,'artifacts/animalstats-guinea-pig.png')});
 console.log(`All ${animals.length} cartoons fit their frames; unique coat masks and long-necked bird anatomy passed.`);
} finally {
 await browser?.close();
 await rm(temp,{recursive:true,force:true});
}
