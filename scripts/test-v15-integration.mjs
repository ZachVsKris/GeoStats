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
if (packageJson.version !== "15.0.0") throw new Error("package.json is not version 15.0.0");

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

console.log("GeoStats v15 category-review integration checks passed.");
