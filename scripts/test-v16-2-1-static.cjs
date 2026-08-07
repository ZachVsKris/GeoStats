const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.2.1" && version.includes('APP_VERSION = "16.2.1"'), "v16.2.1 version mismatch");
check(version.includes('RULES_VERSION = "16.2.1"'), "v16.2 rules version missing");
for (const file of [
  "RUN_THIS_IN_SUPABASE_FOR_V16_2.sql",
  "VERIFY_V16_2.sql",
  "ROLLBACK_V16_2.sql",
  "V16_2_INSTALLATION.md",
  "RELEASE_NOTES_V16_2.md",
  "supabase/migrations/041_v16_2_catalog_recovery_and_joint_generation.sql",
  "scripts/recover-world-bank-catalog.py",
  "scripts/export-v16-2-category-audit.py",
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_1.sql",
  "VERIFY_V16_2_1.sql",
  "V16_2_1_INSTALLATION.md",
  "V16_2_1_VALIDATION.txt",
  "V16_2_1_CHANGED_FILES.txt",
  "V16_2_1_FILE_MANIFEST.txt",
  "RELEASE_NOTES_V16_2_1.md",
  "supabase/migrations/042_v16_2_1_audit_recovery_hotfix.sql",
]) check(exists(file), `${file} missing`);

const migration = read("supabase/migrations/041_v16_2_catalog_recovery_and_joint_generation.sql");
for (const token of [
  "category_promotion_assessment_v16_2",
  "refresh_category_promotion_assessment_v16_2",
  "apply_conservative_promotions_v16_2",
  "category_runtime_review_v16_2",
  "category_review_workbench_v16_2",
  "category_promotion_dry_run_v16_2",
  "category_catalog_consistency_v16_2",
  "refresh_v16_2_runtime_catalog",
  "finalize_v16_2_catalog",
  "computed_playable_v16_2",
]) check(migration.includes(token), `v16.2 migration missing ${token}`);
check(migration.includes("set enabled=v.computed_playable_v16_2") && migration.includes("eligible_daily=v.computed_playable_v16_2"), "Daily and Random do not use one shared playable catalog");
check(!migration.includes("'random_only'") && !migration.includes("'random-only'"), "v16.2 migration reintroduces a Random-only outcome");
check(migration.includes("source-specific quality floor") || migration.includes("source_specific_quality"), "source-specific blocker classification missing");
check(migration.includes("substantive_data_failure") && migration.includes("copy_or_semantic_rewrite"), "actionable blocker classes missing");
check(migration.includes("exact_duplicate_key") && migration.includes("suggested_duplicate_of_v16_2"), "exact duplicate detection/preference missing");
check(migration.includes("Highest share of land protected") && migration.includes("Highest fixed broadband subscriptions per 100 people"), "known clarity corrections missing");
check(read("RUN_THIS_IN_SUPABASE_FOR_V16_2.sql") === migration, "standalone v16.2 installer differs from migration");
check(migration.includes("Installation is deliberately dry-run only") && !migration.includes("select public.apply_conservative_promotions_v16_2();\n\ncreate or replace view"), "installer applies promotions before source recovery/audit instead of producing a dry run");


const hotfix = read("supabase/migrations/042_v16_2_1_audit_recovery_hotfix.sql");
for (const token of [
  "apply_v16_2_1_audit_reconciliation",
  "assert_v16_2_1_source_recovery",
  "catalog_recovery_status_v16_2_1",
  "world_bank_audited",
  "faostat_qcl_audited",
  "comtrade_audited",
  "proposed_playable",
  "COMTRADE_API_KEY",
]) check(hotfix.includes(token), `v16.2.1 migration missing ${token}`);
check(hotfix.includes("playable_count < 180"), "catalog-collapse publication guard missing");
check(hotfix.includes("enabled=v.computed_playable_v16_2") && hotfix.includes("eligible_daily=v.computed_playable_v16_2"), "v16.2.1 does not preserve one shared Daily/Random catalog");
check(read("RUN_THIS_IN_SUPABASE_FOR_V16_2_1.sql") === hotfix, "standalone v16.2.1 installer differs from migration");
check(!hotfix.includes("select public.refresh_v16_2_runtime_catalog();"), "installer publishes a catalog before recovery and audit");

const engine = read("lib/puzzleEngine.ts");
for (const token of [
  "combineCandidateRoundsIndexed",
  "constructGuidedTrio",
  "jointConstructionAttempts",
  "jointConstructionBacktracks",
  "compatiblePairs",
  "indexedCombinationChecks",
  "existingRounds",
]) check(engine.includes(token), `joint Daily generator missing ${token}`);
check(engine.includes("roundCompatibleWithExisting") && engine.includes("categoryConflictsWithExistingTrio"), "cross-mode constraints are not enforced during construction");
check(engine.includes("options.jointSearch !== false") && engine.includes("runJointFirst") && engine.includes("jointReserveMs"), "joint construction is not primary/reserved for operational generation");

