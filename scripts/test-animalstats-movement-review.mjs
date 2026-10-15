import fs from 'node:fs';
import assert from 'node:assert/strict';
const review=JSON.parse(fs.readFileSync('data/animalstats/research/movement-source-holds-20261014.json'));
const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs','underrepresented','insect-ladybirds'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
const values=parts.flatMap(p=>p.values);
assert.equal(review.heldValues.length,4);
for(const held of review.heldValues){
 const v=values.find(v=>v.animalId===held.animalId&&v.traitId===held.traitId);
 assert(v);assert.equal(v.confidence,'review');assert.equal(v.valueNumeric,held.releasedValueKmH);
 assert(v.notes.includes(review.followUpDoi));assert(v.notes.includes(review.primaryReviewUrl));
}
console.log(JSON.stringify({heldLandTravelValues:4,sourceValuesPreserved:true,absoluteScaleReviewRequired:true}));
