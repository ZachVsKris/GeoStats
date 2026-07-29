import fs from "node:fs";
const must=["lib/categoryEditorialPolicy.ts","scripts/catalog-editorial-decisions-v15-6.csv","scripts/review-catalog-v15-6.py","supabase/migrations/031_v15_6_catalog_reset_real_expansion.sql","RUN_THIS_IN_SUPABASE_FOR_V15_6.sql"];
for(const f of must) if(!fs.existsSync(f)) throw new Error(`Missing ${f}`);
const trio=fs.readFileSync("lib/dailyTrioRules.ts","utf8");
for(const m of ["MAX_TRIO_DISPLACEMENT_CATEGORIES = 1","MAX_TRIO_DEMOGRAPHIC_CATEGORIES = 1"]) if(!trio.includes(m)) throw new Error(`Missing ${m}`);
console.log("v15.6 integration checks passed.");
