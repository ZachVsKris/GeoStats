import fs from 'node:fs';
import assert from 'node:assert/strict';
const names=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds'];
const parts=names.map(name=>({name,data:JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`,'utf8'))}));
const animals=new Map(parts.flatMap(p=>p.data.animals).map(a=>[a.id,a]));
const heldTraits=new Set(['tt_range_temperature','tt_range_rainfall','tt_range_elevation']);
const marker='Aquatic habitat interpretation hold: terrestrial CHELSA/EarthEnv range averages are not verified ocean climate or aquatic habitat elevation.';
const records=[];
for(const part of parts){let changed=false;for(const v of part.data.values){
 if(animals.get(v.animalId)?.taxonomicGroup!=='marine-mammal'||!heldTraits.has(v.traitId.replace(/__low$/,'')))continue;
 if(process.argv.includes('--write')&&v.confidence==='approved'){v.confidence='review';v.notes=(v.notes??'')+' '+marker;changed=true;}
 assert.notEqual(v.confidence,'approved',`${v.animalId} ${v.traitId}: unreviewed aquatic climate interpretation`);
 records.push({file:`data/animalstats/${part.name}.json`,animalId:v.animalId,scientificName:animals.get(v.animalId).scientificName,traitId:v.traitId,valueNumeric:v.valueNumeric,unit:v.unit,confidence:v.confidence,notes:v.notes});
 }if(changed)fs.writeFileSync(`data/animalstats/${part.name}.json`,JSON.stringify(part.data)+'\n');}
if(process.argv.includes('--write'))fs.writeFileSync('data/animalstats/research/aquatic-climate-hold-20261015.json',JSON.stringify({status:'held pending original range-layer and aquatic habitat interpretation',source:'TetrapodTraits 2.0.1; CHELSA v1.2 and EarthEnv',sourceUrl:'https://zenodo.org/records/18926700',policy:marker,scope:'Marine mammals, including coastal pinnipeds and freshwater sirenians. This hold does not assert that the published numbers are erroneous; their use for these game comparisons is not established.',directionalRecords:records.length,uniqueSpecies:new Set(records.map(r=>r.animalId)).size,uniqueMeasurements:new Set(records.map(r=>r.animalId+':'+r.traitId.replace(/__low$/,''))).size,records},null,2)+'\n');
console.log(JSON.stringify({heldAquaticClimateDirections:records.length,species:new Set(records.map(r=>r.animalId)).size,noApprovedAquaticClimateValues:true}));
