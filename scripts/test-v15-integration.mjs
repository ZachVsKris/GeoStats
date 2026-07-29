import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "RUN_THIS_IN_SUPABASE_FOR_V15_5.sql",
  "VERIFY_V15_5.sql",
  "app/admin/review/page.tsx",
  "app/admin/review/CategoryReviewWorkbench.tsx",
  "app/api/admin/category-review/route.ts",
  "app/api/admin/category-review/[id]/route.ts",
  "supabase/migrations/026_category_review_workbench.sql",
  "supabase/migrations/027_v15_2_catalog_recovery.sql",
  "supabase/migrations/028_v15_3_gameplay_integrity.sql",
  "supabase/migrations/029_v15_4_runtime_catalog_and_diversity.sql",
  "supabase/migrations/030_v15_5_catalog_simplification_and_expansion.sql",
  "lib/roundValueRules.ts",
  "lib/valueFormatting.ts",
  "lib/sourceSpecification.ts",
  "lib/serverPlayableCatalog.ts",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing v15 file: ${file}`);
}
if (fs.existsSync(path.join(root, "middleware.ts"))) throw new Error("middleware.ts must be removed; Next.js 16 uses proxy.ts.");

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.version !== "15.5.0") throw new Error("package.json is not version 15.5.0");

const sql = fs.readFileSync(path.join(root, "supabase/migrations/026_category_review_workbench.sql"), "utf8");
for (const marker of [
  "category_review_state",
  "category_review_events_v15",
  "category_review_queue_v15",
  "category_review_overview_v15",
  "reconcile_category_playability_v15",
  "political_self_reported",
  "subjective_or_composite",
]) {
  if (!sql.includes(marker)) throw new Error(`v15 SQL is missing ${marker}`);
}

const serverCatalog = fs.readFileSync(path.join(root, "lib/serverPlayableCatalog.ts"), "utf8");
if (!serverCatalog.includes('.from("category_review_queue_v15")')) throw new Error("Runtime catalog is not using the v15 review view.");
if (!serverCatalog.includes('tier === "random"') || !serverCatalog.includes('buildPlayableCategoryCatalog')) throw new Error("Runtime catalog does not expose separate Daily and Random tiers.");

const workbench = fs.readFileSync(path.join(root, "app/admin/review/CategoryReviewWorkbench.tsx"), "utf8");
for (const marker of ["Political / self-report", "Too confusing", "Potential overlaps", "Keyboard:", "Save and next"]) {
  if (!workbench.includes(marker)) throw new Error(`Review Workbench is missing ${marker}`);
}


for (const relative of [
  "scripts/data_pipeline/base.py",
  "scripts/audit-source-integrity.py",
  "scripts/audit-player-source-links.py",
]) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  if (!text.includes("reconcile_category_playability_v15")) throw new Error(`${relative} does not reconcile v15 playability.`);
  if (text.includes("reconcile_category_playability_v144")) throw new Error(`${relative} still invokes the retired v14.4 reconciliation.`);
}

const trioRules = fs.readFileSync(path.join(root, "lib/dailyTrioRules.ts"), "utf8");
if (trioRules.includes("semanticConflict(firstDataset.category, secondDataset.category)")) throw new Error("Cross-mode semantic similarity must not be a hard rejection.");
if (!trioRules.includes("other.id === category.id")) throw new Error("Exact category duplication must still be blocked across Daily modes.");
for (const token of ["MAX_TRIO_DISPLACEMENT_CATEGORIES", "MAX_TRIO_AGRICULTURE_CATEGORIES", "MAX_TRIO_TRADE_CATEGORIES", "MIN_TRIO_PHYSICAL_CATEGORIES"]) {
  if (!trioRules.includes(token)) throw new Error(`Missing v15.4 trio strategy constraint: ${token}`);
}

const engine = fs.readFileSync(path.join(root, "lib/puzzleEngine.ts"), "utf8");
if (!engine.includes("generationProfile")) throw new Error("Server generation diagnostics must report the selected profile.");
const profiles = fs.readFileSync(path.join(root, "lib/generationProfiles.ts"), "utf8");
for (const marker of ["catalog-balanced", "catalog-recovery", "sourceCapacityForProfile"]) {
  if (!profiles.includes(marker)) throw new Error(`Adaptive Daily generation is missing ${marker}`);
}
const game = fs.readFileSync(path.join(root, "components/GeoSecondComingGame.tsx"), "utf8");
if (game.includes("buildDailyTrio")) throw new Error("Client must not generate Daily trios in the browser.");

console.log("GeoStats v15.5 category-review, runtime-tier, strategy-diversity, and fast Daily-loading checks passed.");

for (const required of [
  "app/admin/review/page.tsx",
  "app/admin/review/CategoryReviewWorkbench.tsx",
  "supabase/migrations/026_category_review_workbench.sql",
  "supabase/migrations/027_v15_2_catalog_recovery.sql",
]) {
  if (!fs.existsSync(path.join(root, required))) throw new Error(`Missing v15.1 release file: ${required}`);
}
const auditWorkflow = fs.readFileSync(path.join(root, ".github/workflows/audit-source-integrity.yml"), "utf8");
if (!/activate_enforcement:[\s\S]*?default:\s*false/.test(auditWorkflow)) throw new Error("Integrity enforcement must default to false");
const auditScript = fs.readFileSync(path.join(root, "scripts/audit-source-integrity.py"), "utf8");
for (const token of ["classify_nonblocking_audit_result", "true_integrity_failure", "return 1 if activation_failed or reconciliation_failed else 0"]) {
  if (!auditScript.includes(token)) throw new Error(`Missing audit safety token: ${token}`);
}

const detailRoute = fs.readFileSync(path.join(root, "app/api/admin/category-review/[id]/route.ts"), "utf8");
if (/^category-review-id-route\.ts\s*$/m.test(detailRoute)) throw new Error("The dynamic category-review route contains an accidental filename line.");
if (detailRoute.includes("loaded.detail.error.message")) throw new Error("The dynamic category-review route still dereferences a possibly undefined detail error.");
const hiddenWorkflows = fs.readdirSync(path.join(root, ".github/workflows"));
if (!hiddenWorkflows.includes("verify-v15.yml")) throw new Error("The active GitHub workflows are missing verify-v15.yml.");
if (hiddenWorkflows.includes("verify-v14-4.yml")) throw new Error("The obsolete v14.4 verification workflow must not run on the v15 repository.");

for (const required of [
  "lib/serverDataSources.ts",
  "lib/serverWarehouseCategories.ts",
]) {
  if (!fs.existsSync(path.join(root, required))) {
    throw new Error(`Missing server-side warehouse loader: ${required}`);
  }
}

const serverWarehouse = fs.readFileSync(
  path.join(root, "lib/serverWarehouseCategories.ts"),
  "utf8",
);
if (!serverWarehouse.includes('.from("category_review_queue_v15")')) {
  throw new Error(
    "Server-side warehouse loading must use the authoritative v15 catalog view.",
  );
}
if (!serverWarehouse.includes("randomOnlyAllowed") || !serverWarehouse.includes("computed_playable_v15 !== true")) {
  throw new Error("Server-side warehouse loading must enforce Daily playability while allowing explicit Random-only tiers.");
}

const warehouseClient = fs.readFileSync(
  path.join(root, "lib/warehouseCategories.ts"),
  "utf8",
);
if (warehouseClient.includes('payload.validationStatus !== "verified"')) {
  throw new Error(
    "The warehouse loader still blocks non-verification metadata warnings.",
  );
}
if (!warehouseClient.includes("computedPlayableV15 !== true")) {
  throw new Error(
    "The warehouse loader must use the authoritative v15 playability decision.",
  );
}

const warehouseRoute = fs.readFileSync(
  path.join(root, "app/api/warehouse-category/route.ts"),
  "utf8",
);
if (!warehouseRoute.includes("loadServerWarehousePayload")) {
  throw new Error(
    "The warehouse API route must use the direct server-side loader.",
  );
}
if (warehouseRoute.includes("evaluateCategoryPlayability")) {
  throw new Error(
    "The warehouse API route still re-applies the retired legacy playability matrix.",
  );
}

if (!engine.includes("fetchServerWarehouseCategories")) {
  throw new Error(
    "Daily generation is not using the bulk server warehouse loader.",
  );
}
if (!engine.includes("datasetLoadErrorSamples")) {
  throw new Error(
    "Daily generation diagnostics must expose representative dataset load failures.",
  );
}


const recoverySql = fs.readFileSync(path.join(root, "supabase/migrations/027_v15_2_catalog_recovery.sql"), "utf8");
for (const marker of [
  "v15_2_review_state_backup",
  "source_link_ready",
  "v15_warnings",
  "geostats-v15.2-review-v3",
  "coalesce(backup.curation_status, '') <> 'excluded'",
  "coalesce(backup.content_review_status, '') <> 'excluded'",
]) {
  if (!recoverySql.includes(marker)) throw new Error(`v15.2 recovery SQL is missing ${marker}`);
}
if (/and category\.player_source_status in \('exact','general'\)[\s\S]{0,200}computed_playable_v15/.test(recoverySql)) {
  throw new Error("v15.2 still treats exact/general player-link status as a hard playability requirement.");
}

for (const workflowName of fs.readdirSync(path.join(root, ".github/workflows"))) {
  if (!workflowName.endsWith(".yml")) continue;
  const workflowText = fs.readFileSync(
    path.join(root, ".github/workflows", workflowName),
    "utf8",
  );
  if (/actions\/(checkout|setup-node|setup-python)@v7/.test(workflowText)) {
    throw new Error(`${workflowName} references an unavailable v7 official setup action.`);
  }
}


const dataEngine = fs.readFileSync(path.join(root, "lib/dataEngine.ts"), "utf8");
if (!dataEngine.includes("dataset.category.globalCoverage ?? dataset.ranked.length")) {
  throw new Error("Decoded boards still validate winner ranks against board size instead of global coverage.");
}
const worldBank = fs.readFileSync(path.join(root, "lib/worldBank.ts"), "utf8");
if (!worldBank.includes("STATIC_COUNTRIES.map")) {
  throw new Error("Country identity still depends on a live World Bank request during game load.");
}
const gameFastPath = fs.readFileSync(path.join(root, "components/GeoSecondComingGame.tsx"), "utf8");
const loadDailyStart = gameFastPath.indexOf("async function loadDailyRound");
const loadRandomStart = gameFastPath.indexOf("async function loadRandomRound", loadDailyStart);
const loadDailyBody = gameFastPath.slice(loadDailyStart, loadRandomStart);
if (loadDailyBody.includes("buildDailyTrio")) {
  throw new Error("Daily loading still falls back to expensive browser-side trio generation.");
}
if (!loadDailyBody.includes("readCachedDaily") || !loadDailyBody.includes("writeCachedDaily")) {
  throw new Error("Daily loading must reuse a locally validated saved trio on repeat visits.");
}
