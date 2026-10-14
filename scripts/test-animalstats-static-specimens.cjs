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
const sprites = compile('components/AnimalSprite.tsx', { '../lib/animalstatsCartoons': profiles });
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
