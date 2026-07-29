import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const panel = read("components/CategorySourcePanel.tsx") + read("app/data/page.tsx") + read("app/audit/page.tsx");
const sourceLinks = read("lib/playerSourceLinks.ts");
const playable = read("lib/playableCatalog.ts") + read("lib/serverPlayableCatalog.ts");
const reviewRoute = read("app/api/admin/categories/review/route.ts");
const dashboard = read("app/admin/AdminDashboard.tsx") + read("app/api/admin/dashboard/route.ts");
const migration = read("supabase/migrations/024_content_comprehension_and_player_links.sql");
const workflow = read(".github/workflows/audit-player-source-links.yml");
const audit = read("scripts/audit-player-source-links.py");
const version = read("lib/version.ts");

for (const token of ["RAW_OR_DOWNLOAD_EXTENSION", "RAW_OR_DOWNLOAD_PATH", "worldBankPlayerSourceUrl", "resolvePlayerSourceUrl"]) {
  if (!sourceLinks.includes(token)) throw new Error(`player link policy missing ${token}`);
}
if ((panel.match(/resolvePlayerSourceUrl/g) ?? []).length < 3 || (panel.match(/View exact official data/g) ?? []).length < 3) {
  throw new Error("all player source surfaces must use the verified player-only URL");
}
for (const forbidden of ["exactQueryUrl || downloadUrl", "exactQueryUrl ?? category.downloadUrl", "Best available source link", "category.sourceUrl ?? categorySourceUrl", "View official query", "Download source data"]) {
  if (panel.includes(forbidden)) throw new Error(`player panel still exposes audit/download material: ${forbidden}`);
}
for (const token of ["content_review_status", "player_source_status", "link_quality_score", "immediate_comprehension_score", "gameplay_interest_score"]) {
  if (!playable.includes(token)) throw new Error(`playable catalog gate missing ${token}`);
  if (!reviewRoute.includes(token)) throw new Error(`admin approval gate missing ${token}`);
  if (!dashboard.includes(token)) throw new Error(`admin dashboard missing ${token}`);
  if (!migration.includes(token)) throw new Error(`migration missing ${token}`);
}
for (const token of ["Audit player source links", "actions/upload-artifact@v4", "scripts/audit-player-source-links.py"]) {
  if (!workflow.includes(token)) throw new Error(`player link workflow missing ${token}`);
}
for (const token of ["text/html", "Content-Disposition", "needs_exact_url", "record_player_source_validation"]) {
  if (!audit.includes(token)) throw new Error(`live player-link audit missing ${token}`);
}
if (!version.includes('APP_VERSION = "14.3.1"') || !version.includes('RULES_VERSION = "8.1"')) {
  throw new Error("v14.3.1 version/cache identifiers are missing");
}
console.log("GeoStats v14.3.1 content-trust integration checks passed.");