const dailyService = read("lib/dailyBoardService.ts");
check(dailyService.includes("attempts ?? 1"), "admin/default Daily generation still performs multiple long attempts");
check(dailyService.includes("runNonce") && dailyService.includes("Math.random()"), "generation retries still use only a repeated deterministic salt");
const adminRoute = read("app/api/admin/daily/generate/route.ts");
check(adminRoute.includes("maxDuration = 90") && adminRoute.includes("attempts: 1") && adminRoute.includes("budgetMs: 58_000") && adminRoute.includes("jointFirst: true"), "admin Daily request is not bounded or joint-first");
const cronRoute = read("app/api/cron/daily/route.ts");
check(cronRoute.includes("attempts: 1") && cronRoute.includes("budgetMs: 105_000") && cronRoute.includes("jointFirst: true"), "scheduled generation options missing");
const generationLock = read("lib/dailyGenerationLock.ts");
check(generationLock.includes("420"), "Daily generation lock does not outlast the interactive request");

const runtimeCatalog = read("lib/playableCatalog.ts") + read("lib/serverPlayableCatalog.ts") + read("lib/serverWarehouseCategories.ts");
check(runtimeCatalog.includes("category_runtime_review_v16_2"), "application runtime still reads the v16.1 catalog");
check(runtimeCatalog.includes("computed_playable_v16_2"), "application runtime does not enforce the v16.2 gate");

const dashboard = read("app/admin/AdminDashboard.tsx");
check(dashboard.includes("There is no Random-only tier"), "admin does not explain the one-catalog policy");
check(dashboard.includes("primary_blocker_v16_2") && dashboard.includes("promotion_decision_v16_2"), "admin does not expose precise promotion blockers");
check(dashboard.includes("generationElapsed") || dashboard.includes("elapsed"), "admin generation does not show elapsed progress");
const workbench = read("app/admin/review/CategoryReviewWorkbench.tsx");
check(workbench.includes("PromotionFilter") && workbench.includes("data_repair_required") && workbench.includes("rewrite_required"), "Workbench cannot triage v16.2 outcomes");
check(workbench.includes("primary_blocker_v16_2"), "Workbench lacks a primary blocker");
const reviewApi = read("app/api/admin/category-review/route.ts");
check(reviewApi.includes("category_review_workbench_v16_2") && reviewApi.includes("promotion_decision_v16_2"), "Review API still targets the old workbench");
const bulkReviewApi = read("app/api/admin/categories/review/route.ts");
check(bulkReviewApi.includes("category_review_workbench_v16_2") && bulkReviewApi.includes("strict_pass_v16_2") && bulkReviewApi.includes("refresh_v16_2_runtime_catalog"), "Bulk review API still uses the old gate or runtime refresh");

const importerBase = read("scripts/data_pipeline/base.py");
check(importerBase.includes("replace_category_observations") && !importerBase.includes("self.warehouse.clear_category_observations(category_id)"), "generic source recovery is not transactional");

const recovery = read("scripts/recover-world-bank-catalog.py");
check(recovery.includes("--refresh-values") && recovery.includes("official_series_name") && recovery.includes("validation_status\": \"pending"), "World Bank legacy recovery is incomplete");
check(recovery.includes("replace_category_observations") && migration.includes("replace_stat_category_observations_v16_2"), "World Bank recovery cannot atomically refresh stored values");
const supabase = read("scripts/data_pipeline/supabase.py");
check(supabase.includes("list_categories_by_source") && supabase.includes("patch_category"), "warehouse helpers for legacy recovery missing");
check(supabase.includes("rpc/assert_v16_2_1_source_recovery") && supabase.includes("rpc/finalize_v16_2_catalog"), "finalizer bypasses the v16.2.1 source-recovery guard");
check(!supabase.includes('rpc/finalize_v16_catalog"'), "finalizer still has an unguarded legacy fallback");

const exportAudit = read("scripts/export-v16-2-category-audit.py");
check(exportAudit.includes("category-promotion-dry-run-v16-2-1.csv") && exportAudit.includes("category-promotion-final-v16-2-1.csv") && exportAudit.includes('"randomOnlyTier": False'), "v16.2 pre/final audit export or no-Random-only declaration missing");
check(exportAudit.includes("daily_random_mismatches"), "audit export does not enforce the one-catalog invariant");

