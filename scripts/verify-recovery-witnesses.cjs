// Revalidate saved complete witnesses against exact-value exports (not rounded tool output).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load } = require('./test-catalog-recovery.cjs');
const { buildCategoryCatalog } = load('lib/playableCatalog.ts');
const { canonicalizeDataset, validateRound } = load('lib/dataEngine.ts');
const { validateDailyTrio } = load('lib/dailyTrioRules.ts');
const { datasetHasEnoughDisplayedVariety } = load('lib/puzzleEngine.ts');
const { ROUND_CONFIGS } = load('lib/gameRules.ts');
const { STATIC_COUNTRIES } = load('lib/staticCountries.ts');
const { RULES_VERSION } = load('lib/version.ts');
const [catalogPath, valuesPath, proofsPath] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(catalogPath));
const values = JSON.parse(fs.readFileSync(valuesPath));
const saved = JSON.parse(fs.readFileSync(proofsPath));
const live = process.argv.includes('--live');
const overrides = live ? {} : require('../audits/maximum-recovery-overrides-2026-09-07.json');
const byId = new Map(), byWarehouse = new Map(), rowByWarehouse = new Map();
for (const original of rows.filter(r => r.computed_playable_v16_2 || overrides[r.id])) {
  const row = { ...original, ...overrides[original.id] };
  row.metadata = { ...original.metadata, ...overrides[original.id]?.metadata, boardDescription: row.plain_language_description };
  const category = buildCategoryCatalog([row], { playableOnly: live })[0];
  assert.ok(category, row.id);
  assert.ok(!byId.has(category.id), `Duplicate ${category.id}`);
  const observations = values[row.id].map(([countryId,value]) => ({ countryId, countryName: STATIC_COUNTRIES.find(c => c.id === countryId)?.name || countryId, value: Number(value), year: String(row.common_year) }));
  assert.equal(observations.length, row.common_year_coverage);
  const dataset = canonicalizeDataset({ category, year: String(row.common_year), observations });
  assert.equal(dataset.ranked.length, observations.length, `Filtered observations: ${row.id}`);
  byId.set(category.id, dataset); byWarehouse.set(row.id,dataset); rowByWarehouse.set(row.id,row);
}
function reconstruct(witness) {
  const categories = witness.categories.map(id => { const d = byId.get(id); assert.ok(d,id); return d; });
  const bank = witness.countries.map(id => { const c = STATIC_COUNTRIES.find(c=>c.id===id); assert.ok(c,id); return c; });
  assert.deepEqual(validateRound(categories,bank),[]);
  return { categories,bank };
}
const unresolved = saved.proofs.filter(proof => proof.reachable !== true);
const proofs = saved.proofs.filter(proof => proof.reachable === true).map(proof => {
  assert.equal(proof.reachable,true);
  const dataset = byWarehouse.get(proof.category_id);
  assert.ok(datasetHasEnoughDisplayedVariety(dataset,ROUND_CONFIGS[proof.difficulty]));
  const round = reconstruct(proof.witness);
  assert.equal(round.bank.length,ROUND_CONFIGS[proof.difficulty].countryCount);
  assert.equal(round.categories.length,ROUND_CONFIGS[proof.difficulty].categoryCount);
  assert.ok(round.categories.every(d => datasetHasEnoughDisplayedVariety(d,ROUND_CONFIGS[proof.difficulty])), 'Every witness category must support its board mode');
  assert.ok(round.categories.includes(dataset));
  return { ...proof,checked_at:new Date().toISOString(),audit_version:'geostats-v16.3.4-exact-witness-replay-v1',fingerprint:crypto.createHash('sha256').update(JSON.stringify([rowByWarehouse.get(proof.category_id),values[proof.category_id],RULES_VERSION])).digest('hex') };
});
const trio = Object.fromEntries(Object.entries(saved.trio.modes).map(([mode,w])=>[mode,reconstruct(w)]));
assert.deepEqual(validateDailyTrio(trio),[]);
console.log(JSON.stringify({ catalogSize:byId.size,proofs,unresolved,trio:saved.trio,exactValueReplay:true,liveCatalogReplay:live },null,2));
