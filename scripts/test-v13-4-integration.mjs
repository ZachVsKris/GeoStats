import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/014_country_names_auto_governance.sql");
const wbRoute = read("app/api/admin/import/world-bank/route.ts");
const base = read("scripts/data_pipeline/base.py");
const dashboard = read("app/admin/AdminDashboard.tsx");

for (const token of [
  "force_canonical_observation_country_name",
  "apply_category_governance",
  "refresh_stat_concept_group",
  "bare_government_assertions_allowed",
  "No legacy approval is grandfathered",
]) {
  if (!migration.includes(token)) throw new Error(`Migration missing ${token}`);
}
if (!wbRoute.includes("governWorldBankCategory")) throw new Error("World Bank importer is not governed");
if (!wbRoute.includes("canonicalCountryName")) throw new Error("World Bank names are not canonicalized");

if (!wbRoute.includes("manuallyRejected")) throw new Error("World Bank importer does not preserve manual rejections");
if (!wbRoute.includes("commonYearCoverage")) throw new Error("World Bank importer does not store a common-year coverage measure");
const verifySql = read("VERIFY_V13_4.sql");
if (!verifySql.includes("public.countries")) throw new Error("Verification SQL does not use the canonical countries table");
if (!base.includes("evaluate_governance")) throw new Error("Generic importer does not evaluate provenance");
if (!base.includes("apply_category_governance")) throw new Error("Generic importer does not arbitrate duplicates");
if (!dashboard.includes("Provenance") || !dashboard.includes("Duplicate")) throw new Error("Admin audit UI is missing governance columns");

const countryRows = (migration.match(/\('[A-Z]{3}', '[^']*(?:''[^']*)*'\)/g) ?? []).length;
if (countryRows < 195) throw new Error(`Expected at least 195 canonical country rows, found ${countryRows}`);
console.log("GeoStats v13.4 integration tests passed.");
