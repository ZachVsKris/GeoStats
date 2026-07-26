import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const importer = read("scripts/import-faostat.py");
const migration = read("supabase/migrations/015_faostat_adaptive_governance.sql");
const verify = read("VERIFY_V13_4_1.sql");
const workflow = read(".github/workflows/import-faostat.yml");
const version = read("lib/version.ts");

for (const token of [
  "MIN_PLAYABLE_COVERAGE = 60",
  "QUALITY_SCORE_THRESHOLD = 75",
  "MIN_DOCUMENTED_SHARE = 0.75",
  "documented_share = min(1.0, official_share + modeled_share)",
  "faostat_concept_group",
  "stability_comparison_year",
  "maximumModeledShare\": None",
]) {
  if (!importer.includes(token)) throw new Error(`FAOSTAT importer missing ${token}`);
}
for (const token of [
  "geostats-v13.4.1-faostat-adaptive",
  "coverage>=60",
  "documented_share>=0.75",
  "cerealProduction",
  "refresh_stat_concept_group",
  "documented_estimates_allowed",
]) {
  if (!migration.includes(token)) throw new Error(`v13.4.1 migration missing ${token}`);
}
if (!verify.includes("enabled_without_documented_evidence")) throw new Error("Verification SQL is missing provenance validation");
if (!verify.includes("enabled_not_preferred")) throw new Error("Verification SQL is missing duplicate validation");
if (!workflow.includes("Test adaptive FAOSTAT importer logic")) throw new Error("FAOSTAT workflow still describes the old strict gate");
if (!version.includes('APP_VERSION = "13.4.1"')) throw new Error("App version was not updated");
console.log("GeoStats v13.4.1 integration tests passed.");
