import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';

// Research only. This script never changes facts, artwork approvals or live boards.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'animal-admission-'));
try {
  for (const name of ['categorySemantics','gameRules','animalstats','animalstatsCoverage','animalstatsComposition','animalstatsCartoons']) {
    const output = ts.transpileModule(fs.readFileSync(`lib/${name}.ts`, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
    }).outputText.replace(/from "\.\/([^".]+)"/g, 'from "./$1.mjs"');
    fs.writeFileSync(path.join(temporary, `${name}.mjs`), output);
  }
  const load = name => import(pathToFileURL(path.join(temporary, `${name}.mjs`)));
  const {createAnimalBoardValidator} = await load('animalstats');
  const {publishedAnimalTraitIds,animalMajorGroup} = await load('animalstatsCoverage');
  const {animalBoardComposition} = await load('animalstatsComposition');
  const {cartoonSpecies} = await load('animalstatsCartoons');
  const parts = ['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds','extinct'].map(name => JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)));
  const data = Object.fromEntries(['animals','traits','values','sources','photos'].map(key => [key, parts.flatMap(part => part[key])]));
  // Match production's authoritative marine portrait preference, not last-write wins.
  const marinePhotos = new Set(parts[4].photos.map(photo => photo.animalId));
  data.photos = parts.flatMap((part,index) => part.photos.filter(photo => index === 4 || !marinePhotos.has(photo.animalId)));
  const boards = ['candidates','group-boards','group-boards-2'].flatMap(name => JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)).boards);
  const roundIds = new Set(boards.flatMap(board => board.animalIds));
  const published = publishedAnimalTraitIds(data);
  const traits = new Map(data.traits.map(trait => [trait.id,trait]));
  const animals = new Map(data.animals.map(animal => [animal.id,animal]));
  const approvedPhotos = new Map(data.photos.filter(photo => photo.approved).map(photo => [photo.animalId,photo]));
  const cartoons = new Set(cartoonSpecies);
  const measurements = new Map();
  for (const value of data.values) {
    const trait = traits.get(value.traitId);
    const animal = animals.get(value.animalId);
    if (!trait || !animal || !published.has(trait.id) || value.confidence !== 'approved' || value.observationType === 'imputed' || !(value.valueNumeric > 0) || !Number.isFinite(value.valueNumeric) || value.sourceId !== trait.canonicalSourceId || value.unit !== trait.unit || value.measurementBasis !== trait.measurementBasis || (trait.eligibilityGroups.length && !trait.eligibilityGroups.includes(animal.taxonomicGroup))) continue;
    if (!measurements.has(animal.id)) measurements.set(animal.id,new Set());
    measurements.get(animal.id).add(trait.id);
  }
  const validate = createAnimalBoardValidator(data);
  const rows = data.animals.filter(animal => animal.active && (animal.extinctionStatus ?? 'living') === 'living' && !roundIds.has(animal.id)).map(animal => {
    const available = measurements.get(animal.id) ?? new Set();
    const metrics = new Set([...available].map(id => traits.get(id).metricKey));
    const photo = approvedPhotos.get(animal.id);
    return {animalId:animal.id,commonName:animal.commonName,group:animalMajorGroup(animal),familiarity:animal.familiarityTier,publishedTraitDirections:available.size,distinctMetrics:metrics.size,intuitiveMetrics:new Set([...available].filter(id => traits.get(id).categoryKind === 'intuitive').map(id => traits.get(id).metricKey)).size,hasApprovedPhoto:!!photo,hasRasterPhoto:!!photo && !/\.svg(?:$|\?)/i.test(photo.assetUrl),hasRegisteredCartoon:cartoons.has(animal.id),witnesses:[]};
  }).sort((a,b) => (b.familiarity === 'core')-(a.familiarity === 'core') || b.intuitiveMetrics-a.intuitiveMetrics || b.distinctMetrics-a.distinctMetrics || a.animalId.localeCompare(b.animalId));
  let checks = 0;
  // Bounded witness search, not an impossibility proof: replace one same-group animal
  // in existing approved layouts, retaining all source and numeric validation.
  for (const row of rows) {
    const animal = animals.get(row.animalId);
    if (row.distinctMetrics < 4 || animal.familiarityTier === 'edge') continue;
    const available = measurements.get(animal.id) ?? new Set();
    for (const mode of ['easy','normal','expert']) {
      const required = mode === 'expert' ? 6 : 4;
      if (row.distinctMetrics < required) continue;
      let attempts = 0;
      search: for (const template of boards) {
        if (template.mode !== mode || template.collection === 'extinct-special' || !template.traitIds.every(id => available.has(id))) continue;
        for (let index = 0; index < template.animalIds.length; index++) {
          if (animalMajorGroup(animals.get(template.animalIds[index])) !== row.group) continue;
          if (++attempts > 1500) break search;
          const candidate = {...template,animalIds:template.animalIds.map((id,i) => i === index ? animal.id : id)};
          if (!animalBoardComposition(data,candidate).eligible) continue;
          const result = validate(candidate); checks++;
          const numericReasons = result.rejectionReasons.filter(reason => reason !== `animal ${animal.id}: missing approved photo`);
          if (numericReasons.length) continue;
          row.witnesses.push({mode,templateId:template.id,animalIds:candidate.animalIds,traitIds:candidate.traitIds,winners:result.winners,remainingValidatorReasons:result.rejectionReasons,publicationStatus:'research only; requires asset and source-context review before admission'});
          break search;
        }
      }
    }
  }
  const groups = {};
  for (const row of rows) {
    const group = groups[row.group] ??= {catalogOnly:0,atLeastFourMetrics:0,atLeastSixMetrics:0,missingPhoto:0,missingRegisteredCartoon:0,withNumericWitness:0};
    group.catalogOnly++; if(row.distinctMetrics>=4)group.atLeastFourMetrics++;if(row.distinctMetrics>=6)group.atLeastSixMetrics++;
    if(!row.hasRasterPhoto)group.missingPhoto++;if(!row.hasRegisteredCartoon)group.missingRegisteredCartoon++;if(row.witnesses.length)group.withNumericWitness++;
  }
  const report = {reviewDate:'2026-10-16',policy:['No changes to production data or eligibility.','Metrics count independent metric keys; opposite directions do not count twice.','Numeric witnesses run the production validator with the only permitted remaining error being the target animal missing an approved photo. No synthetic photo is supplied.','Registered cartoon support does not establish anatomical quality. Raster photos still need identity, licensing and framing review.','Witness search is bounded to 1500 substitutions per difficulty per eligible catalog animal; absence of a witness is not proof no valid board exists.'],livingCatalogAnimals:data.animals.filter(a=>(a.extinctionStatus??'living')==='living').length,livingRoundAnimals:data.animals.filter(a=>(a.extinctionStatus??'living')==='living'&&roundIds.has(a.id)).length,catalogOnlyAnimals:rows.length,validatorChecks:checks,numericWitnessAnimals:rows.filter(row=>row.witnesses.length).length,witnessCountsByMode:Object.fromEntries(['easy','normal','expert'].map(mode=>[mode,rows.filter(row=>row.witnesses.some(witness=>witness.mode===mode)).length])),groups,animals:rows};
  const target='data/animalstats/research/catalog-admission-readiness-20261016.json';
  fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({target,catalogOnlyAnimals:rows.length,validatorChecks:checks,groups,numericWitnessAnimals:rows.filter(row=>row.witnesses.length).map(row=>({name:row.commonName,modes:row.witnesses.map(w=>w.mode),needsPhoto:!row.hasRasterPhoto,needsCartoon:!row.hasRegisteredCartoon}))},null,2));
} finally {
  fs.rmSync(temporary,{recursive:true,force:true});
}
