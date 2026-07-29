import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rules = fs.readFileSync(path.join(root, "lib/gameRules.ts"), "utf8");
const trio = fs.readFileSync(path.join(root, "lib/dailyTrioRules.ts"), "utf8");
const profiles = fs.readFileSync(path.join(root, "lib/generationProfiles.ts"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/puzzleEngine.ts"), "utf8");

for (const marker of [
  "selected.some((item) => knowledgeCluster(item) === cluster)",
  "config.maxBroadDomain",
  "config.maxSameSource",
  "config.maxAgricultureCategories",
]) {
  if (!rules.includes(marker)) throw new Error(`Required board constraint missing: ${marker}`);
}
for (const marker of [
  "MAX_TRIO_RELIGION_CATEGORIES = 2",
  "MAX_TRIO_DISPLACEMENT_CATEGORIES = 2",
  "MIN_TRIO_PHYSICAL_CATEGORIES = 2",
  "MAX_TRIO_DEMOGRAPHICS_CATEGORIES = 2",
  "trioConceptConflict",
  "repeat the same or a near-identical concept across Daily modes",
]) {
  if (!trio.includes(marker)) throw new Error(`Required trio constraint missing: ${marker}`);
}
for (const marker of ["strict", "catalog-balanced", "catalog-recovery", "sourceCapacityForProfile"]) {
  if (!profiles.includes(marker)) throw new Error(`Adaptive generation profile missing: ${marker}`);
}
for (const marker of ["MAX_TRIO_ATTEMPTS_PER_PROFILE", "GENERATION_BUDGET_MS", "sourceCapacityForProfile"]) {
  if (!engine.includes(marker)) throw new Error(`Bounded generation safeguard missing: ${marker}`);
}

// The full production composer is exercised by test-v15-4-generator-feasibility.mjs.
// This regression guard confirms the new cultural cap was added without removing
// the adaptive fallback and capacity protections that keep generation feasible.
console.log("GeoStats v15.5 generation-capacity checks passed.");
