import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const packageJson = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
const trust = read("lib/categoryTrust.ts");
const rules = read("lib/gameRules.ts");
const component = read("components/GeoSecondComingGame.tsx");
const leaderboard = read("app/api/leaderboard/route.ts");
const leaderboardView = read("components/LeaderboardView.tsx");
const profile = read("app/api/profile/route.ts");
const migration = read("supabase/migrations/019_trust_sources_auth_leaderboard.sql");
const topLevelSql = read("RUN_THIS_IN_SUPABASE_FOR_V13_5.sql");
const metadataRoute = read("app/api/category-metadata/route.ts");
const dataEngine = read("lib/dataEngine.ts");
const authSetup = read("AUTH_BRANDING_SETUP_V13_5.md");
const authCallback = read("app/auth/callback/route.ts");
const playableCatalog = read("lib/playableCatalog.ts");
const playableCatalogRoute = read("app/api/playable-categories/route.ts");
const challengeCodec = read("lib/challengeCodec.ts");

const [major, minor] = packageJson.version.split(".").map(Number);
assert.ok(major > 13 || (major === 13 && minor >= 5), "App version must retain v13.5+ behavior");
assert.match(version, /APP_VERSION = "\d+\.\d+\.\d+"/);
assert.equal(migration, topLevelSql, "Top-level v13.5 SQL must match migration 019");

assert.match(trust, /IT\.NET\.USER\.ZS/);
assert.match(trust, /Independent Scopus\/NSF bibliometric count/);
assert.match(trust, /natural-earth:coastline/);
assert.match(trust, /credibilityScore/);
assert.match(migration, /apply_category_credibility/);
assert.match(migration, /Internet-use estimates combine surveys/);
assert.match(migration, /IP\.JRN\.ARTC\.SC/);
assert.match(migration, /Coastline length changes materially with map resolution/);
assert.match(migration, /credibility_score,0\)>=75/);


assert.match(playableCatalog, /buildPlayableCategoryCatalog/);
assert.match(playableCatalog, /warehouseBacked: true/);
assert.match(playableCatalog, /credibility_status === "quarantined"/);
assert.match(playableCatalogRoute, /loadServerPlayableCategoryCatalog/);
assert.match(component, /fetchPlayableCategoryCatalog/);
assert.match(challengeCodec, /categoryCatalog: Category\[\] = CATEGORIES/);

assert.match(rules, /randomPath: "\/random/);
assert.match(rules, /maxSameSource/);
assert.match(rules, /maxAgricultureCategories/);
assert.match(rules, /faostat-item-/);
assert.match(component, /Random Test · Unranked/);
assert.match(component, /normalizeRandomSeed/);
assert.match(component, /loadRandomRound/);
for (const path of ["app/random/page.tsx", "app/random/easy/page.tsx", "app/random/expert/page.tsx"]) {
  assert.equal(fs.existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} missing`);
}

assert.match(leaderboard, /Board-relative Bayesian rating/);
assert.match(leaderboard, /dayPriorGames = 8/);
assert.match(leaderboard, /confidenceGames = 20/);
assert.match(leaderboard, /row\.challenge_date/);
assert.match(leaderboardView, /Board-adjusted rating/);
assert.match(leaderboardView, /normalizedPerformance/);

assert.match(metadataRoute, /source_url/);
assert.match(metadataRoute, /methodology_url/);
assert.match(metadataRoute, /Resolve any misses by the source organization/);
assert.match(dataEngine, /categoryMethodologyUrl/);
assert.match(component, /Data & Source/);
assert.match(component, /CategorySourcePanel/);

assert.match(profile, /username_customized/);
assert.match(profile, /case-insensitively/);
assert.match(migration, /profiles_username_lower_unique_idx/);
assert.match(migration, /username_customized boolean/);
assert.match(authSetup, /Sender name: `GeoStats`/);
for (const template of ["magic-link.html", "confirmation.html", "recovery.html"]) {
  const text = read(`supabase/email-templates/${template}`);
  assert.match(text, /GeoStats/);
  assert.match(text, /\{\{ \.SiteURL \}\}\/auth\/callback/);
  assert.match(text, /\{\{ \.TokenHash \}\}/);
  assert.doesNotMatch(text, /ConfirmationURL/);
}
assert.match(authCallback, /verifyOtp/);
assert.match(authCallback, /redirect_to/);
assert.match(authSetup, /clickable authentication URL is on `geostats\.xyz`/);

console.log("v13.5 integration checks passed");
