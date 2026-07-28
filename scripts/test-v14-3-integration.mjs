import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const rules = read("lib/gameRules.ts");
const semantics = read("lib/categorySemantics.ts");
const puzzle = read("lib/puzzleEngine.ts");
const engine = read("lib/dataEngine.ts");
const game = read("components/GeoSecondComingGame.tsx");
const adminBoardQuality = read("app/api/admin/dashboard/route.ts") + read("app/admin/AdminDashboard.tsx");
const dailyRoute = read("app/api/daily-trio/[date]/route.ts");
const scoreRoute = read("app/api/scores/route.ts");
const catalog = read("lib/playableCatalog.ts") + read("lib/serverPlayableCatalog.ts");
const worldBank = read("lib/worldBank.ts");
const worldBankAdmin = read("app/api/admin/import/world-bank/route.ts");
const migration = read("supabase/migrations/023_semantic_board_quality.sql");
const audit = read("scripts/audit-source-integrity.py") + read("scripts/data_pipeline/integrity.py") + read("scripts/data_pipeline/supabase.py");
const workflow = read(".github/workflows/audit-source-integrity.yml");
const version = read("lib/version.ts");

for (const token of [
  "MAX_BOARD_WINNER_GLOBAL_RANK = 30",
  "semanticConflict(item, category)",
  "new Set(categories.map(semanticFamily)).size",
  "strongestGlobalWinnerRank",
]) {
  if (!rules.includes(token)) throw new Error(`board rules missing ${token}`);
}
for (const token of [
  "labor-market-utilization",
  "forced-displacement-origin",
  "crop-yield",
  "MAX_SAME_BOARD_SEMANTIC_SIMILARITY",
]) {
  if (!semantics.includes(token)) throw new Error(`semantic classifier missing ${token}`);
}
if (!puzzle.includes("globalRank<=limit") || !puzzle.includes('?8:config.difficulty==="normal"?16:24')) {
  throw new Error("generator is not constrained and calibrated for top-30 board winners");
}
if (!engine.includes("winner.observation.globalRank > winnerLimit")) {
  throw new Error("round validation does not independently enforce the top-30 winner rule");
}
if (!game.includes('config.difficulty === "easy" ? 8 : config.difficulty === "normal" ? 16 : 24')) {
  throw new Error("client board optimization is not calibrated inside the top-30 rule");
}
for (const token of ["categorySemanticSimilarity", "similarityConflicts", "semanticSimilarityThreshold", "Cross-family similarity warnings"]) {
  if (!adminBoardQuality.includes(token)) throw new Error(`Admin semantic review missing ${token}`);
}
if ((dailyRoute.match(/validateRound\(/g) ?? []).length < 2) {
  throw new Error("stored and submitted Daily boards are not revalidated against current rules");
}
if (!scoreRoute.includes("no longer satisfies the current board-quality rules")) {
  throw new Error("score submissions do not reject stale pre-v14.3 boards");
}
for (const token of ["semantic_family", "semantic_topic"]) {
  if (!catalog.includes(token)) throw new Error(`playable catalog missing ${token}`);
  if (!migration.includes(token)) throw new Error(`migration missing ${token}`);
}
for (const token of ["employment.to.population", "unemployment", "forced-displacement-origin", "crop-yield", "board_semantic_conflicts", "category.validation_status='verified'", "Re-evaluate all existing concept groups"]) {
  if (!migration.includes(token)) throw new Error(`semantic backfill missing ${token}`);
}
for (const token of [
  "fetchWorldBankImportSnapshot",
  "Math.min(leftCoverage, 150) * 3",
  "observations.filter((observation) => Number(observation.year) === commonYear)",
]) {
  if (!worldBank.includes(token)) throw new Error(`World Bank common-year repair missing ${token}`);
}
for (const token of [
  'importSnapshotPolicy: "single-common-year"',
  '.select("review_status,curation_status,content_review_status',
  'const previouslyApproved = existing?.review_status === "approved" || existing?.curation_status === "approved"',
  'previouslyApproved\n          ? "approved"',
  "common_year: commonYear",
  "year: commonYear",
  "latestYear",
  "source_indicator_name: snapshot.officialSeriesName",
  "official_unit: snapshot.officialUnit",
]) {
  if (!worldBankAdmin.includes(token)) throw new Error(`World Bank Admin importer missing ${token}`);
}
for (const token of ["failureBuckets", "list_source_integrity_activation_blockers", "source-integrity-report.json", "units_compatible", 'str(row.get("curation_status") or "") == "approved"']) {
  if (!audit.includes(token)) throw new Error(`audit diagnostics missing ${token}`);
}
if (!workflow.includes("actions/upload-artifact@v4") || !workflow.includes("VERIFY_V14_3.sql")) {
  throw new Error("audit workflow does not preserve the v14.3 report");
}
const activationBlock = workflow.match(/activate_enforcement:[\s\S]*?default:\s*(true|false)/);
if (!activationBlock || activationBlock[1] !== "false") {
  throw new Error("audit workflow must default source-integrity activation to false");
}
if (!version.includes('APP_VERSION = "14.3.1"') || !version.includes('RULES_VERSION = "8.1"')) {
  throw new Error("v14.3 version identifiers are missing");
}
console.log("GeoStats v14.3 board-quality and World Bank repair integration checks passed.");
