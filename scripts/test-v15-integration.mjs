import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "RUN_THIS_IN_SUPABASE_FOR_V15.sql",
  "VERIFY_V15.sql",
  "app/admin/review/page.tsx",
  "app/admin/review/CategoryReviewWorkbench.tsx",
  "app/api/admin/category-review/route.ts",
  "app/api/admin/category-review/[id]/route.ts",
  "supabase/migrations/026_category_review_workbench.sql",
  "lib/serverPlayableCatalog.ts",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing v15 file: ${file}`);
}
if (fs.existsSync(path.join(root, "middleware.ts"))) throw new Error("middleware.ts must be removed; Next.js 16 uses proxy.ts.");

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.version !== "15.1.0") throw new Error("package.json is not version 15.1.0");

const sql = fs.readFileSync(path.join(root, "RUN_THIS_IN_SUPABASE_FOR_V15.sql"), "utf8");
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
if (!serverCatalog.includes('.eq("computed_playable_v15", true)')) throw new Error("Runtime catalog does not enforce the v15 playability decision.");

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

const engine = fs.readFileSync(path.join(root, "lib/puzzleEngine.ts"), "utf8");
if (!engine.includes("generationProfile")) throw new Error("Server generation diagnostics must report the selected profile.");
const profiles = fs.readFileSync(path.join(root, "lib/generationProfiles.ts"), "utf8");
for (const marker of ["catalog-balanced", "catalog-recovery", "sourceCapacityForProfile"]) {
  if (!profiles.includes(marker)) throw new Error(`Adaptive Daily generation is missing ${marker}`);
}
const game = fs.readFileSync(path.join(root, "components/GeoSecondComingGame.tsx"), "utf8");
if (!game.includes("generationProfiles()")) throw new Error("Client Daily fallback does not use adaptive generation profiles.");

console.log("GeoStats v15.1.0 category-review and Daily-generation checks passed.");

for (const required of [
  "app/admin/review/page.tsx",
  "app/admin/review/CategoryReviewWorkbench.tsx",
  "RUN_THIS_IN_SUPABASE_FOR_V15_1.sql",
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