const workflow = read(".github/workflows/import-v16-expansion.yml");
const comtradeRepairWorkflow = read(".github/workflows/repair-comtrade-v16-2-1.yml");
check(workflow.includes("Recover v16.2.1 audited catalog") && workflow.includes("recover-world-bank-catalog.py --refresh-values"), "v16.2 recovery workflow missing World Bank recovery");
check(workflow.includes("python scripts/import-faostat.py") && workflow.includes("python scripts/import-who.py"), "v16.2 recovery workflow omits core source refreshes");
check(workflow.includes("-r scripts/requirements-faostat.txt"), "workflow does not install pycountry/FAOSTAT requirements");
check(workflow.includes("geostats-v16-2-1-category-audit") && workflow.includes("export-v16-2-category-audit.py --phase pre") && workflow.includes("export-v16-2-category-audit.py --phase final"), "v16.2 pre/final audit artifact missing");
check(workflow.includes("actions/upload-artifact@v7"), "workflow does not use the Node 24 artifact action");

check(workflow.includes("COMTRADE_API_KEY") && workflow.includes("fail-on-source-error") && workflow.includes("fail-on-empty"), "workflow can still hide a missing major-source audit");
check(workflow.includes("import-faostat.py --report-dir") && workflow.includes("source-audit-${{ matrix.audit_slug }}"), "main FAOSTAT QCL audit artifact missing");
check(workflow.includes("import-comtrade.py --refresh-existing --require-complete"), "main v16.2.1 recovery still resume-skips existing Comtrade categories");
check(comtradeRepairWorkflow.includes("import-comtrade.py --refresh-existing --require-complete"), "Comtrade-only repair does not force-refresh all existing categories");
check(comtradeRepairWorkflow.includes("--source comtrade") && comtradeRepairWorkflow.includes("verified < 40"), "Comtrade-only repair is missing its independent audit/publication gate");
check(comtradeRepairWorkflow.includes("export-v16-2-category-audit.py --phase pre") && comtradeRepairWorkflow.includes("finalize-v16-catalog.py"), "Comtrade-only repair cannot resume guarded finalization");
check(!workflow.includes("actions/upload-artifact@v4"), "deprecated upload-artifact v4 remains");
const integrity = read("scripts/data_pipeline/integrity.py");
check(integrity.includes("geostats-v16.2.1-source-integrity-v3") && !integrity.includes('"official_unit", "unit", "ranking_direction"'), "World Bank official-unit false-failure repair missing");
const quality = read("scripts/data_pipeline/quality.py");
check(quality.includes("_select_common_year") && quality.includes("len(rows) >= rule.min_coverage"), "newest adequately covered common-year selector missing");
const faostat = read("scripts/import-faostat.py");
check(faostat.includes('"player_source_status": "exact" if') && faostat.includes('else "general"'), "FAOSTAT official general source link repair missing");
check(faostat.includes("player_title_present") && !faostat.includes('"official_title": str(category_row.get("title")'), "FAOSTAT still requires exact player-title equality");
check(faostat.includes("replace_stat_category_observations_v16_2") && !faostat.includes('"clear_stat_source_observations",\n        {"p_source_organization"'), "FAOSTAT recovery still performs a source-wide observation delete that can time out");

const verifyWorkflow = read(".github/workflows/verify-v16.yml");
check(verifyWorkflow.includes("Verify GeoStats v16.2.1") && verifyWorkflow.includes("npm run test-v16-2-1"), "verification workflow still targets an older release");
check(verifyWorkflow.includes("npm install") && verifyWorkflow.includes("npm run build") && verifyWorkflow.includes("npm run test-e2e"), "full verification workflow is incomplete");

const who = read("scripts/import-who.py");
check(who.includes('"highest-clean-fuel-access": "PHE_HHAIR_PROP_POP_CLEAN_FUELS"'), "WHO clean-cooking series regressed");
check(who.includes("%24top=500") && who.includes("get_odata"), "WHO importer does not page large responses");
const http = read("scripts/data_pipeline/http.py");
check(http.includes("HTTPException") && http.includes("OSError") && http.includes("Network error"), "HTTP client does not retry truncated source responses");

const currentFiles = [
  "supabase/migrations/041_v16_2_catalog_recovery_and_joint_generation.sql",
  "app/admin/AdminDashboard.tsx",
  "app/admin/review/CategoryReviewWorkbench.tsx",
  "scripts/export-v16-2-category-audit.py",
];
for (const file of currentFiles) {
  const text = read(file);
  check(!/["\']random_only["\']|proposed_status\s*=\s*["\']random["\']/i.test(text), `${file} contains a current Random-only status`);
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
check(legacyBranding.length === 0, `Legacy project-name references remain: ${legacyBranding.slice(0, 3).map((f) => path.relative(root, f)).join(", ")}`);

if (failures.length) {
  console.error("GeoStats v16.2.1 checks FAILED:\n" + failures.map((failure) => ` - ${failure}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16.2.1 static checks passed.");
