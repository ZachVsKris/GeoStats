const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
const catalog = read("lib/playableCatalog.ts");
const publicPresentation = read("lib/publicCatalogPresentation.ts");
const auditPage = read("app/audit/page.tsx");
const dataPage = read("app/data/page.tsx");
const game = read("components/GeoSecondComingGame.tsx");
const css = read("app/globals.css");
const migration = read("supabase/migrations/20260901203000_v16_3_1_catalog_integrity_and_editorial_audit.sql");
const iconFollowup = read("supabase/migrations/20260901204500_v16_3_1_semantic_icon_followup.sql");
const reachabilityFollowup = read("supabase/migrations/20260901205500_v16_3_1_restore_reachability_exclusions.sql");
const greenhouseIconFollowup = read("supabase/migrations/20260901210500_v16_3_1_greenhouse_icon_precedence.sql");

check(pkg.version === "16.3.1", "package version is not v16.3.1");
check(pkg.scripts.test === "npm run test-v16-3-1" && pkg.scripts.check === "npm run check-v16-3-1", "default validation does not target v16.3.1");
for (const token of ['APP_VERSION = "16.3.1"','RULES_VERSION = "16.3.1"','EXPERT-8X6-V16-3-1','PLAYABLE_CATALOG_CACHE_VERSION = "16.3.1.306.2"']) {
  check(version.includes(token), `v16.3.1 version contract missing ${token}`);
}
for (const token of ['"worldbank-catalog:bx-gsr-ccis-cd"','ownerRetiredServiceTrade','GSR\\.MRCH','Catalog contract drift','Most apricots produced','Highest % of population that is male']) {
  check(catalog.includes(token), `runtime catalog guard missing ${token}`);
}
check(catalog.includes('if (/arms imports?/.test(copy)) return "🪖"'), "arms-import icon is not semantically corrected");
check(catalog.indexOf('if (/pineapple|papaya/.test(copy))') < catalog.indexOf('if (/apple/.test(copy))'), "pineapple is still caught by the apple icon rule");
check(catalog.indexOf('if (/eggplant/.test(copy))') < catalog.indexOf('if (/egg/.test(copy))'), "eggplant is still caught by the egg icon rule");
check(catalog.indexOf('if (/orange|mandarin|tangerine|grapefruit|pomelo/.test(copy))') < catalog.indexOf('if (/grapes?/.test(copy))'), "grapefruit is still caught by the grape icon rule");
check(catalog.indexOf('if (/greenhouse|methane|co2|carbon dioxide|carbon intensity/.test(copy))') < catalog.indexOf('if (/forest/.test(copy))'), "greenhouse emissions are still caught by the forest icon rule");
check(publicPresentation.includes("!approvedById.has(category.id)"), "public audit can still overwrite approved categories with bundled quarantines");
check(auditPage.includes("publicCatalogPresentation(approved, CATEGORIES)"), "Audit page does not use the shared catalog presentation");
check(dataPage.includes("publicCatalogPresentation(categories,CATEGORIES).blocked"), "Data page blocked count does not use the shared catalog presentation");
check(game.includes('return "theme-consumption"') && game.includes('["theme-consumption", "Consumption"]'), "consumption taxonomy is missing from the color key");
check(css.includes(".theme-consumption"), "consumption theme color is missing");
for (const token of [
  "apply_v16_3_1_catalog_integrity","v16.3.1 durable owner-directed services-import/export exclusion",
  "expected one 306-category SQL/runtime catalog","source_organization='FAOSTAT Food Balances'",
  "worldbank-catalog:ag-srf-totl-k2","worldbank-catalog:ms-mil-mprt-kd","semantic icon audit"
]) check(migration.includes(token), `catalog-integrity migration missing ${token}`);
check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.3.1 migration is not transaction wrapped");
for (const token of ["substring-collision icon repair","faostat-qcl-pineapples-production-01318-5510-t","worldbank-catalog:en-urb-mcty-tl-zs","generic grain icon overused"]) check(iconFollowup.includes(token), `semantic icon follow-up missing ${token}`);
check(/^begin;/m.test(iconFollowup) && /commit;\s*$/.test(iconFollowup), "v16.3.1 semantic icon follow-up is not transaction wrapped");
for (const token of ["restored production-solver reachability exclusion","pew-religion:jewish-share","worldbankclimate:wettest","one 306-category catalog"]) check(reachabilityFollowup.includes(token), `reachability-exclusion follow-up missing ${token}`);
check(/^begin;/m.test(reachabilityFollowup) && /commit;\s*$/.test(reachabilityFollowup), "v16.3.1 reachability follow-up is not transaction wrapped");
for (const token of ["greenhouse icon precedence review","en-ghg-all-pc-ce-ar5","icon<>'🌫️'"]) check(greenhouseIconFollowup.includes(token), `greenhouse icon follow-up missing ${token}`);
check(/^begin;/m.test(greenhouseIconFollowup) && /commit;\s*$/.test(greenhouseIconFollowup), "v16.3.1 greenhouse icon follow-up is not transaction wrapped");

if (failures.length) {
  console.error(`GeoStats v16.3.1 checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.3.1 checks passed.");
