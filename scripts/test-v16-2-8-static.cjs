const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const migration = read("supabase/migrations/069_v16_2_8_reviewer_category_copy_and_dedup.sql");
const percentHotfix = read("supabase/migrations/070_v16_2_8_percent_title_semantic_hotfix.sql");
const ownerFollowup = read("supabase/migrations/071_v16_2_8_owner_followup_retirements.sql");
const otherReligions = read("supabase/migrations/072_v16_2_8_define_other_religions.sql");
const cardPunctuation = read("supabase/migrations/073_v16_2_8_card_description_punctuation.sql");
const tradeRetirements = read("supabase/migrations/074_v16_2_8_owner_trade_aggregate_retirements.sql");
const launchAnalytics = read("supabase/migrations/075_v16_2_8_launch_analytics_reporting.sql");
const rlsInitplanHardening = read("supabase/migrations/076_v16_2_8_rls_initplan_hardening.sql");
const writeRlsInitplanHardening = read("supabase/migrations/077_v16_2_8_write_rls_initplan_hardening.sql");
const internalAnalytics = read("supabase/migrations/078_v16_2_8_exclude_internal_analytics.sql");
const importerBase = read("scripts/data_pipeline/base.py");
const unhcr = read("scripts/import-unhcr.py");
const sourceFamilyRecovery = read("scripts/audit-v16-2-6-source-family-recovery.py");
const playable = read("lib/playableCatalog.ts");
const naturalEarth = read("scripts/import-natural-earth.py");
const worldBankInfrastructure = read("scripts/import-world-bank-infrastructure.py");
const worldBankCatalog = read("scripts/import-world-bank-catalog.py");
const workflow = read(".github/workflows/verify-v16.yml");
const challengeCodec = read("lib/challengeCodec.ts");
const publicDaily = read("lib/publicDaily.ts");
const game = read("components/GeoSecondComingGame.tsx");
const version = read("lib/version.ts");
const accountControls = read("components/AccountControls.tsx");
const leaderboardPage = read("app/leaderboard/page.tsx");
const leaderboardRoute = read("app/api/leaderboard/route.ts");
const leaderboardView = read("components/LeaderboardView.tsx");
const expertPage = read("app/daily/expert/page.tsx");
const profileRoute = read("app/api/profile/route.ts");
const privacyMigration = read("supabase/migrations/047_v16_2_6_full_release.sql");
const serverPlayableCatalog = read("lib/serverPlayableCatalog.ts");
const playableCatalogRoute = read("app/api/playable-categories/route.ts");
const analyticsRoute = read("app/api/analytics/events/route.ts");
const analyticsClient = read("lib/analytics.ts");
const analyticsPageView = read("components/AnalyticsPageView.tsx");
const adminDashboard = read("app/admin/AdminDashboard.tsx");
const adminDashboardRoute = read("app/api/admin/dashboard/route.ts");
const boardCapacityRoute = read("app/api/admin/daily/capacity/route.ts");
const boardCapacity = read("lib/seedCapacity.ts");
const puzzleEngine = read("lib/puzzleEngine.ts");
const koppenImporter = read("scripts/import-koppen-geiger.py");
const koppenAudit = read("scripts/audit-koppen-geiger-bundle.py");
const koppenFetch = read("scripts/fetch-koppen-geiger-bundle.py");
const naturalFeasibilityWorkflow = read(".github/workflows/v16-2-8-natural-geography-feasibility.yml");
const pipelineQuality = read("scripts/data_pipeline/quality.py");
const privacyPage = read("app/privacy/page.tsx");
const termsPage = read("app/terms/page.tsx");
const readme = read("README.md");
const releaseNotes = read("RELEASE_NOTES_V16_2_8.md");
const validation = read("VALIDATION_V16_2_8.md");
const rollback = read("ROLLBACK_V16_2_8.sql");
const launchDocket = read("LAUNCH_DOCKET_V16_2_8.md");

