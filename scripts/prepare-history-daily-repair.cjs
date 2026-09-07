// Read-only preparation. Publication is a separate score-guarded transaction.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const {load}=require('./test-catalog-recovery.cjs');
const {loadAuditExport}=require('./load-audit-export.cjs');
const {loaded,countries,mapping}=loadAuditExport(process.argv[2]);
const rows=JSON.parse(fs.readFileSync(process.argv[3]));
const history=JSON.parse(fs.readFileSync(process.argv[4])).filter(r=>r.challenge_date<process.argv[5]);
const date=process.argv[5],output=process.argv[6];assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
const codec=load('lib/challengeCodec.ts');
const {validateDailyTrio}=load('lib/dailyTrioRules.ts');
const {validateRound}=load('lib/dataEngine.ts');
const {generateDailyTrioFromLoadedCatalog}=load('lib/puzzleEngine.ts');
const {RULES_VERSION,DATASET_VERSION,CATEGORY_SET_VERSION}=load('lib/version.ts');
const service=fs.readFileSync('lib/dailyBoardService.ts','utf8');
const start=service.indexOf('export function recentCountryExposureFromRows'),end=service.indexOf('async function loadRecentCategoryExposure',start);
assert.ok(start>0&&end>start);const helpers={exports:{}};
new Function('exports','deserializeRound','semanticFamily','worldKnowledgeBucket',ts.transpileModule(service.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(helpers.exports,codec.deserializeRound,load('lib/gameRules.ts').semanticFamily,load('lib/categoryGeneration.ts').worldKnowledgeBucket);
const fixed=Object.fromEntries(rows.filter(r=>r.difficulty!=='normal').map(r=>[r.difficulty,codec.deserializeRound(r.board_payload)]));
assert.ok(fixed.easy&&fixed.expert);
const g=generateDailyTrioFromLoadedCatalog(countries,date,loaded,fixed,'HISTORY-REPAIR',{
 budgetMs:90000,candidateTarget:64,jointSearch:true,jointFirst:true,
 recentCountryExposure:helpers.exports.recentCountryExposureFromRows(history),recentCategoryExposure:helpers.exports.recentCategoryExposureFromRows(history),
});
assert.deepEqual(validateDailyTrio(g.trio),[]);
for(const r of Object.values(g.trio))assert.deepEqual(validateRound(r.categories,r.bank),[]);
for(const mode of ['easy','expert'])assert.deepEqual(codec.serializeRound(g.trio[mode]),codec.serializeRound(fixed[mode]));
const round=g.trio.normal,encoded=codec.encodeRound(round),payload=codec.serializeRound(round);
const publication={challenge_date:date,difficulty:'normal',seed:`DAILY-NORMAL-${date}`,encoded_board:encoded,board_payload:payload,board_hash:crypto.createHash('sha256').update(encoded).digest('hex'),rules_version:RULES_VERSION,dataset_version:DATASET_VERSION,category_set_version:CATEGORY_SET_VERSION};
const sourceIds=[...new Set(Object.values(g.trio).flatMap(r=>r.categories.map(d=>mapping[d.category.id])))];assert.ok(sourceIds.every(Boolean));
fs.writeFileSync(output,JSON.stringify({date,catalogSize:loaded.catalogSize,valid:true,preservedModes:['easy','expert'],sourceIds,publication,diagnostics:g.diagnostics},null,2)+'\n');
console.log(JSON.stringify({date,valid:true,preservedModes:['easy','expert'],replacementCategories:round.categories.map(d=>d.category.name)}));
