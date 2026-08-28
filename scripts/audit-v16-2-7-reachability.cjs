#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const root = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const ASSERT_RELEASE = process.argv.includes('--assert-release');
const sampleArg = process.argv.find((arg) => arg.startsWith('--anchor-samples='));
const randomArg = process.argv.find((arg) => arg.startsWith('--random-samples='));
const dailyArg = process.argv.find((arg) => arg.startsWith('--daily-days='));
const ANCHOR_SAMPLES = Number(sampleArg?.split('=')[1] || 30000);
const RANDOM_SAMPLES = Number(randomArg?.split('=')[1] || 240);
const DAILY_DAYS = Number(dailyArg?.split('=')[1] || 30);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and a Supabase service-role key are required for the production reachability audit.');
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function compileTree(sourceDir, outputDir) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      compileTree(sourcePath, path.join(outputDir, entry.name));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const relative = path.relative(path.join(root, 'lib'), sourcePath).replace(/\.ts$/, '.js');
    const target = path.join(outputDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const result = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
      fileName: sourcePath,
      reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
    fs.writeFileSync(target, result.outputText);
  }
}

function chunks(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

async function fetchAll(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const result = await queryFactory(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function assertTop20(round) {
  const ids = new Set(round.bank.map((country) => country.id));
  for (const dataset of round.categories) {
    const ranks = dataset.ranked.filter((row) => ids.has(row.countryId)).map((row) => row.globalRank);
    const best = ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY;
    if (best > 20) throw new Error(`top20:${dataset.category.id}: best displayed global rank is ${best}`);
  }
}

function failureStage(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/top20:/i.test(message)) return 'top20-invariant';
  if (/not reachable/i.test(message)) return 'production-solver';
  if (/not in the loaded playable catalog/i.test(message)) return 'catalog-load';
  if (/validation/i.test(message)) return 'round-validation';
  return 'unknown';
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function tallyRound(round, categoryCounts, countryCounts, bucketCounts, bucketFor) {
  for (const dataset of round.categories) {
    increment(categoryCounts, dataset.category.id);
    increment(bucketCounts, bucketFor(dataset.category));
  }
  for (const country of round.bank) increment(countryCounts, country.id);
}

function dateAt(index) {
  const date = new Date(Date.UTC(2026, 0, 1 + index));
  return date.toISOString().slice(0, 10);
}

function recentCategoryExposure(history, semanticFamily, bucketFor, maxDays = 21) {
  const recent = history.slice(-maxDays).reverse();
  const exposure = { category: {}, family: {}, bucket: {} };
  for (let index = 0; index < recent.length; index += 1) {
    const day = index + 1;
    const weight = day <= 3 ? 18 : day <= 7 ? 10 : day <= 14 ? 4 : 1.25;
    for (const round of Object.values(recent[index].trio)) {
      for (const dataset of round.categories) {
        const category = dataset.category;
        const family = semanticFamily(category);
        const bucket = bucketFor(category);
        exposure.category[category.id] = Math.max(exposure.category[category.id] || 0, weight);
        exposure.family[family] = (exposure.family[family] || 0) + weight;
        exposure.bucket[bucket] = (exposure.bucket[bucket] || 0) + weight;
      }
    }
  }
  return exposure;
}

function recentCountryExposure(history, maxDays = 7) {
  const recent = history.slice(-maxDays).reverse();
  const exposure = {};
  for (let index = 0; index < recent.length; index += 1) {
    const weight = Math.max(1, maxDays - index);
    for (const round of Object.values(recent[index].trio)) {
      for (const country of round.bank) exposure[country.id] = (exposure[country.id] || 0) + weight;
    }
  }
  return exposure;
}

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'geostats-v16-2-7-reachability-'));
  compileTree(path.join(root, 'lib'), path.join(output, 'lib'));
  // The audit supplies a real loaded catalog explicitly. Stub only the cached
  // server loader so importing puzzleEngine outside a Next.js runtime is safe.
  fs.writeFileSync(path.join(output, 'lib', 'puzzleWarehouseSnapshot.js'), 'exports.loadCachedPuzzleWarehouseSnapshot = async () => { throw new Error("Audit uses explicit production catalog"); };\n');

  const { buildPlayableCategoryCatalog } = require(path.join(output, 'lib', 'playableCatalog.js'));
  const { canonicalizeDataset, validateRound } = require(path.join(output, 'lib', 'dataEngine.js'));
  const { fetchCountries } = require(path.join(output, 'lib', 'worldBank.js'));
  const { worldKnowledgeBucket } = require(path.join(output, 'lib', 'categoryGeneration.js'));
  const { semanticFamily } = require(path.join(output, 'lib', 'gameRules.js'));
  const {
    generateAnchoredRoundFromLoadedCatalog,
    generateSeededRoundFromLoadedCatalog,
    generateDailyTrioFromLoadedCatalog,
    selectSeededAnchorCategoryId,
  } = require(path.join(output, 'lib', 'puzzleEngine.js'));

  const rows = await fetchAll((from, to) => supabase
    .from('category_runtime_review_v16_2')
    .select('*')
    .eq('computed_playable_v16_2', true)
    .order('quality_score', { ascending: false })
    .range(from, to));
  const categories = buildPlayableCategoryCatalog(rows);
  if (!categories.length) throw new Error('Production strict-pass catalog is empty.');

  // The player catalog intentionally preserves some legacy/stable gameplay IDs
  // while the warehouse may use newer descriptive row IDs. Production loading
  // resolves that identity before reading observations; the audit must do the
  // same or it can falsely report an observation gap for a healthy category.
  const playableIds = new Set(categories.map((category) => category.id));
  const warehouseIdByGameplayId = new Map();
  const gameplayIdByWarehouseId = new Map();
  for (const row of rows) {
    const built = buildPlayableCategoryCatalog([row]);
    if (built.length !== 1) continue;
    const gameplayId = built[0].id;
    if (!playableIds.has(gameplayId)) continue;
    const previous = warehouseIdByGameplayId.get(gameplayId);
    if (previous && previous !== row.id) {
      throw new Error(`Ambiguous warehouse identity for ${gameplayId}: ${previous} and ${row.id}`);
    }
    warehouseIdByGameplayId.set(gameplayId, row.id);
    gameplayIdByWarehouseId.set(row.id, gameplayId);
  }
  const unresolvedWarehouseIds = categories
    .map((category) => category.id)
    .filter((id) => !warehouseIdByGameplayId.has(id));
  if (unresolvedWarehouseIds.length) {
    throw new Error(`No warehouse identity for ${unresolvedWarehouseIds.length} playable categories: ${unresolvedWarehouseIds.slice(0, 20).join(', ')}`);
  }

  const byYear = new Map();
  for (const category of categories) {
    if (!Number.isInteger(category.commonYear)) throw new Error(`${category.id} has no integer common year.`);
    const group = byYear.get(category.commonYear) || [];
    group.push(category);
    byYear.set(category.commonYear, group);
  }
  const observationsByCategory = new Map(categories.map((category) => [category.id, []]));
  for (const [year, yearCategories] of byYear.entries()) {
    for (const categoryChunk of chunks(yearCategories, 24)) {
      const ids = categoryChunk.map((category) => warehouseIdByGameplayId.get(category.id));
      const observationRows = await fetchAll((from, to) => supabase
        .from('stat_observations')
        .select('category_id,country_iso3,country_name,data_year,value')
        .in('category_id', ids)
        .eq('data_year', year)
        .order('category_id')
        .order('country_iso3')
        .range(from, to));
      for (const row of observationRows) {
        const gameplayId = gameplayIdByWarehouseId.get(row.category_id);
        const list = gameplayId ? observationsByCategory.get(gameplayId) : undefined;
        if (!list) continue;
        list.push({
          countryId: String(row.country_iso3),
          countryName: String(row.country_name || row.country_iso3),
          value: Number(row.value),
          year: String(row.data_year),
        });
      }
    }
  }

  const datasets = [];
  const loadFailures = [];
  for (const category of categories) {
    try {
      const observations = observationsByCategory.get(category.id) || [];
      if (!observations.length) throw new Error('no approved common-year observations');
      datasets.push(canonicalizeDataset({ category, observations, year: String(category.commonYear) }));
    } catch (error) {
      loadFailures.push({ categoryId: category.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (loadFailures.length) {
    console.error(JSON.stringify({ loadFailures: loadFailures.slice(0, 25), count: loadFailures.length }, null, 2));
    throw new Error(`${loadFailures.length} playable categories cannot be loaded into the production solver.`);
  }

  const loaded = { datasets, catalogSize: categories.length, datasetLoadFailures: 0, datasetLoadErrorSamples: [], qualityRejections: 0, candidateSources: {} };
  const datasetById = new Map(datasets.map((dataset) => [dataset.category.id, dataset]));
  const countries = await fetchCountries();
  const difficulties = ['easy', 'normal', 'expert'];
  const reachabilityRows = [];
  const failures = [];
  const started = Date.now();

  for (let index = 0; index < datasets.length; index += 1) {
    const dataset = datasets[index];
    for (const difficulty of difficulties) {
      try {
        const generated = generateAnchoredRoundFromLoadedCatalog(
          countries,
          dataset.category.id,
          difficulty,
          loaded,
          `PROD-AUDIT-${difficulty}-${dataset.category.id}`,
        );
        if (!generated.round.categories.some((item) => item.category.id === dataset.category.id)) {
          throw new Error('forced anchor missing from generated board');
        }
        const errors = validateRound(generated.round.categories, generated.round.bank);
        if (errors.length) throw new Error(`validation: ${errors.join(' ')}`);
        assertTop20(generated.round);
        reachabilityRows.push({ category_id: dataset.category.id, difficulty, reachable: true, failure_stage: null, detail: `profile=${generated.profile}; score=${generated.score.overall}`, audit_version: 'geostats-v16.2.7-production-solver-v1', checked_at: new Date().toISOString() });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const failed = { category_id: dataset.category.id, difficulty, reachable: false, failure_stage: failureStage(error), detail, audit_version: 'geostats-v16.2.7-production-solver-v1', checked_at: new Date().toISOString() };
        reachabilityRows.push(failed);
        failures.push(failed);
      }
    }
    if ((index + 1) % 25 === 0 || index + 1 === datasets.length) {
      console.log(`Reachability ${index + 1}/${datasets.length} categories; failures=${failures.length}`);
    }
  }

  // Large cheap seed simulation tests the anchor-selection layer independently
  // from forced solver feasibility. Every playable category must receive an
  // opportunity; macro-domain balance cannot be inferred from the raw catalog
  // count because economy/trade/agriculture are intentionally much larger.
  const anchorCounts = new Map();
  const bucketCounts = new Map();
  for (const difficulty of difficulties) {
    for (let index = 0; index < ANCHOR_SAMPLES; index += 1) {
      const id = selectSeededAnchorCategoryId(`AUDIT-${difficulty}-${index}`, difficulty, loaded);
      if (!id) throw new Error(`No anchor selected for ${difficulty} sample ${index}.`);
      increment(anchorCounts, id);
      const category = datasetById.get(id)?.category;
      if (category) increment(bucketCounts, worldKnowledgeBucket(category));
    }
  }
  const catalogBuckets = new Set(datasets.map((dataset) => worldKnowledgeBucket(dataset.category)));
  const missingBuckets = [...catalogBuckets].filter((bucket) => !bucketCounts.has(bucket));
  const missingAnchors = datasets.map((dataset) => dataset.category.id).filter((id) => !anchorCounts.has(id));
  if (missingBuckets.length) failures.push({ category_id: '__macro_domain__', difficulty: 'all', reachable: false, failure_stage: 'anchor-distribution', detail: `No anchor exposure for: ${missingBuckets.join(', ')}` });
  if (missingAnchors.length) failures.push({ category_id: '__anchor_reachability__', difficulty: 'all', reachable: false, failure_stage: 'anchor-distribution', detail: `${missingAnchors.length} playable categories received zero anchor opportunities; sample: ${missingAnchors.slice(0, 20).join(', ')}` });

  // Run real seeded Random boards through the same production generator. This
  // catches pathologies hidden by a category-only propensity simulation.
  const randomCategoryCounts = new Map();
  const randomCountryCounts = new Map();
  const randomBucketCounts = new Map();
  for (const difficulty of difficulties) {
    for (let index = 0; index < RANDOM_SAMPLES; index += 1) {
      try {
        const generated = generateSeededRoundFromLoadedCatalog(countries, `PROD-RANDOM-${difficulty}-${index}`, difficulty, loaded);
        const errors = validateRound(generated.round.categories, generated.round.bank);
        if (errors.length) throw new Error(`validation: ${errors.join(' ')}`);
        assertTop20(generated.round);
        tallyRound(generated.round, randomCategoryCounts, randomCountryCounts, randomBucketCounts, worldKnowledgeBucket);
      } catch (error) {
        failures.push({ category_id: '__random__', difficulty, reachable: false, failure_stage: failureStage(error), detail: `seed ${index}: ${error instanceof Error ? error.message : String(error)}` });
        break;
      }
    }
  }

  // Simulate a rolling month of Daily trios with the same recent-category and
  // recent-country exposure signals used in production. There are no hard domain
  // templates; this is an outcome audit for long-run diversity and repetition.
  const dailyHistory = [];
  const dailyCategoryCounts = new Map();
  const dailyCountryCounts = new Map();
  const dailyBucketCounts = new Map();
  const dailyCategoryDates = new Map();
  for (let day = 0; day < DAILY_DAYS; day += 1) {
    const date = dateAt(day);
    try {
      const generated = generateDailyTrioFromLoadedCatalog(countries, date, loaded, {}, '', {
        budgetMs: 30000,
        candidateTarget: 40,
        jointSearch: true,
        jointFirst: true,
        recentCategoryExposure: recentCategoryExposure(dailyHistory, semanticFamily, worldKnowledgeBucket),
        recentCountryExposure: recentCountryExposure(dailyHistory),
      });
      for (const difficulty of difficulties) {
        const round = generated.trio[difficulty];
        const errors = validateRound(round.categories, round.bank);
        if (errors.length) throw new Error(`${difficulty} validation: ${errors.join(' ')}`);
        assertTop20(round);
        tallyRound(round, dailyCategoryCounts, dailyCountryCounts, dailyBucketCounts, worldKnowledgeBucket);
        for (const dataset of round.categories) {
          if (!dailyCategoryDates.has(dataset.category.id)) dailyCategoryDates.set(dataset.category.id, new Set());
          dailyCategoryDates.get(dataset.category.id).add(date);
        }
      }
      dailyHistory.push({ date, trio: generated.trio });
    } catch (error) {
      failures.push({ category_id: '__daily__', difficulty: 'all', reachable: false, failure_stage: failureStage(error), detail: `${date}: ${error instanceof Error ? error.message : String(error)}` });
      break;
    }
  }

  const priorityBuckets = ['history', 'culture-language-religion', 'sports', 'physical-geography', 'geology-natural-hazards']
    .filter((bucket) => catalogBuckets.has(bucket));
  const missingDailyPriority = priorityBuckets.filter((bucket) => !dailyBucketCounts.has(bucket));
  if (missingDailyPriority.length) failures.push({ category_id: '__daily_domains__', difficulty: 'all', reachable: false, failure_stage: 'daily-distribution', detail: `No Daily exposure across ${DAILY_DAYS} simulated dates for: ${missingDailyPriority.join(', ')}` });

  const pewIds = datasets
    .filter((dataset) => dataset.category.source?.organization === 'Pew Research Center' || dataset.category.id.startsWith('pew-religion:'))
    .map((dataset) => dataset.category.id);
  const missingPewAnchors = pewIds.filter((id) => !anchorCounts.has(id));
  if (missingPewAnchors.length) failures.push({ category_id: '__pew_religion__', difficulty: 'all', reachable: false, failure_stage: 'anchor-distribution', detail: `Playable Pew religion categories starved of anchors: ${missingPewAnchors.join(', ')}` });

  const historyAnchorCounts = datasets
    .filter((dataset) => worldKnowledgeBucket(dataset.category) === 'history')
    .map((dataset) => anchorCounts.get(dataset.category.id) || 0)
    .filter((value) => value > 0);
  const unAdmissionCount = anchorCounts.get('history:un-admission') || 0;
  const historyMedian = median(historyAnchorCounts);
  if (unAdmissionCount && historyMedian && unAdmissionCount > historyMedian * 4) {
    failures.push({ category_id: 'history:un-admission', difficulty: 'all', reachable: false, failure_stage: 'anchor-concentration', detail: `UN-admission anchor count ${unAdmissionCount} is >4x the history median ${historyMedian}.` });
  }

  const dailyTotalCategorySlots = [...dailyCategoryCounts.values()].reduce((sum, value) => sum + value, 0);
  const dailyMaxCategory = [...dailyCategoryCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const dailyMaxDates = [...dailyCategoryDates.entries()].sort((a, b) => b[1].size - a[1].size)[0] || [null, new Set()];
  if (dailyTotalCategorySlots && dailyMaxCategory[1] / dailyTotalCategorySlots > 0.10) {
    failures.push({ category_id: String(dailyMaxCategory[0]), difficulty: 'all', reachable: false, failure_stage: 'daily-concentration', detail: `Category occupies ${(100 * dailyMaxCategory[1] / dailyTotalCategorySlots).toFixed(1)}% of simulated Daily category slots.` });
  }
  if (DAILY_DAYS && dailyMaxDates[1].size / DAILY_DAYS > 0.40) {
    failures.push({ category_id: String(dailyMaxDates[0]), difficulty: 'all', reachable: false, failure_stage: 'daily-repeat', detail: `Category appears on ${dailyMaxDates[1].size}/${DAILY_DAYS} simulated Daily dates.` });
  }

  // Country diversity is evaluated conditional on opportunity. A country with
  // many Top-20 category opportunities should not disappear from thousands of
  // simulated board slots, but countries without such opportunity are not forced
  // into boards merely to equalize raw counts.
  const top20Opportunity = new Map();
  for (const dataset of datasets) {
    for (const row of dataset.ranked) {
      if (Number.isFinite(row.globalRank) && row.globalRank <= 20) increment(top20Opportunity, row.countryId);
    }
  }
  const combinedCountryCounts = new Map(randomCountryCounts);
  for (const [id, count] of dailyCountryCounts) increment(combinedCountryCounts, id, count);
  const meaningfulOpportunityCountries = [...top20Opportunity.entries()].filter(([, count]) => count >= 3).map(([id]) => id);
  const observedOpportunityCountries = meaningfulOpportunityCountries.filter((id) => (combinedCountryCounts.get(id) || 0) > 0);
  const opportunityCoverage = meaningfulOpportunityCountries.length ? observedOpportunityCountries.length / meaningfulOpportunityCountries.length : 1;
  if (opportunityCoverage < 0.70) {
    failures.push({ category_id: '__country_opportunity__', difficulty: 'all', reachable: false, failure_stage: 'country-distribution', detail: `Only ${(100 * opportunityCoverage).toFixed(1)}% of countries with 3+ Top-20 opportunities appeared in simulated Random/Daily boards.` });
  }
  const combinedCountrySlots = [...combinedCountryCounts.values()].reduce((sum, value) => sum + value, 0);
  const maxCountry = [...combinedCountryCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
  if (combinedCountrySlots && maxCountry[1] / combinedCountrySlots > 0.10) {
    failures.push({ category_id: `__country__:${maxCountry[0]}`, difficulty: 'all', reachable: false, failure_stage: 'country-concentration', detail: `Country occupies ${(100 * maxCountry[1] / combinedCountrySlots).toFixed(1)}% of simulated country slots.` });
  }

  if (WRITE) {
    for (const chunk of chunks(reachabilityRows, 250)) {
      const result = await supabase.from('generator_reachability_v16_2_7').upsert(chunk, { onConflict: 'category_id,difficulty' });
      if (result.error) throw new Error(`Reachability upsert failed: ${result.error.message}`);
    }
  }

  const elapsedSeconds = Math.round((Date.now() - started) / 1000);
  const summary = {
    playable: datasets.length,
    checks: reachabilityRows.length,
    failures: failures.length,
    allModesProven: failures.length === 0,
    anchorSamplesPerDifficulty: ANCHOR_SAMPLES,
    distinctAnchorsObserved: anchorCounts.size,
    missingAnchors: missingAnchors.length,
    macroDomainAnchorCounts: Object.fromEntries([...bucketCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    randomBoardsPerDifficulty: RANDOM_SAMPLES,
    randomDistinctCategories: randomCategoryCounts.size,
    randomDistinctCountries: randomCountryCounts.size,
    randomMacroDomainCounts: Object.fromEntries([...randomBucketCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    dailyDatesSimulated: dailyHistory.length,
    dailyDistinctCategories: dailyCategoryCounts.size,
    dailyDistinctCountries: dailyCountryCounts.size,
    dailyMacroDomainCounts: Object.fromEntries([...dailyBucketCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    dailyMaxCategory: { id: dailyMaxCategory[0], appearances: dailyMaxCategory[1] },
    dailyMaxRepeatDates: { id: dailyMaxDates[0], dates: dailyMaxDates[1].size },
    meaningfulOpportunityCountries: meaningfulOpportunityCountries.length,
    countryOpportunityCoverage: opportunityCoverage,
    maxCountry: { id: maxCountry[0], appearances: maxCountry[1], share: combinedCountrySlots ? maxCountry[1] / combinedCountrySlots : 0 },
    elapsedSeconds,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) {
    console.error(JSON.stringify({ failures: failures.slice(0, 100) }, null, 2));
    process.exitCode = 1;
    return;
  }
  if (ASSERT_RELEASE) {
    const result = await supabase.rpc('assert_v16_2_7_release');
    if (result.error) throw new Error(`v16.2.7 release assertion failed: ${result.error.message}`);
    console.log('v16.2.7 release assertion:', JSON.stringify(result.data));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
