// Behavior tests use real published metadata (2026-09-07), not idealized clusters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const p = path.resolve(root, file);
  if (p.endsWith('/puzzleWarehouseSnapshot.ts')) return {};
  if (cache.has(p)) return cache.get(p).exports;
  const module = { exports: {} }; cache.set(p, module);
  const code = ts.transpileModule(fs.readFileSync(p, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)((id) => id.startsWith('.')
    ? load(path.resolve(path.dirname(p), id + (path.extname(id) ? '' : '.ts'))) : require(id), module, module.exports);
  return module.exports;
}

async function main() {
  const { safeRelativePath, safeAuthNext } = load('lib/authRedirect.ts');
  const origin = 'https://geostats.xyz';
  for (const unsafe of ['//evil.test', '/\\evil.test', '/%5cevil.test', '/%2fevil.test', '/%252fevil.test', '/%0a/evil.test', '/%zz', 'https://evil.test']) {
    assert.equal(safeRelativePath(unsafe, origin), null, unsafe);
  }
  assert.equal(safeRelativePath('/daily?search=South%20Africa#result', origin), '/daily?search=South%20Africa#result');
  assert.equal(safeAuthNext(new URL(origin + '/auth/callback?next=%2Fexpert')), '/expert');
  assert.equal(safeAuthNext(new URL(origin + '/auth/callback?redirect_to=' + encodeURIComponent('https://evil.vercel.app/auth/callback?next=/expert'))), '/daily');

  const { checkGoogleProvider } = load('lib/googleProvider.ts');
  const reply = (data, status = 200) => async () => new Response(JSON.stringify(data), { status });
  assert.equal(await checkGoogleProvider(origin, 'public-key', reply({ external: { google: true } })), 'enabled');
  assert.equal(await checkGoogleProvider(origin, 'public-key', reply({ external: { google: false } })), 'disabled');
  assert.equal(await checkGoogleProvider(origin, 'public-key', reply({})), 'unknown');
  assert.equal(await checkGoogleProvider(origin, 'public-key', reply({}, 503)), 'unknown');
  assert.equal(await checkGoogleProvider(origin, 'public-key', async () => { throw new Error('offline'); }), 'unknown');

  const { readAllPages } = load('lib/pagedRead.ts');
  const all = Array.from({ length: 2507 }, (_, i) => i);
  for (const cap of [1000, 200]) {
    const seen = [];
    const result = await readAllPages(async (from, to) => {
      seen.push(from); return { data: all.slice(from, Math.min(to + 1, from + cap)), error: null };
    });
    assert.deepEqual(result, { data: all, error: null });
    assert.equal(seen.at(-1), all.length);
  }
  const failure = await readAllPages(async (from) => from ? { data: null, error: 'offline' } : { data: [1], error: null });
  assert.deepEqual(failure, { data: null, error: 'offline' });

  const { buildPlayableCategoryCatalog } = load('lib/playableCatalog.ts');
  const { semanticConflict, inferSemanticProfile } = load('lib/categorySemantics.ts');
  const fixtures = require('./fixtures/catalog-recovery-2026-09-07.json');
  const catalog = buildPlayableCategoryCatalog(fixtures);
  assert.equal(catalog.length, fixtures.length, 'Presentation repairs must not hide approved categories');
  const find = id => { const c = catalog.find(c => c.id === id); assert.ok(c, id); return c; };
  const lakes = catalog.filter(c => /natural-earth:.*lake/.test(c.id));
  for (let i = 0; i < lakes.length; i++) for (let j = i + 1; j < lakes.length; j++) {
    assert.ok(semanticConflict(lakes[i], lakes[j]), `Actual lake metadata: ${lakes[i].id} / ${lakes[j].id}`);
  }
  assert.ok(semanticConflict(find('natural-earth:highest-mapped-glaciated-share'), find('natural-earth:largest-mapped-glaciated-area')));
  assert.ok(semanticConflict(find('pew-religion:other-religions-population'), find('pew-religion:other-religions-share')));
  assert.match(find('pew-religion:other-religions-population').name, /outside the five major groups/);
  assert.match(find('pew-religion:other-religions-population').boardDescription, /Christianity, Islam, Hinduism, Buddhism or Judaism/);
  for (const id of ['natural-earth:highest-land-border-density', 'natural-earth:highest-mapped-river-density']) {
    assert.equal(find(id).measurementType, 'rate', id);
  }
  assert.equal(find('koppen-geiger:arid-share').icon, '🏜️');
  assert.match(find('koppen-geiger:arid-share').boardDescription, /desert or steppe/);
  const cheese = catalog.find(c => c.source === 'faostat' && /cheese/i.test(c.name));
  assert.equal(inferSemanticProfile(cheese).family, 'livestock-production');
  assert.ok(!semanticConflict(find('natural-earth:largest-single-mapped-lake'), find('koppen-geiger:arid-share')), 'Do not conflate all geography');

  const { assessCategorySetCountryBank } = load('lib/puzzleEngine.ts');
  const { datasetHasEnoughDisplayedVariety } = load('lib/puzzleEngine.ts');
  const { canonicalizeDataset } = load('lib/dataEngine.ts');
  const { ROUND_CONFIGS } = load('lib/gameRules.ts');
  const tiedCategory = { ...catalog[0], direction: 'high', expectedRange: undefined, topValueFeasible: false, topValueDistinctCount: 1, rankingCompletenessStatus: 'comprehensive', unit: 'people', valueType: 'total', measurementType: 'total' };
  const tied = canonicalizeDataset({ category: tiedCategory, year: '2024', observations: Array.from({ length: 27 }, (_, i) => ({ countryId: 'A' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26), countryName: `Country ${i}`, value: i < 20 ? 100 : 120 - i * 2, year: '2024' })) });
  assert.ok(datasetHasEnoughDisplayedVariety(tied, ROUND_CONFIGS.expert), 'A tied Top 20 can still provide one winner and seven distinct lower-valued countries');
  const sevenValues = canonicalizeDataset({ ...tied, observations: tied.observations.slice(0, 26) });
  assert.equal(datasetHasEnoughDisplayedVariety(sevenValues, ROUND_CONFIGS.expert), false, 'Eight countries still require eight displayed values');
  assert.ok(datasetHasEnoughDisplayedVariety(sevenValues, ROUND_CONFIGS.easy), 'A smaller mode is assessed on its own bank size');
  const scoped = { ...tied, category: { ...tied.category, playableDifficulties: ['easy'] } };
  assert.ok(datasetHasEnoughDisplayedVariety(scoped, ROUND_CONFIGS.easy));
  assert.equal(datasetHasEnoughDisplayedVariety(scoped, ROUND_CONFIGS.normal), false, 'A successful Scout proof does not authorize Adventurer');
  const { validateRound } = load('lib/dataEngine.ts');
  const { STATIC_COUNTRIES } = load('lib/staticCountries.ts');
  const wrongScope = { ...scoped, category: { ...scoped.category, playableDifficulties: ['normal'] } };
  assert.ok(validateRound(Array(4).fill(wrongScope), STATIC_COUNTRIES.slice(0,4)).some(error => error.includes('not approved for Scout')));
  assert.equal(datasetHasEnoughDisplayedVariety({ ...scoped, category: { ...scoped.category, playableDifficulties: [] } }, ROUND_CONFIGS.easy), false, 'Empty mode scope fails closed');
  assert.equal(datasetHasEnoughDisplayedVariety({ ...tied, category: { ...tied.category, rankingCompletenessStatus: 'non_comprehensive' } }, ROUND_CONFIGS.easy), false, 'Removing tie gates must not waive coverage');
  assert.equal(assessCategorySetCountryBank([], [], ROUND_CONFIGS.easy, 'invalid'), 'infeasible');
  const { fetchAll: fetchAuditPages, supportedDifficulties } = require('./audit-v16-2-7-reachability.cjs');
  assert.deepEqual(supportedDifficulties({}), ['easy', 'normal', 'expert']);
  assert.deepEqual(supportedDifficulties({ playableDifficulties: ['easy'] }), ['easy']);
  assert.deepEqual(supportedDifficulties({ playableDifficulties: [] }), []);
  const auditRows = Array.from({ length: 407 }, (_, id) => ({ id }));
  assert.deepEqual(await fetchAuditPages(async (from, to) => ({ data: auditRows.slice(from, Math.min(to + 1, from + 200)), error: null })), auditRows, 'Audit paging must not silently truncate at a lower server row cap');
  await assert.rejects(fetchAuditPages(async () => ({ data: null, error: { message: 'unavailable' } })), /unavailable/);
  console.log('Catalog recovery behavior checks passed: real metadata, safe redirects, provider failures, complete paging, mode-aware maintenance audit.');
}
module.exports = { load };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
