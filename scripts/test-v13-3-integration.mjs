import fs from "node:fs";

const categories = fs.readFileSync("lib/categories.ts", "utf8");
const dataSources = fs.readFileSync("lib/dataSources.ts", "utf8");
const sourceRegistry = fs.readFileSync("lib/sourceRegistry.ts", "utf8");
const quality = fs.readFileSync("lib/categoryQuality.ts", "utf8");
const route = fs.readFileSync("app/api/warehouse-category/route.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/013_comtrade_eia_unhcr.sql", "utf8");
const mainWorkflow = fs.readFileSync(".github/workflows/main.yml", "utf8");
const newWorkflow = fs.readFileSync(".github/workflows/import-trade-energy-refugees.yml", "utf8");

function importerKeys(filename, functionName) {
  const text = fs.readFileSync(filename, "utf8");
  return [...text.matchAll(new RegExp(`${functionName}\\(\\s*"([a-z0-9-]+)"`, "g"))].map((match) => match[1]);
}

const sources = [
  { slug: "comtrade", organization: "UN Comtrade", keys: importerKeys("scripts/import-comtrade.py", "trade_rule") },
  { slug: "eia", organization: "U.S. EIA", keys: importerKeys("scripts/import-eia.py", "eia_rule") },
  { slug: "unhcr", organization: "UNHCR", keys: importerKeys("scripts/import-unhcr.py", "unhcr_rule") },
];

for (const source of sources) {
  if (!source.keys.length) throw new Error(`No ${source.slug} importer rules were found.`);
  for (const key of source.keys) {
    const categoryId = `${source.slug}:${key}`;
    if (!categories.includes(`id: "${categoryId}"`)) throw new Error(`${categoryId} is missing from the playable category registry.`);
  }
  if (!categories.includes(`| "${source.slug}"`)) throw new Error(`${source.slug} is missing from DataSourceId.`);
  if (!dataSources.includes(`case "${source.slug}"`)) throw new Error(`${source.slug} is missing from fetchCategory.`);
  if (!sourceRegistry.includes(`${source.slug}: {`)) throw new Error(`${source.slug} is missing from SOURCE_REGISTRY.`);
  if (!migration.includes(`'${source.slug}'`)) throw new Error(`${source.slug} is missing from migration 013.`);
  if (!mainWorkflow.includes(`  ${source.slug}:`)) throw new Error(`${source.slug} is missing from the all-source workflow.`);
  if (!newWorkflow.includes(`  ${source.slug}:`)) throw new Error(`${source.slug} is missing from the three-source workflow.`);
  if (!migration.includes(`'${source.organization}'`)) throw new Error(`${source.organization} is missing from the migration.`);
}

if (!route.includes('review_status !== "approved"') || !route.includes("eligible_daily")) {
  throw new Error("The warehouse API does not enforce administrator approval and Daily eligibility.");
}
if (!quality.includes("coverage/floor") || quality.includes("Math.max(175")) {
  throw new Error("Runtime quality scoring is not normalized to each category's validated coverage floor.");
}
if (!categories.includes("...WAREHOUSE_CATEGORIES")) throw new Error("Warehouse categories are not included in CATEGORIES.");

console.log(`GeoStats v13.3 integration checks passed (${sources.reduce((sum, source) => sum + source.keys.length, 0)} new playable definitions).`);
