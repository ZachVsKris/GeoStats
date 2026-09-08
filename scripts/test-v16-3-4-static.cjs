const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
const semantics = read("lib/categorySemantics.ts");
const migration = read("supabase/migrations/20260907190839_v16_3_4_catalog_release_guard.sql");
const linkRecovery = read("supabase/migrations/20260907191017_v16_3_4_restore_power_emissions_link.sql");
const workflow = read(".github/workflows/verify-v16.yml");

check(pkg.version === "16.3.4", "package version is not v16.3.4");
check(pkg.scripts.test === "npm run test-v16-3-4" && pkg.scripts.check === "npm run check-v16-3-4", "default validation does not target v16.3.4");
for (const token of [
  'APP_VERSION = "16.3.4"',
  'RULES_VERSION = "16.3.4"',
  'EXPERT-8X6-V16-3-4',
  'PLAYABLE_CATALOG_CACHE_VERSION = "16.3.4.9"',
]) check(version.includes(token), `v16.3.4 version contract missing ${token}`);
check(semantics.includes('cluster === "physical-waterways"') && semantics.includes('return "physical-lakes"'), "lake measures are not protected as one semantic concept");
for (const token of [
  'category_v16_3_4_should_publish',
  'enforce_category_runtime_flags_v16_3_4',
  'trg_enforce_category_runtime_flags_v16_3_4',
  'assert_v16_3_4_runtime_catalog',
  'category_catalog_release_audit_v16_3_4',
  "geostats-v16.3.4-runtime-catalog",
  'safe but hidden categories',
  'unsafe published categories',
  'expected at least 317 release-ready categories',
  'natural-earth:largest-mapped-lake-area',
  'pew-religion:jewish-population',
]) check(migration.includes(token), `catalog release guard missing ${token}`);
check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.3.4 migration is not transaction wrapped");
for (const token of [
  'EN.GHG.CO2.PI.MT.CE.AR5',
  "player_source_status='exact'",
  'expected 318 release-ready categories after official-link recovery',
]) check(linkRecovery.includes(token), `power-emissions recovery missing ${token}`);
check(/^begin;/m.test(linkRecovery) && /commit;\s*$/.test(linkRecovery), "power-emissions recovery is not transaction wrapped");
check(workflow.includes("Verify GeoStats v16.3.4") && workflow.includes("npm run test-v16-3-4"), "CI does not verify v16.3.4");

if (failures.length) {
  console.error(`GeoStats v16.3.4 checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.3.4 checks passed.");
