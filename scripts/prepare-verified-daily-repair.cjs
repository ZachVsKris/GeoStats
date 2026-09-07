// Offline preparation only. Publication requires a separate atomic, score-guarded SQL transaction.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const crypto = require('node:crypto');
const { load } = require('./test-catalog-recovery.cjs');
const { buildPlayableCategoryCatalog } = load('lib/playableCatalog.ts');
const { canonicalizeDataset, validateRound } = load('lib/dataEngine.ts');
const { generateDailyTrioFromLoadedCatalog } = load('lib/puzzleEngine.ts');
const { validateDailyTrio } = load('lib/dailyTrioRules.ts');
const codec = load('lib/challengeCodec.ts');
const { STATIC_COUNTRIES: countries } = load('lib/staticCountries.ts');
const { RULES_VERSION, DATASET_VERSION, CATEGORY_SET_VERSION } = load('lib/version.ts');
const [catalogPath, valuesPath, historyPath, date] = process.argv.slice(2);
assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
const rows = JSON.parse(fs.readFileSync(catalogPath));
const values = JSON.parse(fs.readFileSync(valuesPath));
const history = JSON.parse(fs.readFileSync(historyPath)).filter(r => r.challenge_date < date);
// Execute the exact pure exposure helpers from the application, without loading server clients.
const service = fs.readFileSync('lib/dailyBoardService.ts','utf8');
const start = service.indexOf('export function recentCountryExposureFromRows');
const end = service.indexOf('async function loadRecentCategoryExposure', start);
assert.ok(start > 0 && end > start);
const helpers = { exports: {} };
new Function('exports','deserializeRound','semanticFamily','worldKnowledgeBucket', ts.transpileModule(service.slice(start,end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(helpers.exports,codec.deserializeRound,load('lib/gameRules.ts').semanticFamily,load('lib/categoryGeneration.ts').worldKnowledgeBucket);
const datasets = rows.filter(r => r.computed_playable_v16_2 && r.enabled && r.eligible_daily).map(row => {
  const category = buildPlayableCategoryCatalog([row])[0]; assert.ok(category, row.id);
  const observations = values[row.id].map(([countryId,value]) => ({ countryId, countryName: countries.find(c => c.id === countryId)?.name || countryId, value: Number(value), year: String(row.common_year) }));
  assert.equal(observations.length, row.common_year_coverage);
  const dataset = canonicalizeDataset({ category, year: String(row.common_year), observations });
  assert.equal(dataset.ranked.length, observations.length);
  return dataset;
});
assert.equal(new Set(datasets.map(d => d.category.id)).size,datasets.length);
const generated = generateDailyTrioFromLoadedCatalog(countries,date,{
  datasets,catalogSize:datasets.length,datasetLoadFailures:0,datasetLoadErrorSamples:[],qualityRejections:0,candidateSources:{},
},{},'STRICT-CATALOG-REPAIR',{
  recentCountryExposure: helpers.exports.recentCountryExposureFromRows(history),
  recentCategoryExposure: helpers.exports.recentCategoryExposureFromRows(history),
});
assert.deepEqual(validateDailyTrio(generated.trio),[]);
const publication = Object.entries(generated.trio).map(([difficulty,round]) => {
  assert.deepEqual(validateRound(round.categories,round.bank),[]);
  const encoded = codec.encodeRound(round);
  const payload = codec.serializeRound(round);
  assert.deepEqual(validateRound(codec.deserializeRound(payload).categories,round.bank),[]);
  return { challenge_date:date,difficulty,seed:`DAILY-${difficulty.toUpperCase()}-${date}`,encoded_board:encoded,board_payload:payload,board_hash:crypto.createHash('sha256').update(encoded).digest('hex'),rules_version:RULES_VERSION,dataset_version:DATASET_VERSION,category_set_version:CATEGORY_SET_VERSION };
});
console.log(JSON.stringify({date,catalogSize:datasets.length,historyRows:history.length,valid:true,diagnostics:generated.diagnostics,publication}));
