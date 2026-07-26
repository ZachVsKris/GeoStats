import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const version = read("../lib/version.ts");
const sourcePanel = read("../components/CategorySourcePanel.tsx");
const game = read("../components/GeoSecondComingGame.tsx");
const css = read("../app/globals.css");
const playable = read("../lib/playableCatalog.ts");
const serverCatalog = read("../lib/serverPlayableCatalog.ts");
const warehouseRoute = read("../app/api/warehouse-category/route.ts");
const metadataRoute = read("../app/api/category-metadata/route.ts");
const admin = read("../app/admin/AdminDashboard.tsx");
const reviewRoute = read("../app/api/admin/categories/review/route.ts");
const workflow = read("../.github/workflows/main.yml");
const packageJson = JSON.parse(read("../package.json"));

assert.match(version, /APP_VERSION = "14\.0\.2"/);
assert.equal(packageJson.version, "14.0.2");
assert.match(sourcePanel, /Source & all data/);
assert.match(sourcePanel, /All available country values/);
assert.match(sourcePanel, /exact country snapshot GeoStats used/);
assert.match(sourcePanel, /Open exact query/);
assert.match(sourcePanel, /Download source data/);
assert.match(sourcePanel, /How GeoStats calculated it/);
assert.match(game, /CategorySourcePanel/);
assert.match(game, /setSourceDataset/);
assert.match(game, /<small>{dataset\.category\.description}<\/small>/);
assert.match(css, /sourceDataTable/);
assert.match(css, /-webkit-line-clamp:2!important/);

for (const file of [playable, serverCatalog, warehouseRoute, reviewRoute]) {
  assert.match(file, /verifiability_score|verifiabilityScore/);
  assert.match(file, /understandability_score|understandabilityScore/);
  assert.match(file, /fun_score|funScore/);
  assert.match(file, /objective_status|objectiveStatus/);
}
assert.match(serverCatalog, /\.eq\("objective_status", "objective"\)/);
assert.match(serverCatalog, /\.gte\("verifiability_score", 80\)/);
assert.match(warehouseRoute, /observations/);
assert.match(warehouseRoute, /exactQueryUrl/);
assert.match(warehouseRoute, /derivationMethod/);
assert.match(metadataRoute, /plain_language_description/);
assert.match(admin, /Player quality/);
assert.match(admin, /Approve strict-pass/);
assert.match(reviewRoute, /v14 editorial review queue/);
assert.match(workflow, /world-bank-catalog:/);
assert.match(workflow, /import-world-bank-catalog\.py --target-successes 500 --scan-limit 2000 --minimum-successes 100/);
assert.match(workflow, /natural-earth:/);
assert.match(workflow, /comtrade:/);

console.log("v14 runtime, source-viewer, admin, and workflow integration checks passed");
