const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const files = [
  "supabase/migrations/043_v16_2_2_catalog_cleanup_historical_ui.sql",
  "supabase/migrations/044_v16_2_3_reliability_performance_history.sql",
  "supabase/migrations/045_v16_2_4_modes_variety_history.sql",
  "supabase/migrations/046_v16_2_5_ui_catalog_refinement.sql",
  "RUN_THIS_IN_SUPABASE_FOR_V16_2_5.sql","VERIFY_V16_2_5.sql","ROLLBACK_V16_2_5.sql",
];
function validateSqlLexically(name, sql) {
  let i=0, parens=0;
  while (i<sql.length) {
    const c=sql[i], n=sql[i+1];
    if (c==='-'&&n==='-'){i+=2;while(i<sql.length&&sql[i]!=='\n')i++;continue;}
    if (c==='/'&&n==='*'){const e=sql.indexOf('*/',i+2);if(e<0)throw new Error(`${name}: unterminated comment`);i=e+2;continue;}
    if (c==="'"){i++;let closed=false;while(i<sql.length){if(sql[i]==="'"){if(sql[i+1]==="'"){i+=2;continue;}i++;closed=true;break;}i++;}if(!closed)throw new Error(`${name}: unterminated string`);continue;}
    if (c==='"'){i++;let closed=false;while(i<sql.length){if(sql[i]==='"'){if(sql[i+1]==='"'){i+=2;continue;}i++;closed=true;break;}i++;}if(!closed)throw new Error(`${name}: unterminated identifier`);continue;}
    if(c==='$'){const m=sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);if(m){const tag=m[0],e=sql.indexOf(tag,i+tag.length);if(e<0)throw new Error(`${name}: unterminated ${tag}`);i=e+tag.length;continue;}}
    if(c==='(')parens++; if(c===')'){parens--;if(parens<0)throw new Error(`${name}: unmatched )`);} i++;
  }
  if(parens!==0)throw new Error(`${name}: unbalanced parentheses (${parens})`);
}
for(const file of files)validateSqlLexically(file,fs.readFileSync(path.join(root,file),'utf8'));
const installer=fs.readFileSync(path.join(root,"RUN_THIS_IN_SUPABASE_FOR_V16_2_5.sql"),'utf8');
for(const migration of ["supabase/migrations/044_v16_2_3_reliability_performance_history.sql","supabase/migrations/045_v16_2_4_modes_variety_history.sql","supabase/migrations/046_v16_2_5_ui_catalog_refinement.sql"]){
  const sql=fs.readFileSync(path.join(root,migration),'utf8').trim(); if(!installer.includes(sql))throw new Error(`v16.2.5 cumulative installer omits ${migration}`);
}
const m=fs.readFileSync(path.join(root,"supabase/migrations/046_v16_2_5_ui_catalog_refinement.sql"),'utf8');
if((m.match(/\('promote:/g)||[]).length!==33)throw new Error("v16.2.5 SQL does not contain 33 promotion targets");
if((m.match(/\('repair:/g)||[]).length!==30)throw new Error("v16.2.5 SQL does not contain 30 repair targets");
if(!m.includes("coalesce(consistency.daily_random_mismatches,0)"))throw new Error("v16.2.5 release guard lacks qualified Daily/Random consistency lookup");
if(!m.includes("protected_land_sea_disabled"))throw new Error("v16.2.5 release guard does not enforce protected land/sea removal");
console.log(`GeoStats v16.2.5 SQL lexical validation passed for ${files.length} release SQL files.`);
