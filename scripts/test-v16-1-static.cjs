const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.1.0" && version.includes('APP_VERSION = "16.1.0"'), "v16.1 version mismatch");
check(version.includes('RULES_VERSION = "16.1"'), "v16.1 rules version missing");
for (const file of [
  "RUN_THIS_IN_SUPABASE_FOR_V16_1.sql", "VERIFY_V16_1.sql", "ROLLBACK_V16_1.sql",
  "V16_1_INSTALLATION.md", "RELEASE_NOTES_V16_1.md", "scripts/export-v16-1-category-audit.py",
]) {
  check(fs.existsSync(path.join(root, file)), `${file} missing`);
}

const migration = read("supabase/migrations/040_v16_1_corrective_audit.sql");
for (const token of [
  "category_semantic_audit_v16_1", "category_full_audit_v16_1",
  "refresh_category_semantic_audit_v16_1", "apply_v16_1_copy_corrections",
  "PHE_HHAIR_PROP_POP_CLEAN_FUELS", "set statement_timeout='180s'",
  "where category_id is not null",
]) check(migration.includes(token), `v16.1 migration missing ${token}`);
check(migration.includes("Highest estimated rice consumption per person"), "Food Balance corrective SQL missing natural estimated-consumption wording");
check(migration.includes("Largest stateless population residing in the country"), "stateless residence wording missing");
check(migration.includes("Highest share of land and sea protected"), "protected-area share wording missing");

const engine = read("lib/puzzleEngine.ts");
check(engine.includes("ROUND_CANDIDATE_TARGET = 96"), "Daily candidate pool was not expanded");
check(engine.includes("accumulatedPools") && engine.includes("selectDiverseCandidates"), "cross-profile candidate accumulation missing");
check(engine.includes("categoryReuse") && engine.includes("countryReuse"), "candidate diversification still considers only one overlap");
const warehouse = read("lib/serverWarehouseCategories.ts");
check(warehouse.includes("loadChunkResilient") && warehouse.includes("categoryIds.slice"), "dataset failures are not isolated recursively");

const component = read("components/GeoSecondComingGame.tsx");
check(component.includes("dailyMemoryCache") && component.includes("dailyRequestCache"), "Daily payload request/cache deduplication missing");
check(component.includes('cache: "force-cache"'), "saved Daily path still bypasses browser caching");
check(component.includes("Among these {poolSize} countries"), "board ranking header still implies a global ranking");
check(component.includes('<svg viewBox="0 0 24 24"'), "mobile info icon was not replaced");
check(component.includes("Saved on this browser"), "anonymous result restoration missing");
const css = read("app/v15-7-clean.css");
check(css.includes("minmax(118px,1fr)") && css.includes("mobileCategoryInfo svg"), "seed visibility or info-icon polish missing");
check(css.includes("body:has(.shell.activePlay){overflow:hidden}"), "mobile gameplay can page-scroll");

const who = read("scripts/import-who.py");
check(who.includes('"highest-clean-fuel-access": "PHE_HHAIR_PROP_POP_CLEAN_FUELS"'), "WHO clean-cooking concept is not pinned to the proportion series");
check(who.includes("percentage value") && who.includes("outside 0-100"), "WHO percentage bounds check missing");
check(!who.includes('"highest-clean-fuel-access", "Highest clean-cooking-fuel access"'), "old ambiguous clean-cooking title remains");
const food = read("scripts/import-faostat-food-balances.py");
check(food.includes("Highest estimated rice consumption per person"), "Food Balance estimated-consumption title missing");
check(!food.includes(" available per person") && !food.includes(" supplied per person"), "Food Balance titles still use available/supplied wording");
const unhcr = read("scripts/import-unhcr.py");
check(unhcr.includes("Largest stateless population residing in the country"), "UNHCR stateless residence wording missing");
const comtrade = read("scripts/import-comtrade.py");
check(comtrade.includes("Largest poultry meat exports") && comtrade.includes('"🫙"'), "Comtrade poultry/spice copy fixes missing");

const catalog = read("lib/playableCatalog.ts");
check(catalog.includes("semantic_audit_status") && catalog.includes('row.semantic_audit_status === "pass"'), "runtime catalog does not enforce semantic audit pass");
check(catalog.includes("Highest estimated calorie intake per person"), "runtime Food Balance rewrite missing");
check(catalog.includes("replace(/^estimated\\s+/i") && catalog.includes("consumption|intake"), "runtime Food Balance title normalization can duplicate estimated-consumption wording");

const workbench = read("app/admin/review/CategoryReviewWorkbench.tsx");
check(workbench.includes("Needs data repair") && workbench.includes("semanticAuditSummary"), "Workbench does not expose the complete meaning/result audit queue");
const reviewApi = read("app/api/admin/category-review/route.ts");
check(reviewApi.includes('semantic_audit_status') && reviewApi.includes('Unsupported semantic-audit filter'), "Review API cannot filter the semantic audit");
const workflow = read(".github/workflows/import-v16-expansion.yml");
check(workflow.includes("Import v16.1 audited catalog") && workflow.includes("highest-clean-fuel-access"), "v16.1 correction workflow missing WHO repair");
check(workflow.includes("needs.import.result == 'success'") && workflow.includes("geostats-v16-1-category-audit"), "catalog finalization or complete-audit artifact is not gated correctly");
const verifyWorkflow = read(".github/workflows/verify-v16.yml");
check(verifyWorkflow.includes("Verify GeoStats v16.1") && verifyWorkflow.includes("npm run test-v16-1"), "verification workflow still targets v16.0");

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
      if (!entry.name.endsWith(".zip") && !entry.name.endsWith(".png")) {
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
  console.error("GeoStats v16.1 checks FAILED:\n" + failures.map((failure) => ` - ${failure}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16.1 static checks passed.");
