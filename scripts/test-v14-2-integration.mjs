import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/022_source_integrity_validation.sql");
const panel = read("components/CategorySourcePanel.tsx");
const warehouseRoute = read("app/api/warehouse-category/route.ts");
const catalog = read("lib/serverPlayableCatalog.ts") + read("lib/playableCatalog.ts");
const workflow = read(".github/workflows/audit-source-integrity.yml");
const importer = read("scripts/data_pipeline/base.py");
const validator = read("scripts/data_pipeline/integrity.py");
const faostat = read("scripts/import-faostat.py");
const admin = read("app/admin/AdminDashboard.tsx");

for (const token of [
  "stat_validation_runs", "stat_category_validation_results", "validation_status",
  "record_category_validation", "activate_source_integrity_enforcement",
  "data_integrity_by_source", "data_integrity_overview", "data_integrity_issues",
]) {
  if (!migration.includes(token)) throw new Error(`v14.2 migration missing ${token}`);
}
for (const token of ["source_checksum", "stored_checksum", "ranking_mismatch_count", "source_identity_checks", "competition_ranks"]) {
  if (!validator.includes(token)) throw new Error(`integrity validator missing ${token}`);
}
if (!importer.includes("validate_category_snapshot") || !importer.includes("record_category_validation")) {
  throw new Error("Generic importer framework does not validate official-source snapshots after storage.");
}
if (!faostat.includes("validate_faostat_categories") || !faostat.includes("domainCode") || !faostat.includes("bulk_download_url") || !faostat.includes("stat_validation_runs")) {
  throw new Error("FAOSTAT does not have source-specific end-to-end validation and source material metadata.");
}
if (!catalog.includes('.eq("validation_status", "verified")') || !catalog.includes('row.validation_status !== "verified"') || catalog.includes('return built.length ? built : CATEGORIES') || catalog.includes('.catch(() => CATEGORIES.filter')) {
  throw new Error("Playable catalog does not fail closed on source-integrity status.");
}
if (!warehouseRoute.includes("rankingComplete") || !warehouseRoute.includes("verified global ranking is incomplete")) {
  throw new Error("Warehouse route does not reject partial global ranking snapshots.");
}
for (const token of ["Global rankings", "Countries in this game", "View source material", "fullRankingLoaded", "downloadUrl"]) {
  if (!panel.includes(token)) throw new Error(`simplified source panel missing ${token}`);
}
for (const forbidden of ["Verifiability", "Why this category is usable", "Exact stored query parameters", "Dataset release"]) {
  if (panel.includes(forbidden)) throw new Error(`player source panel still exposes internal validation UI: ${forbidden}`);
}
if (!workflow.includes("audit-source-integrity.py") || !workflow.includes("import-faostat.py") || !workflow.includes("activate_enforcement")) {
  throw new Error("source integrity workflow is incomplete");
}
if (!admin.includes("Data integrity") || !admin.includes("Run full source audit")) {
  throw new Error("Admin does not expose integrity status and audit workflow.");
}
console.log("GeoStats v14.2 integration checks passed.");
