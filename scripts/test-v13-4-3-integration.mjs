import fs from "node:fs";
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/017_complete_catalog_curation.sql");
const version = read("lib/version.ts");
const categories = read("lib/categories.ts");

if (!migration.includes("geostats-v13.4.3-complete-catalog-v1")) throw new Error("Missing v13.4.3 curation version");
if (!migration.includes("reviewed_category_count',726")) throw new Error("Missing reviewed count");
if (!migration.includes("curated_approved_rule_count',252")) throw new Error("Missing approved count");
if (!migration.includes("curated_excluded_rule_count',474")) throw new Error("Missing excluded count");
if (!migration.includes("category_id in ('',category_row.id)")) throw new Error("Category-specific curation lookup missing");
if (migration.includes("from public.stat_categories category\n  from public.stat_categories category")) throw new Error("Duplicate FROM regression");
if (!version.includes('APP_VERSION = "13.4.3"')) throw new Error("Version not updated");
if (!categories.includes('warehouseSourceIndicatorCode: "most-land-neighbors"')) throw new Error("Land-neighbor category missing");
console.log("v13.4.3 integration checks passed");
