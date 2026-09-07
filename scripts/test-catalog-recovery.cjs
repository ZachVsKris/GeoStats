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
  {
  const { deserializeRound } = load('lib/challengeCodec.ts');
  const { validateRound } = load('lib/dataEngine.ts');
  const historicalRow = require('./fixtures/historical-expert-2026-09-05.json');
  assert.throws(() => deserializeRound(historicalRow.board_payload), /source and variety/);
  const historicalRound = deserializeRound(historicalRow.board_payload, { allowLegacyComposition: true });
  assert.equal(historicalRound.categories.length, 6);
  assert.ok(validateRound(historicalRound.categories, historicalRound.bank).some(e => e.includes('source and variety')));
  assert.deepEqual(validateRound(historicalRound.categories, historicalRound.bank, { allowLegacyComposition: true }), []);
  for (const corrupt of ['missing-country', 'duplicate-country', 'bad-rank', 'tied-values']) {
    const broken = structuredClone(historicalRow.board_payload);
    if (corrupt === 'missing-country') broken.categories[0].ranked.pop();
    if (corrupt === 'duplicate-country') broken.bank[0] = broken.bank[1];
    if (corrupt === 'bad-rank') for (const r of broken.categories[0].ranked) r.globalRank = 999;
    if (corrupt === 'tied-values') broken.categories[0].ranked[1].value = broken.categories[0].ranked[0].value;
    assert.throws(() => deserializeRound(broken, { allowLegacyComposition: true }), /saved board snapshot/, corrupt);
  }
  // Exercise the production history-weighting functions on the real legacy row.
  const service = fs.readFileSync(path.join(root, 'lib/dailyBoardService.ts'), 'utf8');
  const historyStart = service.indexOf('export function recentCountryExposureFromRows');
  const historyEnd = service.indexOf('async function loadRecentCategoryExposure', historyStart);
  assert.ok(historyStart > 0 && historyEnd > historyStart);
  const historyModule = { exports: {} };
  new Function('exports', 'deserializeRound', 'semanticFamily', 'worldKnowledgeBucket', ts.transpileModule(service.slice(historyStart, historyEnd), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(historyModule.exports, deserializeRound, load('lib/gameRules.ts').semanticFamily, load('lib/categoryGeneration.ts').worldKnowledgeBucket);
  assert.equal(Object.keys(historyModule.exports.recentCountryExposureFromRows([historicalRow])).length, 8);
  assert.equal(Object.keys(historyModule.exports.recentCategoryExposureFromRows([historicalRow]).category).length, 6);
  }

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
  const driftRows = require('./fixtures/runtime-catalog-drift-2026-09-07.json');
  const repaired = buildPlayableCategoryCatalog(driftRows);
  assert.equal(repaired.length, 4, 'Strict runtime must accept all four SQL-approved regression rows');
  assert.equal(repaired.find(c => c.id === 'natural-earth:coastline').measurementType, 'total');
  assert.equal(repaired.find(c => c.id === 'unwpp:fastest-pop-decline').measurementType, 'rate');
  assert.throws(() => buildPlayableCategoryCatalog([{ ...driftRows[0], source_organization: 'Unknown organization' }]), /contract drift/i);
  const { semanticConflict, inferSemanticProfile } = load('lib/categorySemantics.ts');
  const fixtures = require('./fixtures/catalog-recovery-2026-09-07.json');
  const catalog = buildPlayableCategoryCatalog(fixtures);
  assert.equal(catalog.length, fixtures.length, 'Presentation repairs must not hide approved categories');
  const find = id => { const c = catalog.find(c => c.id === id); assert.ok(c, id); return c; };
  const { categoryThemeClass, CATEGORY_COLOR_KEY } = load('lib/categoryTheme.ts');
  assert.deepEqual(CATEGORY_COLOR_KEY.map(([,label])=>label), ['Nature','People','Culture','Food','Economy','Technology']);
  const sample = (patch) => ({ ...catalog[0], ...patch });
  assert.equal(categoryThemeClass(find('natural-earth:largest-single-mapped-lake')), 'theme-nature');
  assert.equal(categoryThemeClass(find('pew-religion:other-religions-population')), 'theme-culture');
  assert.equal(categoryThemeClass(sample({ id:'faostat-fbs:tomatoes', name:'Highest tomato consumption per person', family:'Food consumption', broadDomain:'consumption', source:'faostatfbs' })), 'theme-food');
  assert.equal(categoryThemeClass(sample({ id:'comtrade:citrus', name:'Largest citrus fruit exports', family:'Trade', broadDomain:'trade', source:'comtrade' })), 'theme-economy');
  assert.equal(categoryThemeClass(sample({ id:'history:worldbank-infant-mortality-below-25', name:'Most recently cut infant mortality below 25', family:'History', broadDomain:'history', source:'history' })), 'theme-culture');
  assert.equal(categoryThemeClass(sample({ id:'unsdg:unsentenced-detainees', name:'Highest % of prisoners awaiting trial', family:'Government', broadDomain:'government', source:'unsdg' })), 'theme-people');
  const lakes = catalog.filter(c => /natural-earth:.*lake/.test(c.id));
  for (let i = 0; i < lakes.length; i++) for (let j = i + 1; j < lakes.length; j++) {
    assert.ok(semanticConflict(lakes[i], lakes[j]), `Actual lake metadata: ${lakes[i].id} / ${lakes[j].id}`);
  }
  assert.ok(semanticConflict(find('natural-earth:highest-mapped-glaciated-share'), find('natural-earth:largest-mapped-glaciated-area')));
  const donkey = sample({ id:'faostat-qcl-asses-stocks', source:'faostat', name:'Largest donkey population', family:'Agriculture', indicator:"QCL:'02132:5111", strategyFamily:'asses-stocks', semanticFamily:'asses-stocks', knowledgeCluster:'asses-stocks', similarityGroup:'asses-stocks' });
  const goats = { ...donkey, id:'goats-stocks', name:'Largest goat population', indicator:"QCL:'02123:5111", strategyFamily:'goat-stocks', semanticFamily:'goat-stocks', knowledgeCluster:'goat-stocks', similarityGroup:'goat-stocks' };
  assert.ok(semanticConflict(donkey,goats), 'Real donkey and goat stock metadata must conflict despite distinct imported labels');
  assert.ok(semanticConflict({ ...donkey, name:'Unrecognized species', id:'unknown-species', indicator:'QCL:999:5112' },goats), 'Official livestock stock elements must not depend on a species keyword list');
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
  const { estimatePlayableBoardCapacity, estimateValidCategorySets } = load('lib/seedCapacity.ts');
  const capacityRows = [scoped, scoped, scoped, { ...scoped, category: { ...scoped.category, playableDifficulties: [] } }];
  assert.equal(estimatePlayableBoardCapacity(capacityRows, [], ROUND_CONFIGS.normal).catalogSize, 0);
  assert.equal(estimatePlayableBoardCapacity(capacityRows, [], ROUND_CONFIGS.easy).catalogSize, 3);
  assert.equal(estimateValidCategorySets(capacityRows.map(d => d.category), ROUND_CONFIGS.normal).exactRawCategoryCombinations, '0');
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
