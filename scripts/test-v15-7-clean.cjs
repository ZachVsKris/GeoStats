const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const requireCheck = (condition, message) => { if (!condition) failures.push(message); };

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else files.push(target);
  }
  return files;
}

for (const file of walk(root).filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'))) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  for (const diagnostic of output.diagnostics || []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      failures.push(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    }
  }
}

const pkg = JSON.parse(read('package.json'));
requireCheck(pkg.version === '15.7.0', 'package.json version is not 15.7.0.');

const version = read('lib/version.ts');
requireCheck(version.includes('APP_VERSION = "15.7.0"'), 'Application version is not 15.7.0.');
requireCheck(version.includes('RULES_VERSION = "13.0"'), 'Rules version is not 13.0.');
requireCheck(version.includes('SCOUT-ADVENTURER-EXPERT-V15-7-CLEAN'), 'Category-set version was not advanced.');

const catalog = read('lib/playableCatalog.ts');
requireCheck(catalog.includes('row.computed_playable_v15 === true'), 'Catalog does not use computed_playable_v15 as its authority.');
requireCheck(!catalog.includes('type CatalogTier'), 'A separate catalog-tier type still exists.');
requireCheck(!catalog.includes('"random"'), 'Random-only catalog logic remains in playableCatalog.ts.');
requireCheck(catalog.includes('return 30;'), 'Runtime coverage floor is not limited to the top-30 game requirement.');
requireCheck(catalog.includes('boardDescription'), 'Board-description mapping is missing.');

const serverCatalog = read('lib/serverPlayableCatalog.ts');
requireCheck(!serverCatalog.includes('CatalogTier'), 'Server catalog still accepts a tier.');
requireCheck(serverCatalog.includes('loadServerCategoryRegistry'), 'Historical all-category registry is missing.');

const warehouse = read('lib/serverWarehouseCategories.ts');
requireCheck(warehouse.includes('fetchServerWarehouseCategories'), 'Bulk warehouse loader is missing.');
requireCheck(!warehouse.includes('targetCount = 180'), 'An old 180-category candidate limit remains.');

const engine = read('lib/puzzleEngine.ts');
requireCheck(engine.includes('load the complete approved catalog') || engine.includes('complete approved catalog'), 'Generator does not document/load the complete approved catalog.');
requireCheck(engine.includes('Bounded backtracking'), 'Category backtracking is missing.');
requireCheck(engine.includes('combineCandidateRounds'), 'Joint trio candidate combination is missing.');
requireCheck(engine.includes('generateDailyTrioFromLoadedCatalog'), 'Pure generator regression entrypoint is missing.');
requireCheck(engine.includes('GENERATION_BUDGET_MS = 60_000'), 'Daily generation does not have the intended bounded search budget.');

