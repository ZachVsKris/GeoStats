const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.2.3", "package version is not 16.2.3");
check(pkg.dependencies?.next === "16.2.11", "Next.js is not pinned to the v16.2.11 security release");
check(version.includes('APP_VERSION = "16.2.3"') && version.includes('RULES_VERSION = "16.2.3"'), "v16.2.3 app/rules version mismatch");
check(version.includes("CURATED-HISTORY"), "v16.2.3 category set is not versioned");

for (const file of [
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_3.sql",
  "VERIFY_V16_2_3.sql",
  "ROLLBACK_V16_2_3.sql",
  "V16_2_3_INSTALLATION.md",
  "RELEASE_NOTES_V16_2_3.md",
  "VALIDATION_V16_2_3.md",
  "FILE_MANIFEST_V16_2_3.txt",
  "SHA256SUMS_V16_2_3.txt",
  "supabase/migrations/044_v16_2_3_reliability_performance_history.sql",
  "scripts/import-historical-categories.py",
  "scripts/test-historical-importer.py",
  "lib/publicDaily.ts",
  "lib/dailyPublicPayload.ts",
  ".github/workflows/import-historical-v16-2-3.yml",
]) check(exists(file), `${file} missing`);

const correctedPrevious = read("supabase/migrations/043_v16_2_2_catalog_cleanup_historical_ui.sql");
const migration = read("supabase/migrations/044_v16_2_3_reliability_performance_history.sql");
const installer = read("RUN_THIS_IN_SUPABASE_FOR_V16_2_3.sql");
check(correctedPrevious.includes("Project''s Constitute service"), "corrected v16.2.2 migration still has the Constitute apostrophe bug");
check(!correctedPrevious.includes("Project's Constitute service"), "unescaped Constitute apostrophe remains in corrected v16.2.2 migration");
check(!installer.includes("Project's Constitute service"), "cumulative v16.2.3 installer reintroduces the unescaped SQL apostrophe");
check(installer.includes(correctedPrevious.trim()), "cumulative v16.2.3 installer does not contain the corrected v16.2.2 migration");
check(installer.includes(migration.trim()), "cumulative v16.2.3 installer does not contain migration 044");
check(correctedPrevious.includes("drop view if exists public.category_review_workbench_v16_2;") && correctedPrevious.includes("create view public.category_review_workbench_v16_2"), "v16.2.2 measurement_type view expansion does not safely recreate the Workbench view");
for (const token of [
  "category_release_decisions_v16_2_3",
  "needs_rewrite",
  "data_repair_required",
  "manual_review_required",
  "Inter-Parliamentary Union",
  "history:oldest-current-constitution",
  "history:ipu-recent-independence",
  "history:ipu-universal-womens-suffrage",
  "assert_v16_2_3_source_recovery",
  "geostats-v16.2.3-finalize-catalog",
]) check(migration.includes(token), `v16.2.3 migration missing ${token}`);
check((migration.match(/v16\.2\.3 review:/g) || []).length === 307, "v16.2.3 does not explicitly reclassify all 307 backlog rows");
const decisionStart = migration.indexOf("insert into public.category_release_decisions_v16_2_3(");
const decisionEnd = migration.indexOf("on conflict(category_id)", decisionStart);
const decisionChunk = migration.slice(decisionStart, decisionEnd);
const decisionCounts = { approved: 0, needs_rewrite: 0, data_repair_required: 0, manual_review_required: 0, duplicate: 0, rejected: 0 };
for (const match of decisionChunk.matchAll(/\('(?:[^']|'')*','(approved|needs_rewrite|data_repair_required|manual_review_required|duplicate|rejected)'/g)) decisionCounts[match[1]] += 1;
check(decisionCounts.approved === 5 && decisionCounts.needs_rewrite === 90 && decisionCounts.data_repair_required === 36 && decisionCounts.manual_review_required === 7 && decisionCounts.rejected === 168 && decisionCounts.duplicate === 1, `v16.2.3 backlog disposition split drifted: ${JSON.stringify(decisionCounts)}`);
check(migration.includes("'Inter-Parliamentary Union'") && migration.includes("when ranking_direction='low' then 'non_comprehensive'"), "historical high-end sparsity or lowest-wins completeness safeguard regressed");
check(migration.includes("enabled=v.computed_playable_v16_2") && migration.includes("eligible_daily=v.computed_playable_v16_2"), "Daily and Random no longer use the same computed playable catalog");
check(!migration.toLowerCase().includes("random_only") && !migration.toLowerCase().includes("random-only"), "Random-only tier was reintroduced");

const historical = read("scripts/import-historical-categories.py");
for (const token of [
  "Most recently admitted to the UN",
  "Oldest current constitution",
  "Most recently became independent",
  "Earliest universal women’s suffrage",
  "IPUHistoricalImporter",
  '"measurementType": "historical_date"',
]) check(historical.includes(token), `historical importer missing ${token}`);
check(!/world heritage|ramsar|biosphere/i.test(historical), "niche historical categories rejected by product review were added to the historical importer");

const sources = read("lib/sourceRegistry.ts") + read("lib/dataSources.ts") + read("lib/categoryTrust.ts") + read("lib/serverWarehouseCategories.ts") + read("lib/playableCatalog.ts");
check(sources.includes("Inter-Parliamentary Union") && sources.includes('case "ipu"'), "IPU is not fully wired through runtime source handling");

const puzzle = read("lib/puzzleEngine.ts");
const puzzleSnapshot = read("lib/puzzleWarehouseSnapshot.ts");
const seededRoute = read("app/api/seeded/[difficulty]/route.ts");
const game = read("components/GeoSecondComingGame.tsx");
check(puzzle.includes("loadCachedPuzzleWarehouseSnapshot") && puzzle.includes("60 * 60 * 1000") && puzzleSnapshot.includes("unstable_cache") && puzzleSnapshot.includes("60 * 60"), "Random warehouse snapshot is not cached across cold server instances and warm processes");
check(seededRoute.includes("Server-Timing") && seededRoute.includes("catalogLoadMs") && seededRoute.includes("generationMs"), "Random performance timing instrumentation missing");
check(seededRoute.includes("s-maxage=604800") && game.includes('cache: "force-cache"') && game.includes("catalog: CATEGORY_SET_VERSION"), "deterministic Random responses are not version-cacheable");

const dailyPage = read("app/daily/page.tsx") + read("app/daily/adventurer/page.tsx") + read("app/daily/expert/page.tsx");
const publicDaily = read("lib/publicDaily.ts");
check(dailyPage.includes("loadPublicDailyPayload") && dailyPage.includes("initialDailyPayload") && (dailyPage.match(/dynamic = \"force-dynamic\"/g) || []).length === 3, "Daily board is not request-date-safe and server-delivered with the initial page");
check(publicDaily.includes("unstable_cache") && publicDaily.includes('tags: ["geostats-daily-trio"]'), "published Daily trio lacks durable versioned server cache");
check(game.includes("initialDailyPayload") && game.includes("writeCachedDaily(today, initialDailyPayload)"), "client does not hydrate directly from server-delivered Daily data");

const css = read("app/globals.css");
check(!/@media\(max-width:520px\)[^\n]*category small[^\n]*line-clamp:2!important/.test(css), "mobile category descriptions are still hard-clamped to two lines");
check(!/@media\(max-width:620px\)[^\n]*expertRound \.category small[^\n]*line-clamp:1!important/.test(css), "Expert mobile category descriptions are still hard-clamped to one line");
check(read("lib/playableCatalog.ts").includes("maximum = 82"), "board copy was not shortened for unclipped mobile display");

check(!exists(".github/workflows/repair-comtrade-v16-2-1.yml"), "obsolete v16.2.1 Comtrade repair workflow is still runnable");
const verifyWorkflow = read(".github/workflows/verify-v16.yml");
check(verifyWorkflow.includes("Verify GeoStats v16.2.3") && verifyWorkflow.includes("npm run test-v16-2-3"), "verification workflow does not target v16.2.3");
const recovery = read(".github/workflows/import-v16-expansion.yml");
check(recovery.includes("Recover v16.2.3 audited catalog") && recovery.includes("--source ipu") && recovery.includes("--release-version 16.2.3"), "catalog recovery workflow omits v16.2.3 history or finalization");
check(read(".github/workflows/main.yml").includes("Import core source data"), "partial source workflow still misleadingly claims to import all sources");
check(!exists("tsconfig.tsbuildinfo"), "ignored TypeScript build cache remains in release");

const reviewApi = read("app/api/admin/category-review/route.ts");
const reviewUi = read("app/admin/review/CategoryReviewWorkbench.tsx");
check(reviewApi.includes("category_review_workbench_v16_2"), "Admin Workbench no longer uses canonical catalog view");
check(reviewApi.includes("release_disposition_v16_2_3") && reviewUi.includes("v16.2.3 disposition"), "Admin Workbench does not expose the v16.2.3 release disposition and reason");

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
check(legacyBranding.length === 0, `Legacy project-name references remain: ${legacyBranding.slice(0, 3).map((f) => path.relative(root, f)).join(", ")}`);

if (failures.length) {
  console.error("GeoStats v16.2.3 checks FAILED:\n" + failures.map((failure) => ` - ${failure}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16.2.3 static checks passed.");
