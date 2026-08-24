const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.2.4", "package version is not 16.2.4");
check(pkg.dependencies?.next === "16.2.11", "Next.js pin drifted from 16.2.11");
check(version.includes('APP_VERSION = "16.2.4"') && version.includes('RULES_VERSION = "16.2.4"'), "v16.2.4 app/rules version mismatch");
check(version.includes("SCOUT-4X4-ADVENTURER-6X4-EXPERT-8X6-V16-2-4"), "v16.2.4 category-set version does not encode new modes");

for (const file of [
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql","VERIFY_V16_2_4.sql","ROLLBACK_V16_2_4.sql",
  "V16_2_4_INSTALLATION.md","RELEASE_NOTES_V16_2_4.md","VALIDATION_V16_2_4.md",
  "HISTORICAL_CANDIDATES_V16_2_4.md","FILE_MANIFEST_V16_2_4.txt","SHA256SUMS_V16_2_4.txt",
  "supabase/migrations/045_v16_2_4_modes_variety_history.sql",".github/workflows/import-historical-v16-2-4.yml",
  ".github/workflows/generate-package-lock-v16-2-4.yml",
]) check(exists(file), `${file} missing`);
check(!exists(".github/workflows/import-historical-v16-2-3.yml"), "obsolete v16.2.3 historical workflow is still runnable");

const rules = read("lib/gameRules.ts");
for (const token of [
  'label: "Scout"','categoryCount: 4','countryCount: 4','pointsByRank: [100, 75, 50, 25]',
  'label: "Adventurer"','countryCount: 6','pointsByRank: [100, 80, 60, 40, 20, 0]',
  'label: "Expert"','categoryCount: 6','countryCount: 8','pointsByRank: [100, 85, 70, 55, 40, 25, 10, 0]',
  "LEGACY_V16_2_3_ROUND_CONFIGS","configForDifficultyDimensions",
]) check(rules.includes(token), `mode/scoring rules missing ${token}`);
check(rules.includes('decoyCount: 0') && rules.includes('maxScore: 400') && rules.includes('maxScore: 600'), "new decoy/max-score configuration missing");

const game = read("components/GeoSecondComingGame.tsx");
const measurement = read("lib/categoryMeasurement.ts");
check(game.includes('className="measurementBadge"') && measurement.includes('case "historical_date": return "DATE"'), "explicit measurement badges missing");
check(game.includes('className="resultsModeTabs"') && game.includes('aria-label="Results difficulty"'), "top results difficulty tabs missing");
check(game.includes("roundMaxScore") && game.includes("configForDifficultyDimensions"), "dimension-aware legacy/current score rendering missing");
check(game.includes("Use every country"), "Scout no-decoy copy missing");

const css = read("app/v15-7-clean.css");
check(css.includes("strict phone-fit play") && css.includes("height:100dvh") && css.includes("body:has(.shell.activePlay){overflow:hidden}"), "strict no-scroll phone viewport CSS missing");
check(css.includes(".activePlay.easyRound .bankPanel .countries{grid-template-columns:repeat(4") && css.includes(".activePlay.normalRound .bankPanel .countries{grid-template-columns:repeat(3") && css.includes(".activePlay.expertRound .bankPanel .countries{grid-template-columns:repeat(4"), "new mobile country grids missing");
check(css.includes(".activePlay.expertRound .boardPanel .slots") && css.includes("grid-template-rows:repeat(3"), "8x6 Expert phone category grid missing");
check(css.includes(".measurementBadge"), "measurement badge styling missing");

const e2e = read("e2e/mobile-daily.spec.ts");
for (const token of ["countries: 4, categories: 4","countries: 6, categories: 4","countries: 8, categories: 6","document.documentElement.scrollHeight","measurementBadge","resultsModeTabs"]) check(e2e.includes(token), `mobile E2E missing ${token}`);

const puzzle = read("lib/puzzleEngine.ts");
const daily = read("lib/dailyBoardService.ts");
check(puzzle.includes("recentCountryPenalty") && puzzle.includes("recentCountryExposure"), "Daily candidate repetition preference missing");
check(puzzle.includes("if (config.decoyCount === 0) return { winners, decoys: [] }"), "Scout zero-decoy generator path missing");
check(puzzle.includes('? 8 : config.difficulty === "normal" ? 12 : 16') && puzzle.includes('? 0.30 : config.difficulty === "normal" ? 0.22 : 0.15'), "new difficulty competitiveness profile drifted; Expert must inherit former Adventurer target");
check(daily.includes("recentCountryExposureFromRows") && daily.includes("loadRecentCountryExposure") && daily.includes("maxDays = 7"), "seven-day Daily country exposure history missing");
check(daily.includes("allowLegacyDimensions: true"), "stored v16.2.3 Daily compatibility missing");
const trio = read("lib/dailyTrioRules.ts");
check(trio.includes("allowLegacyDimensions") && trio.includes("configForDifficultyDimensions"), "Daily trio legacy compatibility missing");
const scores = read("app/api/scores/route.ts");
check(scores.includes("configForDifficultyDimensions") && /(?:storedChallenge|challenge)\.rules_version\s*!==\s*RULES_VERSION/.test(scores), "legacy score validation compatibility missing");
const leaderboardApi = read("app/api/leaderboard/route.ts");
const leaderboardView = read("components/LeaderboardView.tsx");
check(leaderboardApi.includes("LEGACY_V16_2_3_ROUND_CONFIGS") && leaderboardApi.includes("scoreMaximum") && leaderboardApi.includes("rules_version"), "leaderboard cross-version score normalization missing");
check(!leaderboardApi.includes('.lte("score", ROUND_CONFIGS[difficulty].maxScore)'), "leaderboard still filters valid legacy scores by the new max");
check(leaderboardApi.includes("averagePercent") && leaderboardView.includes("Avg. %") && leaderboardView.includes("averagePercent"), "all-time leaderboard still compares cross-version raw points");
const account = read("components/AccountControls.tsx");
const authCallback = read("app/auth/callback/route.ts");
const profileApi = read("app/api/profile/route.ts");
check(account.includes("signInWithOtp") && account.includes("savePendingScore") && authCallback.includes("exchangeCodeForSession") && profileApi.includes("username_customized"), "account creation/sign-in/profile flow regressed");

