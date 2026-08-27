const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'geostats-v15-7-generator-'));

function compileTree(sourceDir, outputDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(outputPath, { recursive: true });
      compileTree(sourcePath, outputPath);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const relative = path.relative(path.join(root, 'lib'), sourcePath).replace(/\.ts$/, '.js');
    const target = path.join(output, 'lib', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const result = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
      fileName: sourcePath,
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
      throw new Error(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
    }
    fs.writeFileSync(target, result.outputText);
  }
}

compileTree(path.join(root, 'lib'), path.join(output, 'lib'));
// Puzzle-engine imports are present at module load, but the pure test entrypoint
// never invokes them. Replace them so the test has no Supabase dependency.
fs.writeFileSync(path.join(output, 'lib', 'serverWarehouseCategories.js'), 'exports.fetchServerWarehouseCategories = async () => ({ datasets: [], errors: [] });\n');
fs.writeFileSync(path.join(output, 'lib', 'serverPlayableCatalog.js'), 'exports.loadServerPlayableCategoryCatalog = async () => [];\n');
fs.writeFileSync(path.join(output, 'lib', 'puzzleWarehouseSnapshot.js'), 'exports.loadCachedPuzzleWarehouseSnapshot = async () => ({ datasets: [], errors: [], catalogSize: 0 });\n');

const { generateDailyTrioFromLoadedCatalog, generateSeededRoundFromLoadedCatalog } = require(path.join(output, 'lib', 'puzzleEngine.js'));
const { validateDailyTrio } = require(path.join(output, 'lib', 'dailyTrioRules.js'));
const { validateRound } = require(path.join(output, 'lib', 'dataEngine.js'));

const continents = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const isoCodes = [];
for (let first = 0; first < 26 && isoCodes.length < 72; first += 1) {
  for (let second = 0; second < 26 && isoCodes.length < 72; second += 1) {
    isoCodes.push(`Z${String.fromCharCode(65 + first)}${String.fromCharCode(65 + second)}`);
  }
}
const countries = isoCodes.map((id, index) => ({
  id,
  name: `Country ${index + 1}`,
  region: continents[index % continents.length],
  continent: continents[index % continents.length],
  flag: '🌐',
  population: 1_000_000 + index * 500_000,
}));

const sources = ['worldbank', 'faostat', 'who', 'unesco', 'ilostat', 'naturalearth', 'comtrade', 'eia'];
const families = ['Economy', 'Agriculture', 'Health', 'Education', 'Labor', 'Geography', 'Trade', 'Energy'];
const domains = ['economy', 'agriculture', 'health', 'education', 'labor', 'physical-geography', 'trade', 'energy'];
const datasets = [];
for (let categoryIndex = 0; categoryIndex < 48; categoryIndex += 1) {
  const source = sources[categoryIndex % sources.length];
  const family = families[categoryIndex % families.length];
  const winnerIndex = categoryIndex;
  const observations = countries.map((country, countryIndex) => ({
    countryId: country.id,
    countryName: country.name,
    value: countryIndex === winnerIndex
      ? 1_000_000 + categoryIndex
      : 500_000 - countryIndex * 500 - categoryIndex * 3,
    year: '2025',
  })).sort((left, right) => right.value - left.value);
  const ranked = observations.map((row, index) => ({ ...row, globalRank: index + 1 }));
  const category = {
    id: `synthetic-${categoryIndex}`,
    source,
    dataset: 'Synthetic generator fixture',
    name: `Most synthetic measure ${categoryIndex + 1}`,
    shortName: `Measure ${categoryIndex + 1}`,
    indicator: `SYNTHETIC.${categoryIndex}`,
    warehouseSourceIndicatorCode: `SYNTHETIC.${categoryIndex}`,
    icon: '📊',
    unit: 'units',
    family,
    direction: 'high',
    description: 'Synthetic fixture used only by the generator regression test.',
    boardDescription: 'Synthetic fixture value.',
    certified: true,
    certificationGrade: 'A',
    coverageFloor: 30,
    globalCoverage: countries.length,
    commonYear: 2025,
    enabled: true,
    minimumYear: 2022,
    requireCommonYear: true,
    warehouseBacked: true,
    broadDomain: domains[categoryIndex % domains.length],
    knowledgeCluster: `cluster-${categoryIndex}`,
    semanticFamily: `family-${categoryIndex}`,
    semanticTopic: `topic-${categoryIndex}`,
    strategyFamily: `strategy-${categoryIndex}`,
    similarityGroup: `similarity-${categoryIndex}`,
    measureType: categoryIndex % 3 === 0 ? 'total' : categoryIndex % 3 === 1 ? 'share' : 'rate',
    normalizationType: categoryIndex % 3 === 0 ? 'absolute' : categoryIndex % 3 === 1 ? 'percentage' : 'rate',
    productSpecificTrade: source === 'comtrade',
    credibilityScore: 100,
    trustStatus: 'approved',
    contentReviewStatus: 'approved',
    playerQualityStatus: 'approved',
    sourceUrl: 'https://example.test/source',
  };
  datasets.push({
    category,
    observations,
    ranked,
    byCountry: new Map(ranked.map((row) => [row.countryId, row])),
    year: '2025',
    sourceUrl: 'https://example.test/source',
  });
}

const loaded = {
  datasets,
  catalogSize: datasets.length,
  datasetLoadFailures: 0,
  datasetLoadErrorSamples: [],
  qualityRejections: 0,
  candidateSources: Object.fromEntries(sources.map((source) => [source, datasets.filter((dataset) => dataset.category.source === source).length])),
};

