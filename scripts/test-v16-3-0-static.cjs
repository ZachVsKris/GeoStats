const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
const importer = read("scripts/import-koppen-geiger.py");
const migration = read("supabase/migrations/20260901043106_v16_3_0_category_clarity_taxonomy.sql");
const copyFollowup = read("supabase/migrations/20260901050000_v16_3_0_catalog_copy_followup.sql");
const terminology = read("supabase/migrations/20260901052000_v16_3_0_terminology_definitions.sql");
const rating = read("lib/leaderboardRating.ts");
const ratingApi = read("app/api/leaderboard/route.ts");
const accounts = read("components/AccountControls.tsx");
const layout = read("app/layout.tsx");
const semantics = read("lib/categorySemantics.ts");
const proxy = read("proxy.ts");
const playableCatalog = read("lib/playableCatalog.ts");
const serverPlayableCatalog = read("lib/serverPlayableCatalog.ts");

check(pkg.version === "16.3.0", "package version is not v16.3.0");
check(pkg.scripts.test === "npm run test-v16-3-0" && pkg.scripts.check === "npm run check-v16-3-0", "default validation does not target v16.3.0");
for (const token of ['APP_VERSION = "16.3.0"', 'RULES_VERSION = "16.3.0"', 'LEADERBOARD_RATING_VERSION = "hybrid-absolute-peer-bayesian-v2"']) check(version.includes(token), `v16.3.0 version contract missing ${token}`);
for (const token of ["0°C", "18°C", "60 mm", "100 minus annual rainfall divided by 25", "CLIMATE_TECHNICAL_DEFINITIONS"]) check(importer.includes(token), `climate definition contract missing ${token}`);
for (const token of ["taxonomyVersion", "category_macro_domain_v16_2_7", "tropical-savanna-share", "temperate-share", "enable row level security"]) check(migration.includes(token), `clarity/taxonomy migration missing ${token}`);
check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.3.0 migration is not transaction wrapped");
for (const token of ["Highest % of land covered by glaciers", "computed_playable_v16_2", "board_description_too_long", "category_copy_clarity_v16_2_8", "security_invoker=true"]) check(copyFollowup.includes(token), `catalog follow-up missing ${token}`);
check(/^begin;/m.test(copyFollowup) && /commit;\s*$/.test(copyFollowup), "v16.3.0 copy follow-up is not transaction wrapped");
for (const token of ["this is what GDP measures", "this is what “arable” means", "this is what biomass and waste means", "life expectancy estimates"]) check(terminology.includes(token), `terminology audit missing ${token}`);
for (const token of ["LEADERBOARD_CONFIDENCE_GAMES = 10", "PEER_BLEND_START_PLAYERS = 5", "PEER_BLEND_FULL_PLAYERS = 20", "hybridDailyPerformance", "bayesianLeaderboardRating"]) check(rating.includes(token), `rating v2 contract missing ${token}`);
check(ratingApi.includes("ratingSortValue") && ratingApi.includes("hybridDailyPerformance") && ratingApi.includes("LEADERBOARD_MINIMUM_GAMES"), "leaderboard API does not use full-precision hybrid rating");
check(ratingApi.includes("usesCurrentScoreScale(row.rules_version)"), "leaderboard score normalization does not use the tested version boundary");
check(accounts.includes("keepFocusInside") && accounts.includes('role="status"') && accounts.includes("Google sign-in is temporarily unavailable") && accounts.includes('/auth/v1/settings'), "account modal resilience/accessibility/provider guard is incomplete");
for (const file of ["app/not-found.tsx", "app/error.tsx", "app/global-error.tsx", "app/loading.tsx", "app/icon.svg", "app/manifest.ts", "app/opengraph-image.tsx"]) check(fs.existsSync(path.join(root, file)), `missing production polish file ${file}`);
check(layout.includes("metadataBase") && layout.includes("openGraph") && layout.includes("twitter"), "root social metadata is incomplete");
for (const token of ["conomy", "economy", "nvironment", "environment"]) check(semantics.includes(token), `runtime malformed-domain repair missing ${token}`);
for (const token of ["HARD_CONFLICT_KNOWLEDGE_CLUSTERS", "climate-classification", "physical-ice"]) check(semantics.includes(token), `same-day concept collision rule missing ${token}`);
check(proxy.includes("clearStaleAuthCookies") && proxy.includes("refresh token") && proxy.includes("throw caught"), "stale Supabase sessions do not recover safely in middleware");
check(playableCatalog.includes("firstCompleteSentence(value: string, maximum = 200)"), "defined category descriptions are still truncated to the old 82-character limit");
check(serverPlayableCatalog.includes("const PLAYER_COPY_SELECT") && serverPlayableCatalog.includes(".select(PLAYER_COPY_SELECT)"), "Daily copy hydration must use the compact player-copy projection");

if (failures.length) {
  console.error(`GeoStats v16.3.0 checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.3.0 checks passed.");