const historical = read("scripts/import-historical-categories.py");
for (const token of [
  "WorldBankHistoricalMilestonesImporter","Most recently became majority urban","Most recently reached 50% internet use",
  "Most recently reached 50% electricity access","Most recently reached 70-year life expectancy",
  "observed_threshold_crossing_years","Y >= threshold and Y-1 < threshold","worldbankhistory",
]) check(historical.includes(token), `historical milestone importer missing ${token}`);
check(!/World Heritage milestone|Ramsar|biosphere reserve milestone/i.test(historical), "niche historical milestone slipped into release importer");
const historicalTests = read("scripts/test-historical-importer.py");
check(historicalTests.includes("left-censored") && historicalTests.includes("gap") && historicalTests.includes("worldbank-majority-urban"), "historical crossing ambiguity regression tests missing");

const migration = read("supabase/migrations/045_v16_2_4_modes_variety_history.sql");
for (const token of ["apply_v16_2_4_catalog_curation","assert_v16_2_4_release","World Development Indicators: historical threshold milestones","history:worldbank-majority-urban","history:worldbank-life-expectancy-70"]) check(migration.includes(token), `v16.2.4 migration missing ${token}`);
check(migration.includes("perform public.apply_v16_2_3_catalog_curation()"), "v16.2.4 curation does not preserve v16.2.3 decisions");
for (const token of ["AG.LND.IRIG.AG.ZS","EG.ELC.COAL.ZS","EG.ELC.NUCL.ZS","GB.XPD.RSDV.GD.ZS","catalog_rewrites_resolved"]) check(migration.includes(token), `targeted share-category repair missing ${token}`);
check(!migration.toLowerCase().includes("random_only") && !migration.toLowerCase().includes("random-only"), "Random-only tier was reintroduced");

const workflow = read(".github/workflows/verify-v16.yml");
check(workflow.includes("Verify GeoStats v16.2.4") && workflow.includes("npm run test-v16-2-4"), "Verify workflow does not target v16.2.4");
const lockWorkflow = read(".github/workflows/generate-package-lock-v16-2-4.yml");
check(lockWorkflow.includes("npm install --package-lock-only") && lockWorkflow.includes("npm ci") && lockWorkflow.includes("package-lock.json"), "GitHub lockfile-generation workflow missing or unsafe");
const historyWorkflow = read(".github/workflows/import-historical-v16-2-4.yml");
check(historyWorkflow.includes("worldbankhistory") && historyWorkflow.includes("--release-version 16.2.4"), "historical workflow omits World Bank milestones or v16.2.4 finalizer");
const recovery = read(".github/workflows/import-v16-expansion.yml");
check(recovery.includes("Recover v16.2.4 audited catalog") && recovery.includes("worldbankhistory") && recovery.includes("--release-version 16.2.4"), "catalog recovery workflow does not cover v16.2.4 history/finalization");

// A real package lock is preferred, but it must never be fabricated. Until one exists,
// release workflows intentionally continue to use npm install instead of npm ci.
if (exists("package-lock.json")) {
  check(workflow.includes("npm ci"), "package-lock exists but Verify does not use npm ci");
} else {
  check(workflow.includes("npm install"), "no package-lock exists and Verify has no dependency-install fallback");
}

const skip = new Set([".git", "node_modules", ".next"]);
const cacheFiles = [];
const legacyBranding = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__") cacheFiles.push(full);
      else walk(full);
    } else {
      if (entry.name.endsWith(".pyc")) cacheFiles.push(full);
      if (!entry.name.endsWith(".zip") && !entry.name.endsWith(".png") && !entry.name.endsWith(".tsbuildinfo")) {
        const buffer = fs.readFileSync(full);
        if (!buffer.includes(0) && new RegExp("geo" + "hunter", "i").test(buffer.toString("utf8"))) legacyBranding.push(full);
      }
    }
  }
}
walk(root);
check(cacheFiles.length === 0, "Python cache files remain");
check(!exists("tsconfig.tsbuildinfo"), "TypeScript build cache remains in release");
check(legacyBranding.length === 0, `Legacy project-name references remain: ${legacyBranding.slice(0,3).map(f=>path.relative(root,f)).join(", ")}`);

if (failures.length) {
  console.error("GeoStats v16.2.4 checks FAILED:\n" + failures.map((failure) => ` - ${failure}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16.2.4 static checks passed.");
