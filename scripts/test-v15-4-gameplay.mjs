import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const version = read("lib/version.ts");
for (const marker of ['APP_VERSION = "15.5.1"', 'RULES_VERSION = "12.1"']) {
  if (!version.includes(marker)) throw new Error(`Version marker missing: ${marker}`);
}

const rules = read("lib/roundValueRules.ts");
for (const marker of ["candidateKeepsDisplayedValuesDistinct", "displayedTieGroups", "displayedValueKey", "DISPLAY_KEY_CACHE"]) {
  if (!rules.includes(marker)) throw new Error(`Displayed-value rule missing: ${marker}`);
}

const engine = read("lib/puzzleEngine.ts");
for (const marker of [
  "candidateKeepsDisplayedValuesDistinct(categories, used, id)",
  "candidateKeepsDisplayedValuesDistinct(categories, selectedBankIds, country.id)",
  "datasetHasEnoughDisplayedVariety",
  "generationProfiles()",
  "sourceCapacityForProfile",
  "knowledgeCluster",
  "broadDomain",
  "GENERATION_BUDGET_MS = 18_000",
  "MAX_TRIO_ATTEMPTS_PER_PROFILE = 8",
]) {
  if (!engine.includes(marker)) throw new Error(`Server generator is missing ${marker}`);
}
if (engine.includes("MAX_BOARD_WINNER_GLOBAL_RANK = 5")) throw new Error("Winner rank was accidentally tied to Scout board size.");

const semantics = read("lib/categorySemantics.ts");
for (const marker of ["PROFILE_CACHE", "TOKEN_CACHE", "CONFLICT_CACHE", "knowledgeCluster", "categoryBroadDomain"]) {
  if (!semantics.includes(marker)) throw new Error(`Semantic generation cache missing: ${marker}`);
}
const quality = read("lib/categoryQuality.ts");
if (!quality.includes("QUALITY_CACHE")) throw new Error("Category-quality scoring is not cached during generation.");

const dataEngine = read("lib/dataEngine.ts");
if (!dataEngine.includes("displayedTieGroups(dataset")) throw new Error("Saved-board validation does not reject displayed ties.");
if (!dataEngine.includes("dataset.category.globalCoverage ?? dataset.ranked.length")) throw new Error("Winner rank must use global coverage.");

const game = read("components/GeoSecondComingGame.tsx");
for (const marker of [
  "candidateKeepsDisplayedValuesDistinct(categories, used, candidateId)",
  "candidateKeepsDisplayedValuesDistinct(categories, selectedBankIds, country.id)",
  "readCachedDaily(date)",
  "writeCachedDaily(date, saved)",
]) {
  if (!game.includes(marker)) throw new Error(`Browser game is missing ${marker}`);
}
const dailyStart = game.indexOf("async function loadDailyRound");
const randomStart = game.indexOf("async function loadRandomRound", dailyStart);
if (game.slice(dailyStart, randomStart).includes("loadCandidateDatasets")) {
  throw new Error("Daily mode must never generate hundreds of datasets in the browser.");
}

const sql = read("supabase/migrations/029_v15_4_runtime_catalog_and_diversity.sql");
for (const marker of [
  "category_runtime_review_v15_4",
  "catalogTier",
  "Most bordering countries",
  "Highest river density",
  "daily_qualified",
  "random_qualified",
]) {
  if (!sql.includes(marker)) throw new Error(`v15.4 SQL is missing ${marker}`);
}


const trioRules = read("lib/dailyTrioRules.ts");
for (const marker of ["MAX_TRIO_DISPLACEMENT_CATEGORIES = 2", "MAX_TRIO_AGRICULTURE_CATEGORIES = 3", "MAX_TRIO_TRADE_CATEGORIES = 3", "MIN_TRIO_PHYSICAL_CATEGORIES = 2"]) {
  if (!trioRules.includes(marker)) throw new Error(`Daily-trio strategy rule missing: ${marker}`);
}
const sourcePanel = read("components/CategorySourcePanel.tsx");
for (const marker of ["sourceHeroTop", "sourceHeroDescription", "sourceSpecPrimary", "formatExactCategoryValue"]) {
  if (!sourcePanel.includes(marker)) throw new Error(`Source panel is missing ${marker}`);
}

const faostat = read("scripts/import-faostat.py");
for (const marker of ['"item": candidate["item"]', '"element": candidate["element"]', '"itemCode": candidate["item_code"]', '"elementCode": candidate["element_code"]']) {
  if (!faostat.includes(marker)) throw new Error(`FAOSTAT exact measure metadata missing: ${marker}`);
}

const naturalEarth = read("scripts/import-natural-earth.py");
for (const marker of ['"Most bordering countries"', '"Longest coastline"', '"Highest river density"', '"Longest river network"']) {
  if (!naturalEarth.includes(marker)) throw new Error(`Natural Earth player-facing title cleanup missing: ${marker}`);
}

const reviewApi = read("app/api/admin/category-review/route.ts");
for (const marker of ["daily_ready", "random_only", "catalogTier"]) {
  if (!reviewApi.includes(marker)) throw new Error(`Category review tier visibility missing: ${marker}`);
}

console.log("GeoStats v15.5 gameplay-integrity checks passed.");
