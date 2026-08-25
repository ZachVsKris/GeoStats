const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.2.5", "package version is not 16.2.5");
check(exists("package-lock.json"), "real package-lock.json is missing");
check(pkg.dependencies?.next === "16.2.11", "Next.js pin drifted from 16.2.11");
check(version.includes('APP_VERSION = "16.2.5"') && version.includes('RULES_VERSION = "16.2.5"'), "v16.2.5 app/rules version mismatch");
check(version.includes("SCOUT-4X4-ADVENTURER-6X4-EXPERT-8X6-V16-2-5"), "category-set version missing v16.2.5");
check(version.includes('SCORING_VERSION = "placements-v16.2.4"'), "v16.2.5 must not silently change the scoring model");

for (const file of [
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_5.sql","VERIFY_V16_2_5.sql","ROLLBACK_V16_2_5.sql",
  "V16_2_5_INSTALLATION.md","RELEASE_NOTES_V16_2_5.md","VALIDATION_V16_2_5.md",
  "FILE_MANIFEST_V16_2_5.txt","SHA256SUMS_V16_2_5.txt",
  "supabase/migrations/046_v16_2_5_ui_catalog_refinement.sql",
  ".github/workflows/import-historical-v16-2-5.yml",
]) check(exists(file), `${file} missing`);
check(!exists(".github/workflows/import-historical-v16-2-4.yml"), "obsolete v16.2.4 historical workflow is still runnable");
check(!exists(".github/workflows/generate-package-lock-v16-2-4.yml"), "obsolete lock-generation workflow remains after committing package-lock.json");

const rules = read("lib/gameRules.ts");
for (const token of [
  'label: "Scout"','categoryCount: 4','countryCount: 4','pointsByRank: [100, 75, 50, 25]',
  'label: "Adventurer"','countryCount: 6','pointsByRank: [100, 80, 60, 40, 20, 0]',
  'label: "Expert"','categoryCount: 6','countryCount: 8','pointsByRank: [100, 85, 70, 55, 40, 25, 10, 0]',
  "LEGACY_V16_2_3_ROUND_CONFIGS","strongestGlobalWinnerRankForCategory",
  'measureKind(category) === "historical"','ONE_PER_BOARD_KNOWLEDGE_CLUSTERS',
  '"forced-displacement"','"livestock-population"','"emissions"','"freshwater"','"tourism"','"energy-system"','"product-exports"',
]) check(rules.includes(token), `v16.2.5 game rule missing ${token}`);

const semantics = read("lib/categorySemantics.ts");
check(!semantics.includes("containment * 0.88"), "old 88% containment similarity false-positive logic remains");
check(semantics.includes("dice * 0.92"), "conservative cross-family similarity calculation missing");

const game = read("components/GeoSecondComingGame.tsx");
check(!game.includes("mobileCategoryInfo"), "category-card information icon remains");
check(game.includes('className="measurementBadge"'), "neutral measurement label is missing");
check(!game.includes("categoryMeasurementClass"), "measurement-type color classes remain in gameplay/results");
check(game.includes("🏆 Best Possible") && !game.includes("🏆 Perfect Round"), "results still use misleading Perfect Round copy");
check(game.includes('onTouchEnd={(event)=>{event.preventDefault();score();}} onClick={score}'), "one-tap touch Lock in draft handling missing");
check(game.includes('href={challengePath("easy", seed)}') && game.includes('href={challengePath("expert", seed)}'), "Random result difficulty links do not preserve the seed");
const tabIndex = game.indexOf('className="resultsModeTabs"');
const scoreIndex = game.indexOf('className="score"', tabIndex);
check(tabIndex >= 0 && scoreIndex > tabIndex, "results difficulty switcher is not above Final score");

const css = read("app/v15-7-clean.css");
for (const token of [
  "GeoStats v16.2.5","body:has(.shell.activePlay){overflow:hidden}",
  ".activePlay.easyRound .playGrid{grid-template-rows:48px",
  ".activePlay.normalRound .playGrid{grid-template-rows:66px",
  ".activePlay.expertRound .playGrid{grid-template-rows:70px",
  ".activePlay.easyRound .playGrid{grid-template-columns:minmax(250px,.72fr)",
  ".activePlay.expertRound .playGrid{grid-template-columns:minmax(460px,1.08fr)",
  ".rulesModalCard","touch-action:pan-y",
  ".seedControls .seedField input{width:18ch",
]) check(css.includes(token), `responsive/UI CSS missing ${token}`);
check(css.includes("content:none!important") && css.includes(".measure-total,.measure-share,.measure-per-capita,.measure-historical-date,.measure-other{--measurement-accent:var(--muted)}"), "measurement color accents are not fully neutralized");

