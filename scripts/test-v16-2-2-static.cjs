const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.2.2", "package version is not 16.2.2");
check(version.includes('APP_VERSION = "16.2.2"') && version.includes('RULES_VERSION = "16.2.2"'), "v16.2.2 app/rules version mismatch");
check(version.includes("CURATED-HISTORY"), "v16.2.2 category-set version missing curated-history label");

for (const file of [
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_2.sql",
  "VERIFY_V16_2_2.sql",
  "V16_2_2_INSTALLATION.md",
  "RELEASE_NOTES_V16_2_2.md",
  "supabase/migrations/043_v16_2_2_catalog_cleanup_historical_ui.sql",
  "scripts/import-historical-categories.py",
  "scripts/test-historical-importer.py",
  "lib/categoryMeasurement.ts",
  ".github/workflows/import-historical-v16-2-2.yml",
]) check(exists(file), `${file} missing`);

const migration = read("supabase/migrations/043_v16_2_2_catalog_cleanup_historical_ui.sql");
for (const token of [
  "measurement_type",
  "category_release_decisions_v16_2_2",
  "apply_v16_2_2_backlog_dispositions",
  "apply_v16_2_2_copy_corrections",
  "apply_v16_2_2_catalog_curation",
  "refresh_measurement_types_v16_2_2",
  "assert_v16_2_2_source_recovery",
  "history:un-admission",
  "history:newest-current-constitution",
  "Largest protected share of land and sea",
  "comtrade:most-sports-equipment-exported",
  "public, %I",
]) check(migration.includes(token), `v16.2.2 migration missing ${token}`);
check(read("RUN_THIS_IN_SUPABASE_FOR_V16_2_2.sql") === migration, "standalone v16.2.2 installer differs from migration");
check(migration.includes("observation_count>=100 and top_value_distinct_count>=15"), "source-neutral high-end ranking completeness rule missing");
check(migration.includes("when ranking_direction='low' then 'non_comprehensive'"), "lowest-wins completeness safeguard regressed");
check(migration.includes("enabled=v.computed_playable_v16_2") && migration.includes("eligible_daily=v.computed_playable_v16_2"), "Daily and Random no longer share one playable catalog");
check(!migration.includes("random_only") && !migration.includes("random-only"), "Random-only category tier reintroduced");
check((migration.match(/v16\.2\.2 catalog review:/g) || []).length === 307, "full 307-row unresolved backlog disposition is incomplete");
check(migration.includes("'approved'") && migration.includes("'rejected'") && migration.includes("'needs_discussion'"), "backlog decisions do not distinguish outcomes");


const versionCompat = read("lib/version.ts");
check(versionCompat.includes("MAX_YEAR_SPREAD") && versionCompat.includes("SCORING_VERSION") && versionCompat.includes("BOARD_NORMALIZATION_VERSION"), "v16.2.2 version file dropped runtime compatibility constants");
const dataSources = read("lib/dataSources.ts");
const trust = read("lib/categoryTrust.ts");
check(dataSources.includes('case "unmembership"') && dataSources.includes('case "constitute"'), "historical sources are missing from runtime data-source dispatch");
check(trust.includes('case "unmembership"') && trust.includes('case "constitute"'), "historical sources are missing from trust profiles");

const historical = read("scripts/import-historical-categories.py");
for (const token of [
  "UN_MEMBER_STATES_URL",
  "CONSTITUTE_SERVICE_URL",
  "Most recently admitted to the UN",
  "Newest current constitution",
  '"measurementType": "historical_date"',
  "parse_un_member_states_html",
  "parse_constitute_current_constitutions",
]) check(historical.includes(token), `historical importer missing ${token}`);
check(!/wikipedia/i.test(historical), "historical importer relies on Wikipedia instead of the documented source stack");

const integrity = read("scripts/data_pipeline/integrity.py");
const audit = read("scripts/audit-source-integrity.py");
check(integrity.includes('source_slug == "unmembership"') && integrity.includes('source_slug == "constitute"'), "historical source-identity checks missing");
check(integrity.includes("constitutions_endpoint") && integrity.includes("in_force_selected") && integrity.includes("year_enacted_selected"), "Constitute audit is not keyed to explicit in-force constitution metadata");
check(audit.includes('"unmembership"') && audit.includes('"constitute"'), "historical sources cannot be independently audited");

