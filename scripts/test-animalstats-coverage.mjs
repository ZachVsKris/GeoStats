import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const ts=createRequire(import.meta.url)('typescript'),temp=await mkdtemp(join(tmpdir(),'coverage-test-'));
try {
 const code=ts.transpileModule(await readFile('lib/animalstatsCoverage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;await writeFile(join(temp,'coverage.mjs'),code);
 const {auditAnimalCoverage,publishedAnimalTraitIds}=await import(pathToFileURL(join(temp,'coverage.mjs')));
 const trait={id:'weight',displayName:'Heaviest',prototypeCategory:true,oneSided:true,eligibilityGroups:[],canonicalSourceId:'source',unit:'g',measurementBasis:'observed'};
 const sample=(n,groups=['bird','lizard','carnivore'],t=trait)=>({traits:[t],animals:Array.from({length:n},(_,i)=>({id:'a'+i,active:true,familiarityTier:'familiar',taxonomicGroup:groups[i%groups.length]})),values:Array.from({length:n},(_,i)=>({animalId:'a'+i,traitId:t.id,confidence:'approved',observationType:'observed',sourceId:'source',unit:'g',measurementBasis:'observed',valueNumeric:i+1}))});
 assert(!auditAnimalCoverage(sample(49))[0].eligible);assert(auditAnimalCoverage(sample(50))[0].eligible);assert(!auditAnimalCoverage(sample(80,['lizard']))[0].eligible);
 const scoped={...trait,eligibilityGroups:['bird']};assert(!auditAnimalCoverage(sample(19,['bird'],scoped))[0].eligible);assert(auditAnimalCoverage(sample(20,['bird'],scoped))[0].eligible);
 const breed={...trait,id:'pet_dog_weight'};assert(!auditAnimalCoverage(sample(7,['carnivore'],breed))[0].eligible);assert(auditAnimalCoverage(sample(8,['carnivore'],breed))[0].eligible);
 for(const change of [{confidence:'review'},{observationType:'imputed'},{sourceId:'wrong'},{unit:'wrong'},{measurementBasis:'wrong'}]){const d=sample(50);Object.assign(d.values[0],change);assert(!auditAnimalCoverage(d)[0].eligible);}
 const duplicate=sample(49);duplicate.values.push({...duplicate.values[0]});assert.equal(auditAnimalCoverage(duplicate)[0].count,49);
 const paired=sample(50);paired.traits[0]={...trait,oneSided:false,counterTraitId:'missing'};assert.equal(publishedAnimalTraitIds(paired).size,0);
 const data=JSON.parse(await readFile('data/animalstats/pilot.json','utf8'));const published=publishedAnimalTraitIds(data);assert(published.has('adult_body_mass'));assert(published.has('pet_cat_lifespan'));assert(!published.has('daily_sleep'));assert(!published.has('field_travel_speed'));
 console.log('Coverage boundaries, breadth, provenance filters, duplicates and paired publication passed.');
}finally{await rm(temp,{recursive:true,force:true});}
