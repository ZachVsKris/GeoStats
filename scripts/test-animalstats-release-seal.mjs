import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import{pathToFileURL}from'node:url';
const dir=fs.mkdtempSync('/tmp/animal-seal-');
try{
 for(const name of ['categorySemantics','gameRules','animalstats','animalstatsCoverage','animalstatsComposition','animalstatsDatasetAssembly','animalstatsReleaseFingerprint','animalstatsRelease']){
  let source=fs.readFileSync(`lib/${name}.ts`,'utf8');if(name==='animalstatsRelease')source=source.replace(/^import seal.*$/m,`const seal=${fs.readFileSync('data/animalstats/research/release-validation-seal.json','utf8')};`);
  fs.writeFileSync(`${dir}/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 }
 const{assembleAnimalDataset}=await import(pathToFileURL(`${dir}/animalstatsDatasetAssembly.mjs`));
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
 const data=assembleAnimalDataset(parts,parts[4].photos),boards=['candidates','group-boards','group-boards-2','extinct'].flatMap(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)).boards);
 fs.writeFileSync(`${dir}/animalstatsCatalog.mjs`,`export const animalDataset=${JSON.stringify(data)};export const animalCandidates={boards:${JSON.stringify(boards)}};export const animalPhotos=animalDataset.photos;`);
 const{animalReleaseFingerprint}=await import(pathToFileURL(`${dir}/animalstatsReleaseFingerprint.mjs`));
 const reversed=value=>Array.isArray(value)?value.map(reversed):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reversed(v)])):value;
 assert.deepEqual(animalReleaseFingerprint(data,boards),animalReleaseFingerprint(reversed(data),reversed(boards)),'JSON-loader property order must not change the seal');
 const{getAnimalRelease}=await import(pathToFileURL(`${dir}/animalstatsRelease.mjs`));const start=Date.now(),release=getAnimalRelease();assert.equal(release.validation,'build-audit');assert.equal(release.boards.length,boards.length);assert(release.clientData.values.every(v=>v.confidence==='approved'&&v.observationType!=='imputed'));const milliseconds=Date.now()-start;
 const catalog=await import(pathToFileURL(`${dir}/animalstatsCatalog.mjs`));const first=boards[0];catalog.animalCandidates.boards=[first];
 const changed=catalog.animalDataset.values.find(v=>v.animalId===first.animalIds[0]&&v.traitId===first.traitIds[0]);changed.confidence='review';
 const fallback=await import(pathToFileURL(`${dir}/animalstatsRelease.mjs`)+'?changed');const unsealed=fallback.getAnimalRelease();assert.equal(unsealed.validation,'runtime');assert.equal(unsealed.boards.length,0,'changing a reviewed value must force validation and reject its board');
 console.log(JSON.stringify({sealedBoards:release.boards.length,sealedCatalogMilliseconds:milliseconds,changedSnapshotRevalidated:true,heldValuesExcludedFromClient:true}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
