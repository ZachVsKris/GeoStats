const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
check(pkg.version === "16.0.0" && version.includes('APP_VERSION = "16.0.0"'), "v16 version mismatch");
check(version.includes('RULES_VERSION = "16.0"'), "v16 rules version missing");
check(fs.existsSync(path.join(root, "RUN_THIS_IN_SUPABASE_FOR_V16_0.sql")), "v16 installer missing");
check(fs.existsSync(path.join(root, "VERIFY_V16_0.sql")), "v16 verification SQL missing");
check(fs.existsSync(path.join(root, "ROLLBACK_V16_0.sql")), "v16 rollback SQL missing");
const migration = read("supabase/migrations/039_v16_0_integrated_release.sql");
for (const token of ["publish_daily_trio_v16", "category_runtime_review_v16", "ranking_completeness_status", "finalize_v16_catalog", "refresh_v16_runtime_catalog", "category_review_workbench_v16"]) {
  check(migration.includes(token), `v16 migration missing ${token}`);
}
const dailyRoute = read("app/api/daily-trio/[date]/route.ts");
check(!dailyRoute.includes("generateDailyTrio") && !dailyRoute.includes("fetchCountries"), "public Daily GET still generates or loads the full catalog");
check(dailyRoute.includes("X-GeoStats-Fallback"), "Daily fallback is not explicitly marked");
const service = read("lib/dailyBoardService.ts");
check(service.includes("scoreCounts[difficulty] === 0") && service.includes("publish_daily_trio_v16"), "Daily service does not replace only unscored modes atomically");
const cron = read("app/api/cron/daily/route.ts");
check(cron.includes("generateAndPublishDailyTrio") && cron.includes("status: 503"), "cron does not fail closed when generation fails");
const component = read("components/GeoSecondComingGame.tsx");
check(component.includes("dailyResultKey") && component.includes("Saved on this browser"), "anonymous result persistence missing");
check(component.includes("if (saved.fallback) clearCachedDaily(date)") && component.includes("if (cached?.fallback) clearCachedDaily(date)"), "fallback practice boards can remain stuck in the browser cache");
check(!component.includes("const list = await fetchCountries()"), "Daily startup still waits for the full country catalog before reading its self-contained board");
const css = read("app/v15-7-clean.css");
check(css.includes("grid-template-columns:repeat(5,minmax(0,1fr))") && css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), "two-row country bank or two-column category board missing");
check(css.includes("body:has(.shell.activePlay){overflow:hidden}"), "mobile active game can still page-scroll");
const semantics = read("lib/categorySemantics.ts");
check(semantics.includes("const conflict = firstStrategy === secondStrategy"), "text similarity still hard-blocks unrelated categories");
const engine = read("lib/puzzleEngine.ts");
check(engine.includes('rankingCompletenessStatus === "non_comprehensive"') && engine.includes("topValueFeasible === false"), "generator ignores ranking completeness");
const food = read("scripts/import-faostat-food-balances.py");
check(!food.includes(" consumed per person") && !food.includes(" supplied per person"), "Food Balance titles still imply directly measured consumption");
const pew = read("scripts/import-pew-religion.py");
check(pew.includes("Merge every usable 2020 country sheet") && pew.includes("_religious_diversity_from_shares"), "Pew split-sheet merge or diversity repair missing");
const expansion = read(".github/workflows/import-v16-expansion.yml");
check(!expansion.includes("UNESCO World Heritage total") && expansion.includes("finalize-v16-catalog.py"), "v16 expansion workflow still imports World Heritage or skips finalization");
const admin = read("app/api/admin/dashboard/route.ts");
check(admin.includes("category_runtime_review_v16") && admin.includes("data_integrity_overview_v16"), "admin dashboard still uses conflicting legacy views");
const workbench = read("app/api/admin/category-review/route.ts");
check(workbench.includes("category_review_workbench_v16") && workbench.includes("computed_playable_v16"), "workbench still uses v15 playability");
const bulkReview = read("app/api/admin/categories/review/route.ts");
check(bulkReview.includes("category_review_workbench_v16") && bulkReview.includes("refresh_v16_runtime_catalog") && !bulkReview.includes("evaluateCategoryPlayability"), "bulk review still uses conflicting legacy governance");
const allText = [];
const skip = new Set([".git", "node_modules", ".next"]);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (!entry.name.endsWith(".zip") && !entry.name.endsWith(".png")) {
      const buffer = fs.readFileSync(full);
      if (buffer.includes(0)) continue;
      allText.push([full, buffer.toString("utf8")]);
    }
  }
}
walk(root);
const legacyBranding = allText.filter(([, text]) => new RegExp("geo" + "hunter", "i").test(text));
check(legacyBranding.length === 0, `Legacy project-name references remain: ${legacyBranding.slice(0, 3).map(([f]) => path.relative(root, f)).join(", ")}`);
const cacheFiles = [];
function cacheWalk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name === "__pycache__") cacheFiles.push(full); else cacheWalk(full); }
    else if (entry.name.endsWith(".pyc")) cacheFiles.push(full);
  }
}
cacheWalk(root);
check(cacheFiles.length === 0, "Python cache files remain");
if (failures.length) {
  console.error("GeoStats v16 checks FAILED:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
console.log("GeoStats v16 static checks passed.");