const playable = read("lib/playableCatalog.ts");
for (const token of ["vegetable oil","computer[- ]chip","territorial waters","/duck/","/turkey/","/camel/","/hindu/","/volcano/","/freshwater|water stress|water withdrawal/"]) check(playable.includes(token), `playable icon/copy audit rule missing ${token}`);
check(playable.includes("Annual value of computer chips exported by each country."), "computer-chip copy correction missing");

const leaderboard = read("app/api/leaderboard/route.ts");
check(leaderboard.includes('row.rules_version === "16.2.4" || row.rules_version === RULES_VERSION'), "v16.2.4 scores would be mis-normalized after v16.2.5");
check(leaderboard.includes("LEGACY_V16_2_3_ROUND_CONFIGS"), "v16.2.3 score compatibility missing");
const account = read("components/AccountControls.tsx");
check(account.includes("signInWithOtp") && account.includes("savePendingScore"), "account sign-in/pending-score flow regressed");

const migration = read("supabase/migrations/046_v16_2_5_ui_catalog_refinement.sql");
for (const token of [
  "category_release_targets_v16_2_5","apply_v16_2_5_catalog_curation","assert_v16_2_5_release",
  "target_count<>63","promote_count<>33","repair_count<>30","ER.PTD.TOTL.ZS",
  "publication requires fresh source and ranking gates","perform public.assert_v16_2_4_release()",
]) check(migration.includes(token), `v16.2.5 migration missing ${token}`);
check((migration.match(/\('promote:/g) || []).length === 33, "migration does not register exactly 33 promotion targets");
check((migration.match(/\('repair:/g) || []).length === 30, "migration does not register exactly 30 repair targets");
check(!migration.toLowerCase().includes("random_only") && !migration.toLowerCase().includes("random-only"), "Random-only tier was reintroduced");

const workflow = read(".github/workflows/verify-v16.yml");
check(workflow.includes("Verify GeoStats v16.2.5") && workflow.includes("npm run test-v16-2-5") && workflow.includes("npm ci"), "Verify workflow is not locked to v16.2.5/npm ci");
const recovery = read(".github/workflows/import-v16-expansion.yml");
for (const token of ["Recover v16.2.5 audited catalog","tourismmigration","unescoheritage","ILOSTAT repair candidates","U.S. EIA oil and natural gas","--release-version 16.2.5"]) check(recovery.includes(token), `v16.2.5 recovery workflow missing ${token}`);
const historyWorkflow = read(".github/workflows/import-historical-v16-2-5.yml");
check(historyWorkflow.includes("worldbankhistory") && historyWorkflow.includes("--release-version 16.2.5"), "historical workflow is not v16.2.5 guarded");

const e2e = read("e2e/mobile-daily.spec.ts");
for (const token of ["countries: 4, categories: 4","countries: 6, categories: 4","countries: 8, categories: 6","document.documentElement.scrollHeight","one touch","rules modal","preserves the Random seed"]) check(e2e.toLowerCase().includes(token.toLowerCase()), `E2E coverage missing ${token}`);

for (const line of read("SHA256SUMS_V16_2_5.txt").split(/\r?\n/).filter(Boolean)) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  check(Boolean(match), `invalid v16.2.5 checksum line: ${line}`);
  if (!match) continue;
  const [, expected, file] = match;
  check(exists(file), `checksum target missing: ${file}`);
  if (!exists(file)) continue;
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
  check(actual === expected, `checksum mismatch: ${file}`);
}

const skip = new Set([".git", "node_modules", ".next"]);
const cacheFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name === "__pycache__") cacheFiles.push(full); else walk(full); }
    else if (entry.name.endsWith(".pyc")) cacheFiles.push(full);
  }
}
walk(root);
check(cacheFiles.length === 0, "Python cache files remain");
check(!exists("tsconfig.tsbuildinfo"), "TypeScript build cache remains in release");

if (failures.length) {
  console.error("GeoStats v16.2.5 checks FAILED:\n" + failures.map((failure) => ` - ${failure}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16.2.5 static checks passed.");