check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.2.8 migration is not transaction wrapped");
check(/^begin;/m.test(percentHotfix) && /commit;\s*$/.test(percentHotfix), "v16.2.8 percent-title hotfix is not transaction wrapped");
check(/^begin;/m.test(ownerFollowup) && /commit;\s*$/.test(ownerFollowup), "v16.2.8 owner follow-up is not transaction wrapped");
check(/^begin;/m.test(otherReligions) && /commit;\s*$/.test(otherReligions), "v16.2.8 other-religions definition is not transaction wrapped");
check(/^begin;/m.test(cardPunctuation) && /commit;\s*$/.test(cardPunctuation), "v16.2.8 card punctuation migration is not transaction wrapped");
check(/^begin;/m.test(tradeRetirements) && /commit;\s*$/.test(tradeRetirements), "v16.2.8 trade-retirement migration is not transaction wrapped");
for (const token of [
  "category_board_description_v16_2_8",
  "category_copy_clarity_v16_2_8",
  "v16.2.8 playable-category clarity gate failed",
  "v16.2.8 owner-review copy update was incomplete",
]) check(migration.includes(token), `v16.2.8 migration missing ${token}`);
for (const token of [
  "pg_get_functiondef",
  "share|percentage|percent|%|rate",
  "share|percent|percentage|%|rate",
  "category_v16_2_copy_is_clear",
  "refresh_category_semantic_audit_v16_1",
  "retained categories are not all runtime-playable",
]) check(percentHotfix.includes(token), `v16.2.8 percent-title hotfix missing ${token}`);

