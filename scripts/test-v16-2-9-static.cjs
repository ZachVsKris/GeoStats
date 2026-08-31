const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const pkg = JSON.parse(read("package.json"));
const version = read("lib/version.ts");
const leaderboardPage = read("app/leaderboard/page.tsx");
const leaderboard = read("components/LeaderboardView.tsx");
const leaderboardApi = read("app/api/leaderboard/route.ts");
const accounts = read("components/AccountControls.tsx");
const analytics = read("lib/analytics.ts");
const trio = read("lib/dailyTrioRules.ts");
const adminDashboard = read("app/api/admin/dashboard/route.ts");
const baseImporter = read("scripts/data_pipeline/base.py");
const migration = read("supabase/migrations/20260831061610_v16_2_9_transport_retirement_and_public_leaderboard.sql");
const playerCopyAudit = read("supabase/migrations/20260831234500_v16_2_9_player_copy_icon_audit.sql");
const savedBoardHydration = read("supabase/migrations/20260831235500_v16_2_9_saved_board_targeted_hydration.sql");
const playableCatalog = read("lib/playableCatalog.ts");
const publicDaily = read("lib/publicDaily.ts");
const workflow = read(".github/workflows/import-v16-2-9-koppen-bundle.yml");
const verify = read(".github/workflows/verify-v16.yml");
const ledger = read("BOUNDED_EXPANSION_LEDGER_V16_2_9.md");
const releaseNotes = read("RELEASE_NOTES_V16_2_9.md");
const validation = read("VALIDATION_V16_2_9.md");
const rollback = read("ROLLBACK_V16_2_9.sql");

check(pkg.version === "16.2.9", "package version is not v16.2.9");
check(pkg.scripts.test === "npm run test-v16-2-9" && pkg.scripts.check === "npm run check-v16-2-9" && pkg.scripts["test-v16"] === "npm run test-v16-2-9" && pkg.scripts["check-v16"] === "npm run check-v16-2-9", "default validation scripts do not target v16.2.9");
for (const token of ['APP_VERSION = "16.2.9"', 'RULES_VERSION = "16.2.9"', 'PLAYER_COPY_VERSION = "16.2.9.4"', 'PLAYABLE_CATALOG_CACHE_VERSION = "16.2.9.329"']) check(version.includes(token), `version constants missing ${token}`);
check(!leaderboardPage.includes("redirect("), "public leaderboard page still redirects signed-out visitors");
for (const token of ["Rank", "Player", "Average score", "Rating", "Completed games"]) check(leaderboard.includes(token), `all-time leaderboard missing ${token}`);
check(!leaderboard.includes("Today") && !leaderboard.includes("timeRange"), "Daily leaderboard controls remain");
check(leaderboardApi.includes("averageScore") && leaderboardApi.includes("isCurrentPlayer") && !leaderboardApi.includes("Unauthorized"), "public leaderboard API shape is incomplete");
check(leaderboardApi.includes("Number(patch) >= 4"), "leaderboard normalization does not preserve every v16.2.4+ score era");
check(accounts.includes('provider: "google"') && accounts.includes("Continue with Google"), "Google-first authentication UI is missing");
check(analytics.includes('navigator.sendBeacon("/api/analytics/events", body)') && !analytics.includes("new Blob([body]"), "analytics beacon can still trigger WebKit's empty-Blob 400 response");
check(trio.includes("semanticConflict(other, category)") && trio.includes("too conceptually similar to appear across Daily modes"), "same-day semantic collision protection is incomplete");
check(adminDashboard.includes('.order("id")') && adminDashboard.includes("categoryRows.sort") && !adminDashboard.includes('.order("title")'), "Admin catalog paging is still vulnerable to the production title-sort timeout");
check(baseImporter.includes('"worldbank-catalog:bx-gsr-tran-zs"'), "transport service-share category is not durably filtered at importer boundary");
for (const token of ["pew-religion:other-religions-population','Largest population following other religions", "worldbank-catalog:er-h2o-fwtl-zs','Highest freshwater use relative to internal resources", "worldbank-catalog:it-net-secr','Most trusted website security certificates", "worldbank-catalog:ne-exp-gnfs-kd-zg','Fastest export growth", "'🕯️'", "'💧'", "'🔒'", "'✈️'"]) check(playerCopyAudit.includes(token), `bounded player-copy audit missing ${token}`);
check(/^begin;/m.test(playerCopyAudit) && /commit;\s*$/.test(playerCopyAudit), "player-copy audit migration is not transaction wrapped");
check(savedBoardHydration.includes("title = 'Largest lake'") && savedBoardHydration.includes("geostats-v16.2.9.4"), "saved-board lake title correction is incomplete");
check(playableCatalog.includes('/other religions|outside (?:the )?(?:five )?major groups/.test(copy)') && playableCatalog.includes('return "🕯️"'), "neutral multi-religion icon guard is missing");
check(publicDaily.includes("loadServerCategoryRegistryForIds") && publicDaily.includes("board_payload.categories.map"), "saved boards do not use bounded current-copy hydration");
for (const token of ["promote_v16_2_9_koppen_bundle", "validation_status='verified'", "common_year_coverage", "top_value_distinct_count", "computed_playable_v16_2"]) check(migration.includes(token), `bounded climate promotion gate missing ${token}`);
check(migration.includes("security definer\nset search_path=''"), "Köppen promotion function does not pin an empty search_path");
for (const token of ["--minimum-pass 10", "--only desert-share", "audit-source-integrity.py", "promote-v16-2-9-koppen.py", "actions/setup-node@v6", "npm run audit-generator-reachability"]) check(workflow.includes(token), `bounded climate workflow missing ${token}`);
check(verify.includes("Verify GeoStats v16.2.9") && verify.includes("geostats-v16-2-9-verify") && verify.includes("npm run test-v16-2-9"), "CI is not pinned to v16.2.9");
for (const token of ["Natural and physical geography", "Country history", "Culture", "Ethnic, religious, and racial demographics", "Infrastructure, technology, and science"]) check(ledger.includes(token), `bounded source ledger missing ${token}`);
check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.2.9 migration is not transaction wrapped");
for (const token of ["Public all-time standings", "Google is the primary", "same-day Scout", "finite no-go outcomes"]) check(releaseNotes.includes(token), `v16.2.9 release notes missing ${token}`);
for (const token of ["326", "Chromium/Firefox/WebKit", "code-verifier mismatch", "Supabase security and performance advisors"]) check(validation.includes(token), `v16.2.9 validation missing ${token}`);
check(/^begin;/m.test(rollback) && /commit;\s*$/.test(rollback) && rollback.includes("owner-directed transport-services retirement"), "v16.2.9 rollback is incomplete");

if (failures.length) {
  console.error(`GeoStats v16.2.9 checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.2.9 checks passed.");
