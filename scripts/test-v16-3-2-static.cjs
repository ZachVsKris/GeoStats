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
const accounts = read("components/AccountControls.tsx");
const css = read("app/v15-7-clean.css") + read("app/globals.css");
const workflow = read(".github/workflows/verify-v16.yml");

check(["16.3.2","16.3.4"].includes(pkg.version), "package version no longer includes the v16.3.2 contract");
check(typeof pkg.scripts["test-v16-3-2"] === "string" && typeof pkg.scripts["check-v16-3-2"] === "string", "v16.3.2 regression checks are no longer runnable");
for (const token of ['EXPERT-8X6-','PLAYABLE_CATALOG_CACHE_VERSION = "16.3.']) {
  check(version.includes(token), `v16.3.2 compatibility contract missing ${token}`);
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
for (const token of ["shouldCreateUser: true", "GeoStats sent your secure sign-in link", "opening the link creates your free account"]) {
  check(accounts.includes(token), `signup conversion hardening missing ${token}`);
}
check(!accounts.includes('prompt: "select_account"'), "Google sign-in still forces returning users through an unnecessary account picker");
for (const token of [
  "GeoStats v16.3.2: phone results fit the viewport","grid-template-areas:\"main main\" \"placement action\"",
  "grid-template-areas:\"board country world\" \". value value\" \". reference points\"",
  ".leaderboard>div.leaderboardColumns{display:none}",".mobileColumnLabel{display:inline"
]) check(css.includes(token), `mobile result layout missing ${token}`);
check(workflow.includes("Verify GeoStats v16.3.") && workflow.includes("npm run test-v16-3-"), "CI does not verify the current v16.3 release");

if (failures.length) {
  console.error(`GeoStats v16.3.2 checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.3.2 checks passed.");
