import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const required = [
  "RUN_THIS_IN_SUPABASE_FOR_V15_5.sql",
  "supabase/migrations/030_v15_5_catalog_simplification_and_expansion.sql",
  "scripts/review-catalog-similarity-v15-5.py",
  "scripts/import-pew-religion.py",
  "scripts/import-smithsonian-volcanoes.py",
  "scripts/import-usgs-earthquakes.py",
  "scripts/import-physical-summaries.py",
  "scripts/physical-summary-schema.csv",
  "VERIFY_V15_5.sql",
  "ROLLBACK_V15_5.sql",
  "RELEASE_NOTES_V15_5.md",
  "V15_5_AUDIT_REPORT.md",
];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Missing v15.5 file: ${relative}`);
}

const version = read("lib/version.ts");
for (const marker of ['APP_VERSION = "15.5.0"', 'RULES_VERSION = "12.0"']) {
  if (!version.includes(marker)) throw new Error(`Missing v15.5 version marker: ${marker}`);
}

const sql = read("RUN_THIS_IN_SUPABASE_FOR_V15_5.sql");
if (sql !== read("supabase/migrations/030_v15_5_catalog_simplification_and_expansion.sql")) {
  throw new Error("The v15.5 root installer and migration copy differ.");
}
for (const marker of [
  "category_catalog_editorial_v15_5",
  "category_similarity_pairs_v15_5",
  "apply_category_catalog_editorial_v15_5",
  "v15.5 automated comprehensibility screen",
  "v15.5 preferred-representative policy",
  "total reserves excluding monetary gold",
  "religious-composition",
  "terrain-elevation",
  "category_normalization_policy_v15_5",
  "v15.5 production-only agriculture policy",
  "gross-production-value-to-gdp",
  "product-production-value-share-ag-output",
  "coalesce(challenge.rules_version,'')<>'12.0'",
]) {
  if (!sql.includes(marker)) throw new Error(`v15.5 SQL is missing: ${marker}`);
}
if (sql.includes("player_quality_status='review'") || sql.includes("then 'review'\n      when editorial.editorial_outcome in")) {
  throw new Error("v15.5 SQL uses a player_quality_status value that violates the database constraint.");
}

const semantics = read("lib/categorySemantics.ts");
for (const marker of ["pewreligion", "smithsoniangvp", "worldcover", "hydrosheds", "terrain-elevation", "religious-composition"]) {
  if (!semantics.includes(marker)) throw new Error(`v15.5 semantics are missing ${marker}`);
}

const trio = read("lib/dailyTrioRules.ts");
for (const marker of ["MAX_TRIO_RELIGION_CATEGORIES = 2", "isReligionCategory", "MAX_TRIO_DISPLACEMENT_CATEGORIES = 2"]) {
  if (!trio.includes(marker)) throw new Error(`v15.5 trio rule missing: ${marker}`);
}

const playable = read("lib/playableCatalog.ts");
if (!playable.includes("Math.max(1900")) throw new Error("Reference-year sources older than 2022 are still forcibly excluded.");
const cache = read("lib/serverPlayableCatalog.ts");
if (!cache.includes("v15.5.0")) throw new Error("Server catalog cache was not version-bumped.");

const sourceSpec = read("lib/sourceSpecification.ts");
for (const marker of ["religiousGroup", "minimumMagnitude", "landCoverClass", "inclusionThreshold", "Global elevation grid"]) {
  if (!sourceSpec.includes(marker)) throw new Error(`Source specifications are missing ${marker}`);
}

const faostatImporter = read("scripts/import-faostat.py");
for (const marker of ["ALLOWED_PRODUCTION_ELEMENTS", "total-production-only", "Most {item_clean} produced"]) {
  if (!faostatImporter.includes(marker)) throw new Error(`FAOSTAT production-only policy is missing ${marker}`);
}
for (const forbidden of ['return f"Highest {item_clean} yield"', 'ALLOWED_ELEMENT_PATTERNS']) {
  if (faostatImporter.includes(forbidden)) throw new Error(`FAOSTAT importer still activates a retired measure: ${forbidden}`);
}

const categories = read("lib/categories.ts");
for (const forbidden of ["kg/hectare", "kg/animal", "Highest cereal yield", ":5412\""]) {
  if (categories.includes(forbidden)) throw new Error(`Static catalog still contains retired agricultural efficiency content: ${forbidden}`);
}

console.log("GeoStats v15.5 catalog simplification, expansion, and production-only agriculture checks passed.");