const deterministicDailyOptions = { budgetMs: 20_000, candidateTarget: 64, jointSearch: true, jointFirst: true };
const first = generateDailyTrioFromLoadedCatalog(countries, '2026-07-29', loaded, {}, '', deterministicDailyOptions);
const second = generateDailyTrioFromLoadedCatalog(countries, '2026-07-29', loaded, {}, '', deterministicDailyOptions);
const firstShape = JSON.stringify(Object.fromEntries(Object.entries(first.trio).map(([difficulty, round]) => [difficulty, {
  categories: round.categories.map((dataset) => dataset.category.id),
  countries: round.bank.map((country) => country.id),
}])));
const secondShape = JSON.stringify(Object.fromEntries(Object.entries(second.trio).map(([difficulty, round]) => [difficulty, {
  categories: round.categories.map((dataset) => dataset.category.id),
  countries: round.bank.map((country) => country.id),
}])));

if (firstShape !== secondShape) throw new Error('Daily generation is not deterministic for one date and catalog snapshot.');
const errors = validateDailyTrio(first.trio);
if (errors.length) throw new Error(`Synthetic Daily trio failed validation: ${errors.join(' ')}`);
if (!first.diagnostics.generationProfile) throw new Error('Generator did not report the successful profile.');
for (const difficulty of ['easy', 'normal', 'expert']) {
  if (!first.trio[difficulty]) throw new Error(`Missing ${difficulty} board.`);
}

const seededFirst = generateSeededRoundFromLoadedCatalog(countries, 'ATLAS-TEST-261', 'normal', loaded);
const seededSecond = generateSeededRoundFromLoadedCatalog(countries, 'ATLAS-TEST-261', 'normal', loaded);
const seededShape = (generated) => JSON.stringify({
  categories: generated.round.categories.map((dataset) => dataset.category.id),
  countries: generated.round.bank.map((country) => country.id),
});
if (seededShape(seededFirst) !== seededShape(seededSecond)) {
  throw new Error('Seeded generation is not deterministic for one seed and catalog snapshot.');
}
const seededErrors = validateRound(seededFirst.round.categories, seededFirst.round.bank);
if (seededErrors.length) {
  throw new Error(`Synthetic Seeded Adventurer board failed validation: ${seededErrors.join(' ')}`);
}

// Random QA should explore the strong catalog broadly across unrelated seeds.
// This catches regressions where a handful of generator-friendly categories
// occupy most seeded boards even though every individual board is valid.
const seededExposure = new Map();
const seededRuns = 24;
for (let index = 0; index < seededRuns; index += 1) {
  const generated = generateSeededRoundFromLoadedCatalog(countries, `ATLAS-SPREAD-${index}`, 'normal', loaded);
  for (const dataset of generated.round.categories) {
    seededExposure.set(dataset.category.id, (seededExposure.get(dataset.category.id) || 0) + 1);
  }
}
const maxSeededExposure = Math.max(...seededExposure.values());
const averageSeededExposure = (seededRuns * 4) / datasets.length;
if (maxSeededExposure > averageSeededExposure * 2.7) {
  throw new Error(`Seeded Random category concentration is too high: max ${maxSeededExposure}, average ${averageSeededExposure.toFixed(1)}.`);
}

const fixedEasy = generateDailyTrioFromLoadedCatalog(countries, '2026-07-30', loaded, { easy: first.trio.easy }, '', deterministicDailyOptions);
const fixedEasyShape = JSON.stringify({
  categories: fixedEasy.trio.easy.categories.map((dataset) => dataset.category.id),
  countries: fixedEasy.trio.easy.bank.map((country) => country.id),
});
const originalEasyShape = JSON.stringify({
  categories: first.trio.easy.categories.map((dataset) => dataset.category.id),
  countries: first.trio.easy.bank.map((country) => country.id),
});
if (fixedEasyShape !== originalEasyShape) {
  throw new Error('Partial Daily repair did not preserve the fixed scored mode.');
}
const fixedErrors = validateDailyTrio(fixedEasy.trio);
if (fixedErrors.length) throw new Error(`Partial Daily repair failed validation: ${fixedErrors.join(' ')}`);

const alternateRepair = generateDailyTrioFromLoadedCatalog(
  countries,
  '2026-07-30',
  loaded,
  { easy: first.trio.easy },
  'preserve-valid-modes-2',
  deterministicDailyOptions,
);
const alternateEasyShape = JSON.stringify({
  categories: alternateRepair.trio.easy.categories.map((dataset) => dataset.category.id),
  countries: alternateRepair.trio.easy.bank.map((country) => country.id),
});
if (alternateEasyShape !== originalEasyShape) {
  throw new Error('An alternate repair attempt replaced a valid fixed Daily mode.');
}
const alternateErrors = validateDailyTrio(alternateRepair.trio);
if (alternateErrors.length) throw new Error(`Alternate partial repair failed validation: ${alternateErrors.join(' ')}`);

const jointFirst = generateDailyTrioFromLoadedCatalog(
  countries,
  '2026-08-05',
  loaded,
  {},
  'joint-first-regression',
  { budgetMs: 20_000, candidateTarget: 64, jointSearch: true, jointFirst: true },
);
if (!String(jointFirst.diagnostics.generationProfile || '').startsWith('guided-')) {
  throw new Error('Joint-first Daily generation did not use constraint-aware construction.');
}
if (!(jointFirst.diagnostics.jointConstructionAttempts > 0)) {
  throw new Error('Joint-first Daily generation did not report construction attempts.');
}
const jointErrors = validateDailyTrio(jointFirst.trio);
if (jointErrors.length) throw new Error(`Joint-first Daily trio failed validation: ${jointErrors.join(' ')}`);

console.log(`v16.2 generator, Random, joint-first, and valid-mode-preservation regressions passed with profile ${first.diagnostics.generationProfile}.`);