const categoryTypes = read("lib/categoryMeasurement.ts");
for (const token of ["total", "share", "per_capita", "historical_date", "categoryMeasurementClass", "categoryMeasurementLabel"]) {
  check(categoryTypes.includes(token), `measurement-type helper missing ${token}`);
}
const css = read("app/globals.css");
for (const token of ["measure-total", "measure-share", "measure-per-capita", "measure-historical-date"]) {
  check(css.includes(token), `subtle measurement accent missing ${token}`);
}
const game = read("components/GeoSecondComingGame.tsx");
const sourcePanel = read("components/CategorySourcePanel.tsx");
check(game.includes("categoryMeasurementClass") && sourcePanel.includes("categoryMeasurementClass"), "measurement accents are not applied across gameplay/results/source views");

const playable = read("lib/playableCatalog.ts") + read("lib/serverPlayableCatalog.ts");
check(playable.includes("measurement_type") && playable.includes("historical_date"), "runtime catalog drops measurement metadata");
check(playable.includes("comtrade:most-sports-equipment-exported"), "sports-equipment export category is not hard-retired at runtime");
check(playable.includes('"United Nations": "unmembership"') && playable.includes('"Constitute Project": "constitute"'), "historical sources are not mapped into the runtime source registry");

const daily = read("lib/dailyBoardService.ts");
check(daily.includes("pgcrypto") && daily.includes("permission") && daily.includes("schema cache"), "Daily publication still collapses distinct RPC/dependency failures into one message");

const faostat = read("scripts/import-faostat.py");
check(faostat.includes("replace_stat_category_observations_v16_2") && !faostat.includes('"clear_stat_source_observations",\n        {"p_source_organization"'), "FAOSTAT timeout hotfix regressed");
const recovery = read(".github/workflows/import-v16-expansion.yml");
check(recovery.includes("Recover v16.2.2 audited catalog") && recovery.includes("import-comtrade.py --refresh-existing --require-complete"), "main recovery workflow regressed Comtrade refresh or release label");
check(recovery.includes("--source unmembership") && recovery.includes("--source constitute"), "full recovery omits historical source audits");
const histWorkflow = read(".github/workflows/import-historical-v16-2-2.yml");
check(histWorkflow.includes("Import v16.2.2 historical categories and finalize") && histWorkflow.includes("--release-version 16.2.2"), "focused historical workflow cannot finish guarded v16.2.2 publication");
const finalizer = read("scripts/finalize-v16-catalog.py");
const warehouseClient = read("scripts/data_pipeline/supabase.py");
check(finalizer.includes('default="16.2.2"') && warehouseClient.includes("assert_v16_2_2_source_recovery"), "catalog finalizer is not guarded by the v16.2.2 release assertion");
const repairWorkflow = read(".github/workflows/repair-comtrade-v16-2-1.yml");
check(repairWorkflow.includes("finalize-v16-catalog.py --release-version 16.2.1"), "legacy Comtrade repair is not pinned to its v16.2.1 guard");

const verifyWorkflow = read(".github/workflows/verify-v16.yml");
check(verifyWorkflow.includes("Verify GeoStats v16.2.2") && verifyWorkflow.includes("npm run test-v16-2-2"), "verification workflow does not target v16.2.2");

const reviewApi = read("app/api/admin/category-review/route.ts");
const dashboardApi = read("app/api/admin/dashboard/route.ts");
check(reviewApi.includes("measurement_type") && reviewApi.includes("category_review_workbench_v16_2"), "Admin Workbench does not consume the canonical runtime status/measurement view");
check(dashboardApi.includes("measurement_type") && dashboardApi.includes("United Nations") && dashboardApi.includes("Constitute Project"), "Admin dashboard drops v16.2.2 measurement or historical-source metadata");

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
  console.error("GeoStats v16.2.2 checks FAILED:\n" + failures.map((failure) => ` - ${failure}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16.2.2 static checks passed.");
