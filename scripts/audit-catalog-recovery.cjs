// Read-only offline audit of connected-integration exports. Never publishes rows.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load } = require('./test-catalog-recovery.cjs');
const { buildCategoryCatalog } = load('lib/playableCatalog.ts');
const { canonicalizeDataset, validateRound } = load('lib/dataEngine.ts');
const { generateAnchoredRoundFromLoadedCatalog, generateDailyTrioFromLoadedCatalog } = load('lib/puzzleEngine.ts');
const { validateDailyTrio } = load('lib/dailyTrioRules.ts');
const { STATIC_COUNTRIES: countries } = load('lib/staticCountries.ts');
const { RULES_VERSION } = load('lib/version.ts');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const observations = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const targetPrefix = process.argv[4] || '';
const maximum = targetPrefix === 'maximum';
const maximumOverrides = maximum ? require('../audits/maximum-recovery-overrides-2026-09-07.json') : {};
const proposedCopy = {
  gdpGrowth: ['Fastest economic growth rate', 'Annual percentage growth in inflation-adjusted gross domestic product'],
  populationGrowth: ['Fastest population growth rate', 'Annual percentage growth in the total population'],
  sanitation: ['Highest % using safely managed sanitation', 'People using sanitation services that safely contain and treat waste'],
  'worldbank-catalog:bx-klt-dinv-wd-gd-zs': ['Highest foreign direct investment inflows as % of GDP', 'Net foreign direct investment entering the country during the year, as a percentage of GDP'],
  'worldbank-catalog:er-h2o-fwtl-zs': ['Highest freshwater withdrawals as % of internal resources', 'Annual freshwater withdrawals as a percentage of renewable internal freshwater resources'],
  'worldbank-catalog:fp-cpi-totl-zg': ['Highest inflation rate', 'Annual percentage change in consumer prices'],
  'worldbank-catalog:fs-ast-cgov-gd-zs': ['Highest net claims on government as % of GDP', 'Loans and other claims on central government, net of government deposits, as a percentage of GDP'],
};
if (maximum) Object.assign(proposedCopy, require('../audits/maximum-recovery-copy-2026-09-07.json'));
const additionalTargets = new Set([
  'sports:fifa-world-cup-first-appearance', 'history:worldbank-internet-half',
  'history:worldbank-under-five-mortality-below-50', 'history:worldbank-electricity-half',
  'who:WHS4_117', 'who:WHS8_110', 'natural-earth:most-land-neighbors',
  'natural-earth:landlocked-most-neighbors', 'natural-earth:landlocked-fewest-neighbors',
  'comtrade:most-coal-exported', 'comtrade:most-crude-oil-exported', 'comtrade:most-electricity-exported',
]);
const byId = new Map();
const warehouseById = new Map();
const datasets = [];
for (const row of rows) {
  if (maximum && !row.computed_playable_v16_2 && !maximumOverrides[row.id]) continue;
  const proposal = proposedCopy[row.id];
  let candidate = proposal ? { ...row, title: proposal[0], short_title: proposal[0], plain_language_description: proposal[1], metadata: { ...row.metadata, boardDescription: proposal[1] } } : row;
  if (maximum && /natural-earth:most-mapped-(lakes|rivers)/.test(row.id)) candidate = { ...candidate, measurement_type: 'total', value_type: 'total' };
  if (maximum && row.id.startsWith('unwpp:highest-')) candidate = { ...candidate, measurement_type: 'rate' };
  if (maximumOverrides[row.id]) {
    candidate = { ...candidate, ...maximumOverrides[row.id] };
    candidate.metadata = { ...row.metadata, ...maximumOverrides[row.id].metadata, boardDescription: candidate.plain_language_description };
  }
  // Candidate construction is deliberately not a claim of database approval.
  const category = buildCategoryCatalog([candidate], { playableOnly: !maximum && !proposal })[0];
  if (!category) throw new Error(`No runtime category for ${row.id}`);
  const values = observations[row.id];
  if (!values || values.length !== row.common_year_coverage) throw new Error(`Incomplete snapshot for ${row.id}`);
  const dataset = canonicalizeDataset({ category, year: String(row.common_year), observations: values.map(([countryId,value]) => ({ countryId, countryName: countries.find(c => c.id === countryId)?.name || countryId, value: Number(value), year: String(row.common_year) })) });
  if (dataset.ranked.length !== values.length) throw new Error(`Runtime silently filtered source observations for ${row.id}`);
  if (warehouseById.has(category.id)) throw new Error(`Duplicate runtime ID ${category.id}`);
  datasets.push(dataset); warehouseById.set(category.id,row.id); byId.set(row.id,candidate);
}
const loaded = { datasets, catalogSize: datasets.length, datasetLoadFailures: 0, datasetLoadErrorSamples: [], qualityRejections: 0, candidateSources: {} };
const proofs = [];
const targets = datasets.filter(d => !targetPrefix || (maximum ? !byId.get(warehouseById.get(d.category.id)).computed_playable_v16_2 : targetPrefix === 'candidates' ? proposedCopy[warehouseById.get(d.category.id)] : warehouseById.get(d.category.id).startsWith(targetPrefix)));
for (const dataset of targets) {
  const categoryId = warehouseById.get(dataset.category.id);
  for (const difficulty of ['easy','normal','expert']) {
    try {
      const { round } = generateAnchoredRoundFromLoadedCatalog(countries, dataset.category.id, difficulty, loaded, `RECOVERY-${difficulty}-${categoryId}`, maximum);
      const errors = validateRound(round.categories, round.bank);
      if (errors.length || !round.categories.some(d => d.category.id === dataset.category.id)) throw new Error(errors.join(' ') || 'Missing anchor');
      proofs.push({ category_id: categoryId, difficulty, reachable: true, audit_version: `geostats-v${RULES_VERSION}-production-solver-v1`, checked_at: new Date().toISOString(), fingerprint: crypto.createHash('sha256').update(JSON.stringify([byId.get(categoryId),observations[categoryId],RULES_VERSION])).digest('hex'), witness: { categories: round.categories.map(d => d.category.id), countries: round.bank.map(c => c.id) } });
    } catch (error) {
      // Bounded failures are unresolved; do not mark categories impossible.
      proofs.push({ category_id: categoryId, difficulty, reachable: null, error: error.message });
    }
  }
  console.error(`${proofs.length / 3}/${targets.length}: ${categoryId}; unresolved=${proofs.filter(p => p.reachable !== true).length}`);
}
let trio;
try {
  const generated = generateDailyTrioFromLoadedCatalog(countries, '2026-09-08', loaded, {}, 'RECOVERY-ACCEPTANCE');
  const errors = validateDailyTrio(generated.trio);
  if (errors.length) throw new Error(errors.join(' '));
  trio = { valid: true, modes: Object.fromEntries(Object.entries(generated.trio).map(([mode,r]) => [mode,{ categories:r.categories.map(d=>d.category.id),countries:r.bank.map(c=>c.id) }])) };
} catch (error) { trio = { valid: false, error: error.message }; }
console.log(JSON.stringify({ catalogSize: datasets.length, proposedCopy, proofs, trio }, null, 2));
if (proofs.some(p => p.reachable !== true) || !trio.valid) process.exitCode = 1;
