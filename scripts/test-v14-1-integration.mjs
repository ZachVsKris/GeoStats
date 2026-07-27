import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const packageJson = JSON.parse(read("../package.json"));
const version = read("../lib/version.ts");
const rules = read("../lib/gameRules.ts");
const continents = read("../lib/continents.ts");
const worldBank = read("../lib/worldBank.ts");
const dataEngine = read("../lib/dataEngine.ts");
const puzzle = read("../lib/puzzleEngine.ts");
const game = read("../components/GeoSecondComingGame.tsx");
const sourcePanel = read("../components/CategorySourcePanel.tsx");
const analytics = read("../lib/analytics.ts");
const analyticsRoute = read("../app/api/analytics/events/route.ts");
const adminRoute = read("../app/api/admin/dashboard/route.ts");
const admin = read("../app/admin/AdminDashboard.tsx");
const migration = read("../supabase/migrations/021_analytics_generation_health.sql");
const comtrade = read("../scripts/import-comtrade.py");
const http = read("../scripts/data_pipeline/http.py");
const workflow = read("../.github/workflows/repair-v14-expansion.yml");
const mainWorkflow = read("../.github/workflows/main.yml");
const comtradeWorkflow = read("../.github/workflows/import-comtrade.yml");

assert.ok(["14.1.0", "14.2.0"].includes(packageJson.version));
assert.match(version, /APP_VERSION = "14\.[12]\.0"/);
assert.match(version, /RULES_VERSION = "7\.0"/);

assert.match(rules, /maxFaostatCategories: 1/);
assert.match(rules, /maxFaostatCategories: 2/g);
assert.match(rules, /maxCountriesPerContinent: 2/);
assert.match(rules, /maxCountriesPerContinent: 3/g);
assert.match(rules, /Math\.min\(50, Math\.ceil\(Math\.max\(1, coverage\) \/ 2\)\)/);
assert.match(rules, /roundHasCountryDiversity/);
assert.match(continents, /continentForIso3/);
assert.match(worldBank, /SP\.POP\.TOTL/);
assert.match(worldBank, /continent:/);
assert.match(dataEngine, /strongestGlobalWinnerRank/);
assert.match(dataEngine, /roundHasCountryDiversity/);
assert.match(puzzle, /loadServerPlayableCategoryCatalog/);
assert.match(puzzle, /familiarity/);
assert.match(puzzle, /\.05\*familiarity/);
assert.doesNotMatch(puzzle, /must include|recognition quota/i);

assert.match(sourcePanel, /Data & Source/);
assert.match(sourcePanel, /Global rankings/);
assert.match(sourcePanel, /Look up a country/);
assert.match(sourcePanel, /View source material/);
for (const removed of ["Verifiability", "Why this category is usable", "Exact stored query parameters", "Technical definition", "License ↗"]) {
  assert.doesNotMatch(sourcePanel, new RegExp(removed));
}
assert.match(game, /boardCountryIds/);
assert.match(game, /trackAnalytics\("game_started"/);
assert.match(game, /trackAnalytics\("game_completed"/);
assert.match(game, /trackAnalytics\("share_clicked"/);
assert.match(game, /trackAnalytics\("source_opened"/);

assert.match(analytics, /geostats-analytics-session/);
assert.match(analyticsRoute, /analytics_events/);
assert.match(migration, /create table if not exists public\.analytics_events/);
assert.match(migration, /create table if not exists public\.daily_generation_runs/);
assert.match(adminRoute, /analytics_overview_30d/);
assert.match(adminRoute, /username_customized/);
assert.match(admin, /Last 30 days/);
assert.match(admin, /Warehouse health by source/);
assert.match(admin, /Recent generator runs/);

assert.match(http, /error\.code == 429/);
assert.match(http, /Retry-After/);
assert.match(comtrade, /ComtradeQuotaExhausted/);
assert.match(comtrade, /Resume mode/);
assert.match(comtrade, /--refresh-existing/);
assert.match(comtrade, /Partial success/);
assert.match(workflow, /import-comtrade\.py --minimum-successes 0/);
assert.match(workflow, /--comtrade-target-total 55/);
assert.match(mainWorkflow, /import-comtrade\.py --minimum-successes 0/);
assert.match(comtradeWorkflow, /import-comtrade\.py --minimum-successes 0/);

console.log("v14.1 smart generation, simplified source UI, resilient imports, and analytics checks passed");
