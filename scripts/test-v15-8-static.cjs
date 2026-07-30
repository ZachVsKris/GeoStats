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
    if (entry.isDirectory()) files.push(...walk(target)); else files.push(target);
  }
  return files;
}
for (const file of walk(root).filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'))) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    fileName: file, reportDiagnostics: true,
  });
  for (const diagnostic of output.diagnostics || []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) failures.push(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}
const pkg = JSON.parse(read('package.json'));
requireCheck(pkg.version === '15.8.0', 'package version is not 15.8.0');
const version = read('lib/version.ts');
requireCheck(version.includes('APP_VERSION = "15.8.0"'), 'app version is not 15.8.0');
requireCheck(version.includes('RULES_VERSION = "13.1"'), 'rules version is not 13.1');
const game = read('components/GeoSecondComingGame.tsx');
requireCheck(game.includes('>Random</a>'), 'Seeded was not renamed Random');
requireCheck(!game.includes('>Seeded</a>'), 'Seeded navigation label remains');
requireCheck(!game.includes('>Daily</a>'), 'Redundant Daily navigation button remains');
const catalog = read('lib/playableCatalog.ts');
requireCheck(catalog.includes('faostatMeasureAllowed'), 'runtime FAOSTAT policy is missing');
requireCheck(catalog.includes('Highest share living in largest city'), 'largest-city share rewrite is missing');
for (const source of ['unescoheritage','aquastat','usgsminerals','faofisheries']) requireCheck(catalog.includes(source), `${source} catalog mapping missing`);
const faostat = read('scripts/import-faostat.py');
requireCheck(faostat.includes('livestock_population_allowed'), 'livestock population allow rule missing');
requireCheck(faostat.includes('LIVESTOCK_POPULATION_ELEMENTS'), 'livestock stock element support missing');
requireCheck(faostat.includes('Largest {label} population'), 'natural livestock-population title rule missing');
requireCheck(faostat.includes('"yield"'), 'yield exclusion missing');
const importerBase = read('scripts/data_pipeline/base.py');
requireCheck(importerBase.includes('V15_8_MANUAL_REVIEW_SOURCES'), 'expansion manual-review source gate missing');
requireCheck(importerBase.includes('manual_review_required'), 'new expansion candidates are not forced into manual review');
const vetting = read('scripts/vet-expanded-catalog.py');
requireCheck(vetting.includes('comparison_rows'), 'duplicate vetting does not compare expansion candidates against the full catalog');
requireCheck(vetting.includes('rank_correlation'), 'ranking-correlation duplicate evidence is missing');
requireCheck(vetting.includes('auto-vetting-v2'), 'v15.8 duplicate-vetting version was not advanced');
for (const file of ['scripts/import-unesco-world-heritage.py','scripts/import-aquastat.py','scripts/import-usgs-minerals.py','scripts/import-fao-fisheries.py','scripts/vet-expanded-catalog.py','.github/workflows/import-v15-8-expansion.yml','.github/workflows/vet-expanded-catalog.yml']) requireCheck(fs.existsSync(path.join(root,file)), `${file} missing`);
const migration = read('RUN_THIS_IN_SUPABASE_FOR_V15_8.sql');
requireCheck(migration === read('supabase/migrations/035_v15_8_expansion_intake_and_review.sql'), 'root v15.8 installer differs from migration');
requireCheck(migration.includes('category_auto_vetting_v15_8'), 'auto-vetting table missing');
requireCheck(migration.includes('keep-livestock-population'), 'livestock restore policy missing');
requireCheck(migration.includes('retire-yield-or-productivity'), 'yield retirement policy missing');
requireCheck(migration.includes('Highest share living in largest city'), 'city share SQL correction missing');
const workbench = read('app/admin/review/CategoryReviewWorkbench.tsx');
requireCheck(workbench.includes('Automated vetting recommendation'), 'Workbench auto-vetting panel missing');
requireCheck(read('app/api/admin/category-review/route.ts').includes('category_review_workbench_v15_8'), 'Workbench API does not use v15.8 view');
for (const source of ['unescoheritage','aquastat','usgsminerals','faofisheries']) requireCheck(read('lib/sourceRegistry.ts').includes(source), `${source} source registry missing`);
if (failures.length) {
  console.error('GeoStats v15.8 checks FAILED:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('GeoStats v15.8 syntax, navigation, FAOSTAT, expansion, vetting, Workbench, and SQL checks passed.');