const trioRules = read('lib/dailyTrioRules.ts');
requireCheck(trioRules.includes('dailyTrioPreferenceWarnings'), 'Soft trio-preference diagnostics are missing.');
requireCheck(!/errors\.push\([^\n]*physical-geography/.test(trioRules), 'Physical-geography target is still fatal.');
requireCheck(trioRules.includes('MAX_TRIO_EMISSIONS_CATEGORIES = 1'), 'Emissions-family cap is missing.');

const dailyApi = read('app/api/daily-trio/[date]/route.ts');
const dailyLock = read('lib/dailyGenerationLock.ts');
const adminDailyApi = read('app/api/admin/daily/generate/route.ts');
requireCheck(dailyApi.includes('requireAdmin'), 'Daily POST does not require administrator authentication.');
requireCheck(dailyApi.includes('date !== newYorkDate()'), 'Public Daily API can generate arbitrary dates.');
requireCheck(dailyApi.includes('acquireDailyGenerationLock') && dailyLock.includes('daily_generation_locks_v15_7'), 'Daily generation lock is missing.');
requireCheck(adminDailyApi.includes('acquireDailyGenerationLock') && adminDailyApi.includes('releaseDailyGenerationLock'), 'Administrator generation does not share the per-date lock.');
requireCheck(dailyApi.includes('trioErrors'), 'Cross-mode validation is not separated from per-mode score locks.');
requireCheck(dailyApi.includes('.eq("difficulty", difficulty)'), 'Score locks are not difficulty-specific.');
requireCheck(dailyApi.includes('board_payload'), 'Daily persistence does not use immutable snapshots.');
requireCheck(dailyApi.includes('legacyModes'), 'Scored legacy modes are not preserved independently.');
requireCheck(dailyApi.includes('Daily boards with saved scores are locked against replacement.'), 'Administrator board replacement can overwrite scored Dailies.');

const scoresApi = read('app/api/scores/route.ts');
requireCheck(scoresApi.includes('select("encoded_board,board_payload")'), 'Score verification does not load immutable board snapshots.');
requireCheck(scoresApi.includes('deserializeRound'), 'Score verification does not deserialize immutable snapshots.');
requireCheck(scoresApi.includes('loadServerCategoryRegistry'), 'Legacy score verification still depends on the current playable catalog.');
requireCheck(!scoresApi.includes('loadServerPlayableCategoryCatalog'), 'Score verification can still break when a category leaves the playable catalog.');
requireCheck(scoresApi.includes('submittedCategoryIds.some'), 'Score verification does not reject unknown category assignments.');
requireCheck(scoresApi.includes('assignedCountryIds.some'), 'Score verification does not reject unknown country assignments.');
requireCheck(scoresApi.includes('new Set(assignedCountryIds).size !== assignedCountryIds.length'), 'Score verification allows one country to be reused across categories.');

const seededApi = read('app/api/seeded/[difficulty]/route.ts');
const cronApi = read('app/api/cron/daily/route.ts');
requireCheck(seededApi.includes('generateSeededRound'), 'Seeded boards are not server generated.');
requireCheck(seededApi.includes('serializeRound'), 'Seeded API does not return an immutable board snapshot.');
requireCheck(cronApi.includes('CRON_SECRET') && cronApi.includes('/api/daily-trio/'), 'Secure Daily pre-generation cron route is missing.');
requireCheck(read('vercel.json').includes('/api/cron/daily'), 'Vercel Daily cron schedule is missing.');

const codec = read('lib/challengeCodec.ts');
requireCheck(codec.includes('export type RoundSnapshot'), 'RoundSnapshot type is missing.');
requireCheck(codec.includes('serializeRound') && codec.includes('deserializeRound'), 'Snapshot serialization is incomplete.');

const game = read('components/GeoSecondComingGame.tsx');
requireCheck(game.includes('dataset.category.boardDescription'), 'Board still renders only the full source description.');
requireCheck(game.includes('mobileModeTabs') && game.includes('mobileGameSummary') && game.includes('mobileMenu'), 'Compact mobile game shell is incomplete.');
requireCheck(game.includes('/api/seeded/'), 'Client still composes Seeded boards itself.');
requireCheck(game.includes('!scores ? "activePlay"'), 'Compact layout is not active during loading and errors.');

const css = read('app/v15-7-clean.css');
requireCheck(css.includes('.desktopHero,.activePlay .dataNote{display:none!important}'), 'Mobile hero/data-note compaction is missing.');
requireCheck(css.includes('-webkit-line-clamp:unset!important'), 'Board copy can still be line-clamped.');
requireCheck(css.includes('font-size:9px!important'), 'Mobile board-description size is not readable.');
requireCheck(!css.includes('5.9px'), 'Microscopic legacy description size remains.');

const workbenchApi = read('app/api/admin/category-review/route.ts');
requireCheck(workbenchApi.includes('computed_playable_v15'), 'Workbench Playable count does not use the authoritative field.');
requireCheck(workbenchApi.includes('approved_but_blocked'), 'Workbench approved-but-blocked count is missing.');
const workbench = read('app/admin/review/CategoryReviewWorkbench.tsx');
requireCheck(workbench.includes('Board description'), 'Workbench cannot edit board descriptions.');
requireCheck(!workbench.includes('Random-only'), 'Workbench still displays Random-only.');

const sql = read('RUN_THIS_IN_SUPABASE_FOR_V15_7.sql');
requireCheck((sql.match(/\bbegin;/gi) || []).length === 1, 'Installer must contain one transaction BEGIN.');
requireCheck((sql.match(/\bcommit;/gi) || []).length === 1, 'Installer must contain one transaction COMMIT.');
requireCheck(sql.includes('add column if not exists board_payload jsonb'), 'Installer does not add immutable board snapshots.');
requireCheck(sql.includes('daily_generation_locks_v15_7'), 'Installer does not create the generation lock table.');
requireCheck(sql.includes('category_manual_review_v15_7'), 'Installer does not create the manual-review view.');
requireCheck(sql.includes('zero stored observations'), 'Broken physical datasets are not quarantined.');
requireCheck(!/(?<!source_)indicator_code/.test(sql), 'Installer references the nonexistent indicator_code column.');
requireCheck(!/^\s*where\b[^\n]*\n\s*where\b/im.test(sql), 'Installer contains consecutive WHERE clauses.');
requireCheck(read('supabase/migrations/034_v15_7_clean_integrated_rebuild.sql') === sql, 'Root installer and migration differ.');

for (const required of ['VERIFY_V15_7.sql', 'ROLLBACK_V15_7.sql', 'MANUAL_CATEGORY_REVIEW_V15_7.sql']) {
  requireCheck(fs.existsSync(path.join(root, required)), `${required} is missing.`);
}

if (failures.length) {
  console.error('GeoStats v15.7 clean checks FAILED:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('GeoStats v15.7 clean syntax, policy, API, catalog, SQL, and UI checks passed.');
