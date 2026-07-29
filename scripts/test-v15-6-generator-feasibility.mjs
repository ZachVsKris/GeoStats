import fs from "node:fs";
const rules=fs.readFileSync("lib/dailyTrioRules.ts","utf8");
if(!rules.includes("MIN_TRIO_PHYSICAL_CATEGORIES = 2")) throw new Error("Physical target missing");
if(!rules.includes("MAX_TRIO_RELIGION_CATEGORIES = 2")) throw new Error("Religion cap missing");
console.log("v15.6 generator policy checks passed.");
