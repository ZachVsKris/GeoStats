const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
const migration = read("supabase/migrations/20260901210914_v16_3_2_catalog_reconciliation_and_mobile_release.sql");
const game = read("components/GeoSecondComingGame.tsx");
const css = read("app/v15-7-clean.css") + read("app/globals.css");
const workflow = read(".github/workflows/verify-v16.yml");

check(pkg.version === "16.3.2", "package version is not v16.3.2");
check(pkg.scripts.test === "npm run test-v16-3-2" && pkg.scripts.check === "npm run check-v16-3-2", "default validation does not target v16.3.2");
for (const token of ['APP_VERSION = "16.3.2"','RULES_VERSION = "16.3.2"','EXPERT-8X6-V16-3-2','PLAYABLE_CATALOG_CACHE_VERSION = "16.3.2.318.1"']) {
  check(version.includes(token), `v16.3.2 version contract missing ${token}`);
}
for (const token of [
  "category_catalog_reconciliation_v16_3_2","apply_v16_3_2_catalog_reconciliation",
  "expected 84 approved-but-blocked reconciliation rows","expected 12 restored categories",
  "expected 72 independently blocked approved categories","expected one 318-category SQL/runtime catalog",
  "natural-earth:largest-mapped-lake-area","natural-earth:largest-mapped-glaciated-area",
  "smithsonian-gvp:most-holocene-volcanoes","unhcr:most-refugees-hosted"
]) check(migration.includes(token), `catalog reconciliation migration missing ${token}`);
check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.3.2 migration is not transaction wrapped");
check(game.includes('className="removePiece"') && game.includes('<svg viewBox="0 0 16 16"'), "assigned-country removal is not a centered SVG control");
check(game.includes('role="button"') && game.includes('onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" ")'), "category slots lost keyboard accessibility after adding the remove button");
for (const token of [
  "GeoStats v16.3.2: phone results fit the viewport","grid-template-areas:\"main main\" \"placement action\"",
  "grid-template-areas:\"board country world\" \". value value\" \". reference points\"",
  ".leaderboard>div.leaderboardColumns{display:none}",".mobileColumnLabel{display:inline"
]) check(css.includes(token), `mobile result layout missing ${token}`);
check(workflow.includes("Verify GeoStats v16.3.2") && workflow.includes("npm run test-v16-3-2"), "CI does not verify v16.3.2");

if (failures.length) {
  console.error(`GeoStats v16.3.2 checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.3.2 checks passed.");
