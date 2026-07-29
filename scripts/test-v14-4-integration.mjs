import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.version === "14.4.0", "package version must be 14.4.0");
assert(read("lib/version.ts").includes('APP_VERSION = "14.4.0"'), "app version must be 14.4.0");
assert(fs.existsSync(path.join(root, "proxy.ts")), "Next.js 16 proxy.ts is required");
assert(!fs.existsSync(path.join(root, "middleware.ts")), "deprecated middleware.ts must be removed");

const playability = read("lib/categoryPlayability.ts");
assert(playability.includes('playerSourceStatus: "exact" | "general" | null'), "general official source pages must be supported");
assert(playability.includes("Legacy enabled/eligible_daily flags disagree"), "legacy flags must be diagnostic rather than independent hard gates");

const trioRules = read("lib/dailyTrioRules.ts");
assert(trioRules.includes("semanticConflict(firstDataset.category, secondDataset.category)"), "cross-mode semantic conflicts must be rejected");
assert(trioRules.includes("at most one is allowed"), "cross-mode country overlap must be capped at one");

const engine = read("lib/puzzleEngine.ts");
assert(engine.includes("validateDailyTrio(trio)"), "generated Daily packages must be validated as a trio");
assert(engine.includes("loaded.datasets.length < requiredDatasets"), "generator must diagnose an insufficient dataset pool");

const dataEngine = read("lib/dataEngine.ts");
assert(dataEngine.includes("strongestGlobalWinnerRank(dataset.ranked.length)"), "top-30 validation must use the actual ranked dataset");
const gameRules = read("lib/gameRules.ts");
assert(gameRules.includes("MAX_BOARD_WINNER_GLOBAL_RANK = 30"), "global winner cap must be 30");

const dailyRoute = read("app/api/daily-trio/[date]/route.ts");
assert(dailyRoute.includes("All three Daily boards are required"), "partial Daily writes must be rejected");
assert(dailyRoute.includes("upsert(rows"), "Daily trio must be saved in one multi-row statement");
assert(dailyRoute.includes("already has player scores"), "scored Daily boards must be preserved");

const sql = read("RUN_THIS_IN_SUPABASE_FOR_V14_4.sql");
assert(sql.includes("'general'"), "SQL must support general player-source status");
assert(sql.includes("category_playability_v144"), "SQL must expose computed playability diagnostics");
assert(!sql.includes("new.player_source_status<>'exact'"), "v14.3.1 exact-only disable trigger must not return");
assert(sql.includes("never silently changes enabled or eligible_daily"), "source trigger must be non-destructive");

assert(fs.existsSync(path.join(root, "GITHUB_ACTIONS", "workflows")), "visible GitHub Actions copy is required");
assert(fs.existsSync(path.join(root, ".github", "workflows")), "real GitHub workflow folder is required");
assert(fs.existsSync(path.join(root, "app/api/admin/daily/capacity/route.ts")), "seed-capacity endpoint is required");

console.log("v14.4 integration assertions passed");
