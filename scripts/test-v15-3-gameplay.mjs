import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const version = read("lib/version.ts");
for (const marker of ['APP_VERSION = "15.3.0"', 'RULES_VERSION = "10.0"']) {
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
  "GENERATION_BUDGET_MS = 18_000",
  "MAX_TRIO_ATTEMPTS_PER_PROFILE = 8",
]) {
  if (!engine.includes(marker)) throw new Error(`Server generator is missing ${marker}`);
}
if (engine.includes("MAX_BOARD_WINNER_GLOBAL_RANK = 5")) throw new Error("Winner rank was accidentally tied to Scout board size.");

const semantics = read("lib/categorySemantics.ts");
for (const marker of ["PROFILE_CACHE", "TOKEN_CACHE", "CONFLICT_CACHE"]) {
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

const sql = read("supabase/migrations/028_v15_3_gameplay_integrity.sql");
for (const marker of [
  "CR.MOD.1",
  "natural-earth:longest-coastline",
  "natural-earth:most-land-neighbors",
  "editorial_clear_pass",
  "Runtime tie-density and board-composition checks still apply",
]) {
  if (!sql.includes(marker)) throw new Error(`v15.3 SQL is missing ${marker}`);
}

const sourcePanel = read("components/CategorySourcePanel.tsx");
for (const marker of ["sourceTitleBlock", "sourceHeroDescription", "sourceSpec", "formatExactCategoryValue"]) {
  if (!sourcePanel.includes(marker)) throw new Error(`Source panel is missing ${marker}`);
}

const faostat = read("scripts/import-faostat.py");
for (const marker of ['"item": candidate["item"]', '"element": candidate["element"]', '"itemCode": candidate["item_code"]', '"elementCode": candidate["element_code"]']) {
  if (!faostat.includes(marker)) throw new Error(`FAOSTAT exact measure metadata missing: ${marker}`);
}

console.log("GeoStats v15.3 gameplay-integrity checks passed.");