const copyBlock = migration.match(/insert into v069_copy[\s\S]*?;\n\nupdate public\.stat_categories/)?.[0] ?? "";
const copyRows = [...copyBlock.matchAll(/^\s*\('([^']+)','([^']*)',/gm)].map((match) => ({ id: match[1], title: match[2] }));
const copyIds = new Set(copyRows.map((row) => row.id));
check(copyRows.length === 127, `expected 127 reviewed copy rows, found ${copyRows.length}`);
check(copyIds.size === copyRows.length, "v16.2.8 copy table contains a duplicate category id");
for (const { id, title } of copyRows) {
  check(!/(^|[^a-z])(mapped|reported value|merchandise|intangible cultural heritage|SNA|BoP)([^a-z]|$)/i.test(title), `${id} retains specialist wording in its player title`);
  check(!/(^|[^a-z])share([^a-z]|$)/i.test(title), `${id} uses share instead of an explicit percentage in its player title`);
  check(!title.includes("-"), `${id} retains an unnecessary title hyphen`);
}

const removalBlock = migration.match(/insert into v069_remove[\s\S]*?;\n\nupdate public\.stat_categories/)?.[0] ?? "";
const removalIds = [...removalBlock.matchAll(/^\s*\('([^']+)'/gm)].map((match) => match[1]);
for (const id of [
  "worldbank-catalog:eg-elc-loss-zs",
  "worldbank-catalog:bm-gsr-royl-cd",
  "worldbank-catalog:bx-gsr-royl-cd",
  "worldbank-catalog:bx-gsr-insf-zs",
  "worldbank-catalog:bm-gsr-insf-zs",
  "worldbank-catalog:fi-res-totl-mo",
  "worldbankinfra:air-passengers",
  "worldbank-catalog:en-pop-slum-ur-zs",
]) check(removalIds.includes(id), `reviewer removal missing ${id}`);
check(removalIds.length === 8, `expected 8 owner-review removals, found ${removalIds.length}`);

for (const id of [
  "unescoich:most-elements",
  "worldbank-catalog:bn-gsr-fcty-cd",
  "worldbank-catalog:bn-trf-curr-cd",
  "worldbank-catalog:bg-gsr-nfsv-gd-zs",
]) {
  check(ownerFollowup.includes(id), `owner follow-up removal missing ${id}`);
  check(importerBase.includes(`"${id}"`), `durable importer filter missing ${id}`);
}
for (const token of [
  "expected exactly 323 runtime-playable categories",
  "airline-passenger deduplication regressed",
  "Most people without citizenship in any country",
  "this is what “stateless” means",
]) check(ownerFollowup.includes(token), `owner follow-up missing ${token}`);
for (const id of [
  "exportsShare",
  "worldbank-catalog:bx-gsr-gnfs-cd",
  "worldbank-catalog:bm-gsr-gnfs-cd",
  "worldbank-catalog:bx-gsr-totl-cd",
  "worldbank-catalog:bx-gsr-nfsv-cd",
  "worldbank-catalog:bm-gsr-nfsv-cd",
  "worldbank-catalog:bn-gsr-gnfs-cd",
]) {
  check(tradeRetirements.includes(`'${id}'`), `trade retirement missing ${id}`);
  check(importerBase.includes(`"${id}"`), `durable importer filter missing ${id}`);
}
for (const token of [
  "trade-category removals did not remain fail-closed",
  "expected exactly 316 runtime-playable categories",
]) check(tradeRetirements.includes(token), `trade-retirement verification missing ${token}`);
check(unhcr.includes("Most people without citizenship in any country"), "UNHCR importer can restore the old statelessness title");
check(unhcr.includes("this is what 'stateless' means"), "UNHCR importer does not define statelessness plainly");
check(sourceFamilyRecovery.includes('"most-stateless-people": "Most people without citizenship in any country"'), "source-family recovery audit retains the old statelessness title");
for (const token of [
  "Highest % following religions outside the five major groups",
  "Religions other than Christianity, Islam, Hinduism, Buddhism or Judaism.",
]) check(otherReligions.includes(token), `other-religions clarification missing ${token}`);
for (const token of [
  "cardDescriptionWithoutTerminalPeriod",
  "boardDescription: cardDescriptionWithoutTerminalPeriod",
]) check(playable.includes(token), `runtime card punctuation guard missing ${token}`);
for (const token of [
  "playable card description still ends in a period",
  "card-description punctuation change altered the playable count",
]) check(cardPunctuation.includes(token), `card punctuation migration missing ${token}`);

check(!/measurement_type\s*=\s*'rate'/.test(migration), "migration writes an invalid rate measurement type");
check(!/measurement_type\s*=\s*'percentage'/.test(migration), "migration writes an invalid percentage measurement type");
for (const token of ["measurement_type='other'", "then 'share'", "measurement_type='per_capita'"]) {
  check(migration.includes(token), `measurement-type correction missing ${token}`);
}

for (const token of [
  "generatedBoardDescription",
  "internalTitle",
  "share([^a-z]|$)",
  "Official country value in the source's stated units.",
]) check(playable.includes(token), `runtime clarity guard missing ${token}`);
check(!playable.includes("`Compare countries by ${measure.toLowerCase()}.`"), "runtime still generates generic compare-countries card copy");

for (const token of [
  '"Largest lake or reservoir"',
  '"Largest total lake and reservoir area"',
  '"Highest % of land covered by lakes and reservoirs"',
  '"Largest area covered by glaciers"',
]) check(naturalEarth.includes(token), `Natural Earth importer missing clear player copy ${token}`);
check(!naturalEarth.includes('"Largest mapped land area"'), "Natural Earth importer can restore a mapped player title");

check(!worldBankInfrastructure.includes("('air-passengers'"), "duplicate air-passenger category can be reimported");
check(!worldBankInfrastructure.includes("('grid-losses'"), "removed grid-loss category can be reimported");
for (const token of [
  "Highest % of people using the internet",
  "Highest % of people with electricity access",
]) check(worldBankInfrastructure.includes(token), `infrastructure importer missing accessible title ${token}`);
check(worldBankCatalog.includes("per (?:unit of|kg of|kilogram of)"), "World Bank catalog no longer recognizes per-unit ratios");
check(worldBankCatalog.includes('prefix = "Most"') && worldBankCatalog.includes('prefix = "Largest"'), "World Bank title rules do not distinguish counts from amounts");

check(/Verify GeoStats v16\.(?:2\.(?:8|9)|[3-9]\.\d+)/.test(workflow), "verification workflow name is older than v16.2.8");
check(/npm run test-v16-(?:2-(?:8|9)|[3-9]-\d+)/.test(workflow), "verification workflow does not run the v16.2.8-or-newer checks");

for (const token of [
  "hydrateRoundSnapshotPlayerCopy",
  "name: current.name",
  "boardDescription: current.boardDescription",
  "ranked: item.ranked.map",
]) check(challengeCodec.includes(token), `saved-board player-copy hydration missing ${token}`);
for (const token of [
  "hydrateCurrentPlayerCopy",
  "loadServerCategoryRegistryForIds",
  "geostats-public-daily-trio-player-copy",
  "PLAYER_COPY_VERSION",
  "original countries, values, rules, and scoring",
]) check(publicDaily.includes(token), `public Daily copy hydration missing ${token}`);
check(/PLAYER_COPY_VERSION = "16\.(?:2\.(?:8\.1|9\.[2-9])|[3-9]\.\d+\.\d+)"/.test(version), "player-copy cache version is older than v16.2.8");
check(/PLAYABLE_CATALOG_CACHE_VERSION = "16\.(?:2\.(?:8\.316|9\.(?:32[7-9]|33[0-9]))|[3-9](?:\.\d+){2,})"/.test(version), "playable-catalog cache version is older than the reviewed v16.2.8 catalog");
check(serverPlayableCatalog.match(/PLAYABLE_CATALOG_CACHE_VERSION/g)?.length >= 5, "server catalog caches are not versioned consistently");
check(playableCatalogRoute.includes("X-GeoStats-Catalog-Version") && playableCatalogRoute.includes("PLAYABLE_CATALOG_CACHE_VERSION"), "catalog endpoint does not disclose its cache version");
check(game.includes("${PLAYER_COPY_VERSION}:${date}") && game.includes("copy: PLAYER_COPY_VERSION"), "browser/CDN Daily caches are not keyed by player-copy version");
check(/(?:have your verified score saved automatically|save your verified score automatically)/.test(game), "Expert account copy incorrectly implies manual score submission");
for (const token of [
  "expertPreview = !isRandom && difficulty === \"expert\" && !canPlayExpert",
  "disabled={expertPreview||used.has(country.id)}",
  "Saved automatically to your account and included in the verified standings.",
  "onScoreSaved={(saved)",
]) check(game.includes(token), `Expert/account score flow missing ${token}`);
for (const token of ["categoryThemeClass", "Card-edge colors group subjects", "They are guides only and do not change scoring", "categoryColorKey"]) {
  check(game.includes(token), `board color-key clarity missing ${token}`);
}
for (const token of [
  "onScoreSaved?.({ challengeDate: pending.challengeDate, difficulty })",
  "Verified Daily scores are saved automatically",
  "Your email never does",
]) check(accountControls.includes(token), `account UI missing ${token}`);
check(leaderboardPage.includes("<LeaderboardView />") && !leaderboardPage.includes("Account-only standings"), "leaderboard page is not publicly visible");
check(!leaderboardView.includes("Internal QA"), "leaderboard exposes internal QA terminology to players");
check(!/Random QA|Internal Random|QA functionality/.test(`${privacyPage}\n${termsPage}`), "public legal pages expose internal QA terminology");
check(!leaderboardRoute.includes("Sign in to view the GeoStats leaderboard") && leaderboardRoute.includes("signedIn: Boolean(currentUserId)"), "leaderboard API is not public with optional current-player context");
check(!fs.existsSync(path.join(root, "components/AccountLeaderboard.tsx")), "obsolete manual leaderboard score-submission component still exists");
for (const token of [
  "separate verified standings",
  'role="tabpanel"',
  'aria-selected=',
  "Try again",
  "updateLocation",
]) check(leaderboardView.includes(token), `leaderboard resilience/accessibility missing ${token}`);
for (const token of ["Rank", "Player", "Average score", "Rating", "Completed games"]) check(leaderboardView.includes(token), `leaderboard table missing ${token}`);
check(!leaderboardView.includes('>Today</button>') && !leaderboardView.includes('view=${tab}'), "daily leaderboard controls or API parameters remain");
check(leaderboardView.includes("leader.averageScore.toFixed") && leaderboardView.includes("leader.isCurrentPlayer"), "leaderboard score scale or current-player highlight missing");
for (const token of ["Board adj.", "Avg. place", "ratingExplainer", "normalizedPerformance.toFixed"]) check(!leaderboardView.includes(token), `leaderboard still exposes ${token}`);
for (const token of [
  '"Cache-Control": "no-store"',
  "The standings could not be loaded right now",
  "console.error(\"Leaderboard query failed\"",
]) check(leaderboardRoute.includes(token), `leaderboard API hardening missing ${token}`);
for (const token of ["signInWithOAuth", 'provider: "google"', "Continue with Google", "spam or junk"]) check(accountControls.includes(token), `Google/email sign-in flow missing ${token}`);
for (const token of [
  "account_authenticated",
  "analytics_difficulty_30d",
  "analytics_category_engagement_30d",
  "analytics_country_engagement_30d",
  "returning_rate",
]) check(launchAnalytics.includes(token), `launch analytics migration missing ${token}`);
check(analyticsClient.includes('"account_authenticated"'), "successful authentication event is not recognized by the client");
check(analyticsPageView.includes('trackAnalytics("account_authenticated"') && analyticsPageView.includes("history.replaceState"), "auth completion is not tracked and cleaned from the URL");
check(analyticsRoute.includes('path?.startsWith("/random")') && analyticsRoute.includes('body.eventName === "account_authenticated" && !user'), "analytics route does not reject internal QA or unauthenticated auth events");
for (const token of ["is_internal", "app_admins", "internal_testers", "Internal analytics session backfill failed"]) check(analyticsRoute.includes(token), `analytics route missing internal exclusion: ${token}`);
for (const token of ["analytics_daily_summary_30d", "is_internal=false", "internal_qa_page_views", "America/New_York"]) check(internalAnalytics.includes(token), `internal analytics migration missing ${token}`);
for (const token of ["Traffic and account funnel", "Gameplay engagement", "Top acquisition paths", "Most-played categories", "Most-played countries"]) {
  check(adminDashboard.includes(token), `Admin analytics reporting missing ${token}`);
}
for (const token of ["Traffic and accounts by day", "QA excluded", "auto-refreshes every minute", "dailySummary"]) check(adminDashboard.includes(token), `Admin live traffic table missing ${token}`);
for (const token of ["Warehouse status", "Eligibility", "Review priority", "Utilization", "Blocker"]) {
  check(adminDashboard.includes(token), `Admin status clarity missing ${token}`);
}
check(adminDashboardRoute.includes("warehouseHealth") && adminDashboardRoute.includes("initialQueryFailures"), "Admin dashboard does not degrade gracefully when an optional warehouse subsystem fails");
check((rlsInitplanHardening.match(/\(select auth\.uid\(\)\)/g) ?? []).length === 3, "owner/admin RLS policies do not use initplan-safe auth checks");
check((writeRlsInitplanHardening.match(/\(select auth\.uid\(\)\)/g) ?? []).length === 5, "authenticated write policies do not use initplan-safe auth checks");
check(expertPage.includes("canPlayExpert={Boolean(userResult?.data.user)}"), "Expert play does not use server-authenticated access state");
check(profileRoute.includes("usernamePassesModeration") && profileRoute.includes("Your email") === false, "username moderation or profile privacy regressed");
for (const token of [
  'create policy "users read own profile"',
  'create policy "users read own scores"',
]) check(privacyMigration.includes(token), `private account-row policy missing ${token}`);
for (const token of ["check-v16-3-1", "LAUNCH_DOCKET_V16_2_8.md", "RELEASE_NOTES_V16_2_8.md", "VALIDATION_V16_2_8.md"]) {
  check(readme.includes(token), `README launch handoff missing ${token}`);
}
for (const token of ["automatic standings", "first-party analytics", "four bounded feasibility passes", "custom SMTP"]) {
  check(releaseNotes.includes(token), `v16.2.8 release notes missing ${token}`);
}
for (const token of ["Top-20", "GitHub", "Vercel", "WebKit", "ROLLBACK_V16_2_8.sql"]) {
  check(validation.includes(token), `v16.2.8 validation missing ${token}`);
}
check(/^begin;/m.test(rollback) && /commit;\s*$/.test(rollback), "v16.2.8 optional rollback is not transaction wrapped");
check(rollback.includes("account_authenticated") && rollback.includes("users update own scores"), "v16.2.8 rollback does not preserve accepted auth events or restore account policies");
for (const token of [
  "Leaderboards — standalone launch package",
  "actual country-bank feasibility",
  "Natural and physical geography",
  "Country history",
  "Ethnic, religious, and racial demographics",
  "External owner approval gates",
]) check(launchDocket.includes(token), `canonical launch docket missing ${token}`);
for (const token of ["loadPuzzleCatalogSnapshot", "estimatePlayableBoardCapacity", "global Top-20 winner requirement", "within five minutes"]) {
  check(boardCapacityRoute.includes(token), `board-capacity route missing ${token}`);
}
for (const token of ["categorySetHasFeasibleCountryBank", "countryBankFeasibleSamples", "estimatedPlayableCategorySets", "exactPlayableCount: false"]) {
  check(boardCapacity.includes(token), `board-capacity estimator missing ${token}`);
}
for (const token of ["distinct global Top-20", "findDistinctWinners", "validateRound(categories, bank)"]) {
  check(puzzleEngine.includes(token), `board-capacity feasibility check missing ${token}`);
}
for (const token of ["temporal_scope='climatology'", "publication_year=2023", "Highest percentage of land with a desert climate", "Most climate types"]) {
  check(koppenImporter.includes(token), `bounded natural-geography importer missing ${token}`);
}
for (const token of ["default=10", "STOP_BELOW_MINIMUM", "top20_distinct_visible_values", "quality_auto_qualified"]) {
  check(koppenAudit.includes(token), `bounded natural-geography audit missing ${token}`);
}
for (const token of ["api.figshare.com/v2/articles/21789074", "koppen_geiger_tif.zip", "naturalearth.s3.amazonaws.com", "manifest.json"]) {
  check(koppenFetch.includes(token), `bounded natural-geography source resolver missing ${token}`);
}
check(naturalFeasibilityWorkflow.includes("Prove at least 10 complete candidates or stop") && naturalFeasibilityWorkflow.includes("if: always()"), "bounded natural-geography workflow is not fail-closed with retained evidence");
check(pipelineQuality.includes('rule.temporal_scope == "climatology"') && pipelineQuality.includes("rule.publication_year"), "stable climatology freshness is still treated as an annual-data staleness failure");

if (failures.length) {
  console.error(`GeoStats v16.2.8 category clarity checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.2.8 category clarity checks passed.");
