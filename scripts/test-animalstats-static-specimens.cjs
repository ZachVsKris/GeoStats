const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function compile(file, dependencies = {}) {
  const filename = path.join(root, file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const compiled = new Module(filename, module);
  const fromSource = Module.createRequire(filename);
  compiled.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : fromSource(name);
  compiled._compile(output, filename);
  return compiled.exports;
}
const profiles = compile('lib/animalstatsCartoons.ts');
const cephalopods = compile('components/AnimalCephalopod.tsx');
const familiarMammals = compile('components/AnimalFamiliarMammal.tsx');
const sprites = compile('components/AnimalSprite.tsx', { '../lib/animalstatsCartoons': profiles, './AnimalCephalopod': cephalopods, './AnimalFamiliarMammal': familiarMammals });
for (const scientificName of cephalopods.illustratedCephalopods) {
  const animal = { id:scientificName.toLowerCase().replaceAll(' ','_'), scientificName, commonName:scientificName, taxonomicGroup:'cephalopod', active:true, familiarityTier:'core' };
  const markup=renderToStaticMarkup(React.createElement(sprites.AnimalSprite,{animal}));
  assert.equal((markup.match(/data-appendage="arm"/g)||[]).length,8);
  assert.equal((markup.match(/data-appendage="feeding-tentacle"/g)||[]).length,/Octopus|Enteroctopus/.test(scientificName)?0:2);
}
assert(!cephalopods.illustratedCephalopods.has('Nautilus pompilius'));
const Portrait = compile('components/AnimalPortrait.tsx', { './AnimalSprite': sprites }).default;
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data/animalstats/extinct.json')));
const review = JSON.parse(fs.readFileSync(path.join(root, 'data/animalstats/research/extinct-static-review-20261014.json')));
for (const record of review.reviewedAssets) {
  const animal = dataset.animals.find(animal => animal.id === record.animalId);
  const photo = dataset.photos.find(photo => photo.animalId === record.animalId);
  assert.equal(animal.scientificName, record.scientificName);
  assert(photo.approved && !photo.assetUrl.endsWith('.svg'));
  const bytes = fs.readFileSync(path.join(root, 'public', photo.assetUrl));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.assetSha256);
  assert.equal(bytes.subarray(0,2).toString('hex'), 'ffd8');
  const real = renderToStaticMarkup(React.createElement(Portrait, { animal, photo, presentation: 'real' }));
  const cute = renderToStaticMarkup(React.createElement(Portrait, { animal, photo, presentation: 'cute' }));
  assert(real.includes(photo.assetUrl) && real.includes('mounted skeleton') && real.includes('object-fit:contain'));
  assert(cute.includes('.svg') && cute.includes('cartoon reconstruction') && !cute.includes(photo.assetUrl));
}
// An exact-species photo must not leak onto a relative sharing its genus.
const relative = dataset.animals.find(animal => animal.scientificName === 'Smilodon populator');
const relativePhoto = dataset.photos.find(photo => photo.animalId === relative.id);
const relativeMarkup = renderToStaticMarkup(React.createElement(Portrait, { animal: relative, photo: relativePhoto, presentation: 'real' }));
assert(!relativeMarkup.includes('extinct_smilodon_fatalis.jpg'));
assert(relativeMarkup.includes('specimen image pending'));
console.log(JSON.stringify({ reviewedExactSpecies: review.reviewedAssets.length, cuteStaticSeparation: true, relativePhotoSubstitutionBlocked: true, remainingStaticReplacements: review.remainingStaticAssets }));

const portraits = JSON.parse(fs.readFileSync(path.join(root, 'data/animalstats/gameplay-portraits.json')));
const livingParts = ['pilot','existing-coverage'].map(name => JSON.parse(fs.readFileSync(path.join(root, 'data/animalstats', name+'.json'))));
const living = {animals: livingParts.flatMap(part => part.animals), photos: livingParts.flatMap(part => part.photos)};
for (const [id, crop] of Object.entries(portraits)) {
  const animal = living.animals.find(a => a.id === id), photo = living.photos.find(p => p.animalId === id);
  assert.equal(animal.scientificName, crop.scientificName);
  assert.equal(photo.assetUrl, crop.assetUrl);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public', crop.assetUrl))).digest('hex'), crop.sourceSha256);
  const [x,y,w,h] = crop.crop;
  assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= crop.sourceWidth && y+h <= crop.sourceHeight);
  const playing = renderToStaticMarkup(React.createElement(Portrait, {animal,photo,presentation:'real',gameplay:true}));
  const results = renderToStaticMarkup(React.createElement(Portrait, {animal,photo,presentation:'real'}));
  assert(playing.includes('viewBox="'+crop.crop.join(' ')+'"') && playing.includes('preserveAspectRatio="xMidYMid meet"'));
  assert(!results.includes('data-portrait-animal') && results.includes('<img'));
  const wrong = renderToStaticMarkup(React.createElement(Portrait, {animal,photo:{...photo,animalId:'another_species'},presentation:'real',gameplay:true}));
  assert(!wrong.includes(photo.assetUrl), 'Wrong-species photo must never render');
  const unreviewed = renderToStaticMarkup(React.createElement(Portrait, {animal,photo:{...photo,approved:false},presentation:'real',gameplay:true}));
  assert(!unreviewed.includes(photo.assetUrl), 'Unapproved photo must never render');
}
console.log(Object.keys(portraits).length+' exact-species gameplay viewports: source hashes, crop bounds, undistorted framing and full-image results passed.');
