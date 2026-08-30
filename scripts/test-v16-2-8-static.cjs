const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const migration = read("supabase/migrations/069_v16_2_8_reviewer_category_copy_and_dedup.sql");
const percentHotfix = read("supabase/migrations/070_v16_2_8_percent_title_semantic_hotfix.sql");
const playable = read("lib/playableCatalog.ts");
const naturalEarth = read("scripts/import-natural-earth.py");
const worldBankInfrastructure = read("scripts/import-world-bank-infrastructure.py");
const worldBankCatalog = read("scripts/import-world-bank-catalog.py");
const workflow = read(".github/workflows/verify-v16.yml");
const challengeCodec = read("lib/challengeCodec.ts");
const publicDaily = read("lib/publicDaily.ts");
const game = read("components/GeoSecondComingGame.tsx");

check(/^begin;/m.test(migration) && /commit;\s*$/.test(migration), "v16.2.8 migration is not transaction wrapped");
check(/^begin;/m.test(percentHotfix) && /commit;\s*$/.test(percentHotfix), "v16.2.8 percent-title hotfix is not transaction wrapped");
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

check(workflow.includes("Verify GeoStats v16.2.8"), "verification workflow name was not advanced to v16.2.8");
check(workflow.includes("npm run test-v16-2-8"), "verification workflow does not run the full v16.2.8 checks");

for (const token of [
  "hydrateRoundSnapshotPlayerCopy",
  "name: current.name",
  "boardDescription: current.boardDescription",
  "ranked: item.ranked.map",
]) check(challengeCodec.includes(token), `saved-board player-copy hydration missing ${token}`);
for (const token of [
  "hydrateCurrentPlayerCopy",
  "loadServerPlayableCategoryCatalog",
  "geostats-public-daily-trio-player-copy-v16.2.8",
  "original countries, values, rules, and scoring",
]) check(publicDaily.includes(token), `public Daily copy hydration missing ${token}`);
check(game.includes("have your verified score saved automatically"), "Expert account copy incorrectly implies manual score submission");

if (failures.length) {
  console.error(`GeoStats v16.2.8 category clarity checks FAILED:\n${failures.map((item) => ` - ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("GeoStats v16.2.8 category clarity checks passed.");
