const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  "supabase/migrations/043_v16_2_2_catalog_cleanup_historical_ui.sql",
  "supabase/migrations/044_v16_2_3_reliability_performance_history.sql",
  "supabase/migrations/045_v16_2_4_modes_variety_history.sql",
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql",
  "VERIFY_V16_2_4.sql",
  "ROLLBACK_V16_2_4.sql",
];

function validateSqlLexically(name, sql) {
  let i = 0;
  let parens = 0;
  const length = sql.length;
  while (i < length) {
    const c = sql[i];
    const n = sql[i + 1];
    if (c === "-" && n === "-") { i += 2; while (i < length && sql[i] !== "\n") i += 1; continue; }
    if (c === "/" && n === "*") { const end = sql.indexOf("*/", i + 2); if (end < 0) throw new Error(`${name}: unterminated block comment`); i = end + 2; continue; }
    if (c === "'") {
      i += 1; let closed = false;
      while (i < length) {
        if (sql[i] === "'") { if (sql[i + 1] === "'") { i += 2; continue; } i += 1; closed = true; break; }
        i += 1;
      }
      if (!closed) throw new Error(`${name}: unterminated single-quoted string`);
      continue;
    }
    if (c === '"') {
      i += 1; let closed = false;
      while (i < length) { if (sql[i] === '"') { if (sql[i + 1] === '"') { i += 2; continue; } i += 1; closed = true; break; } i += 1; }
      if (!closed) throw new Error(`${name}: unterminated double-quoted identifier`);
      continue;
    }
    if (c === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { const tag = match[0]; const end = sql.indexOf(tag, i + tag.length); if (end < 0) throw new Error(`${name}: unterminated dollar-quoted block ${tag}`); i = end + tag.length; continue; }
    }
    if (c === "(") parens += 1;
    if (c === ")") { parens -= 1; if (parens < 0) throw new Error(`${name}: closing parenthesis without opener near byte ${i}`); }
    i += 1;
  }
  if (parens !== 0) throw new Error(`${name}: unbalanced parentheses (${parens})`);
  if (/Project's Constitute service/.test(sql)) throw new Error(`${name}: unescaped Constitute apostrophe regression`);
}

for (const file of files) validateSqlLexically(file, fs.readFileSync(path.join(root, file), "utf8"));
const installer = fs.readFileSync(path.join(root, "RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql"), "utf8");
const migration164 = fs.readFileSync(path.join(root, "supabase/migrations/045_v16_2_4_modes_variety_history.sql"), "utf8");
for (const [name, sql] of [["RUN_THIS_IN_SUPABASE_FOR_V16_2_4.sql", installer], ["045_v16_2_4_modes_variety_history.sql", migration164]]) {
  if (/select\s+coalesce\(daily_random_mismatches\s*,/i.test(sql)) {
    throw new Error(`${name}: assert_v16_2_4_release must qualify category_catalog_consistency_v16_2.daily_random_mismatches to avoid PL/pgSQL output-parameter ambiguity`);
  }
  if (!/coalesce\(consistency\.daily_random_mismatches\s*,\s*0\)/i.test(sql) || !/from\s+public\.category_catalog_consistency_v16_2\s+as\s+consistency/i.test(sql)) {
    throw new Error(`${name}: missing qualified Daily/Random consistency lookup in assert_v16_2_4_release`);
  }
}
for (const migration of [
  "supabase/migrations/044_v16_2_3_reliability_performance_history.sql",
  "supabase/migrations/045_v16_2_4_modes_variety_history.sql",
]) {
  const sql = fs.readFileSync(path.join(root, migration), "utf8").trim();
  if (!installer.includes(sql)) throw new Error(`v16.2.4 cumulative installer omits ${migration}`);
}
console.log(`GeoStats v16.2.4 SQL lexical validation passed for ${files.length} release SQL files.`);
