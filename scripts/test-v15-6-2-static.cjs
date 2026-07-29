const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');

const root = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}
function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}
function parseTypeScript(relative) {
  const source = read(relative);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
    fileName: relative,
  });
  for (const diagnostic of output.diagnostics || []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      failures.push(`${relative}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
    }
  }
}

for (const file of [
  'lib/version.ts',
  'lib/categoryEditorialPolicy.ts',
  'lib/dailyTrioRules.ts',
  'lib/generationProfiles.ts',
  'lib/serverPlayableCatalog.ts',
  'app/layout.tsx',
  'app/api/daily-trio/[date]/route.ts',
]) parseTypeScript(file);

const version = read('lib/version.ts');
requireCondition(version.includes('APP_VERSION = "15.6.2"'), 'App version is not 15.6.2.');
requireCondition(version.includes('RULES_VERSION = "12.2"'), 'Rules version is not 12.2.');
requireCondition(version.includes('SCOUT-ADVENTURER-EXPERT-V15-6-2-STABLE'), 'Category-set version was not advanced.');

const trio = read('lib/dailyTrioRules.ts');
requireCondition(!/errors\.push\([^)]*physical-geography/.test(trio), 'Physical-geography target is still a fatal trio error.');
requireCondition(trio.includes('dailyTrioPreferenceWarnings'), 'Nonfatal preference diagnostics are missing.');
requireCondition(trio.includes('MAX_TRIO_EMISSIONS_CATEGORIES = 1'), 'Trio emissions cap is missing.');

const profiles = read('lib/generationProfiles.ts');
requireCondition(profiles.includes('name: "availability-first"'), 'Availability-first generation profile is missing.');

const serverCatalog = read('lib/serverPlayableCatalog.ts');
requireCondition(!serverCatalog.includes('loadCachedRandomCatalog'), 'Server still maintains a separate Random-only catalog.');
requireCondition(serverCatalog.includes('loadCachedApprovedCatalog'), 'Single approved catalog cache is missing.');

const policy = read('lib/categoryEditorialPolicy.ts');
requireCondition(!policy.includes('"random"'), 'Editorial policy can still assign Random-only.');

const route = read('app/api/daily-trio/[date]/route.ts');
requireCondition(route.includes('category_set_version'), 'Daily route does not validate category-set version.');
requireCondition(route.includes('Today’s boards are still being prepared'), 'Simple player-facing generation message is missing.');
requireCondition(route.includes('dailyTrioPreferenceWarnings'), 'Daily route does not record preference warnings.');

const css = read('app/v15-6-2-stability.css');
requireCondition(css.includes('-webkit-line-clamp: unset !important'), 'Final CSS does not override line clamps.');
requireCondition(css.includes('overflow: visible !important'), 'Final CSS does not allow wrapped copy.');

const sql = read('RUN_THIS_IN_SUPABASE_FOR_V15_6_2.sql');
requireCondition(!/(?<!source_)indicator_code/.test(sql), 'SQL references the nonexistent indicator_code column.');
for (const code of ['EN.GHG.CO2.PC.CE.AR5','BX.GSR.CMCP.ZS','BM.GSR.CMCP.ZS','BX.GSR.TRVL.ZS','BM.GSR.TRVL.ZS']) {
  requireCondition(sql.includes(code), `SQL is missing ${code}.`);
}
requireCondition(sql.includes('category_copy_audit_v15_6_2'), 'Catalog-wide copy audit is missing.');
requireCondition(sql.includes("editorial_outcome = 'random'"), 'Random-only migration is missing.');

if (failures.length) {
  console.error('v15.6.2 static checks FAILED:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('v15.6.2 TypeScript parse and static checks passed.');
