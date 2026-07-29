import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "geostats-v15-3-generator-"));
const sourceRoot = path.join(temporaryRoot, "src");
const outputRoot = path.join(temporaryRoot, "dist");
fs.cpSync(path.join(root, "lib"), sourceRoot, { recursive: true });

// Export the production composer only inside this temporary test copy. This
// exercises the real generation code without expanding the public API shipped
// by GeoStats.
const puzzlePath = path.join(sourceRoot, "puzzleEngine.ts");
fs.appendFileSync(
  puzzlePath,
  "\nexport { composeRound as __composeRoundForTest, datasetHasEnoughDisplayedVariety as __datasetHasEnoughDisplayedVarietyForTest };\n",
);

const nodeModules = path.join(temporaryRoot, "node_modules");
for (const directory of [
  "server-only",
  "next",
  "next/cache",
  "next/headers",
  "@supabase/ssr",
  "@supabase/supabase-js",
]) {
  fs.mkdirSync(path.join(nodeModules, directory), { recursive: true });
}

function packageStub(relative, source, declaration = "export {};") {
  const directory = path.join(nodeModules, relative);
  fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: relative, version: "0.0.0-test", main: "index.js", types: "index.d.ts" }));
  fs.writeFileSync(path.join(directory, "index.js"), source);
  fs.writeFileSync(path.join(directory, "index.d.ts"), declaration);
}

packageStub("server-only", "module.exports = {};\n");
packageStub("next", "module.exports = {};\n");
packageStub(
  "next/cache",
  "exports.unstable_cache = (fn) => fn;\n",
  "export declare function unstable_cache<T extends (...args: any[]) => any>(fn: T, keyParts?: string[], options?: any): T;\n",
);
packageStub("next/headers", "exports.cookies = async () => ({}); exports.headers = async () => ({});\n", "export declare function cookies(): Promise<any>; export declare function headers(): Promise<any>;\n");
packageStub("@supabase/ssr", "exports.createBrowserClient = () => ({}); exports.createServerClient = () => ({});\n", "export declare function createBrowserClient(...args: any[]): any; export declare function createServerClient(...args: any[]): any;\n");
packageStub("@supabase/supabase-js", "exports.createClient = () => ({});\n", "export type SupabaseClient = any; export declare function createClient(...args: any[]): any;\n");


fs.writeFileSync(path.join(sourceRoot, "test-globals.d.ts"), `
declare const process: { env: Record<string, string | undefined> };
declare module "crypto" {
  export function createHash(name: string): { update(value: string): any; digest(encoding: string): string };
}
`);

fs.writeFileSync(path.join(temporaryRoot, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "CommonJS",
    moduleResolution: "Node",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: outputRoot,
    rootDir: sourceRoot,
    lib: ["ES2022", "DOM"],
    noImplicitAny: false,
    types: [],
  },
  include: [path.join(sourceRoot, "**/*.ts")],
}, null, 2));

try {
  execFileSync("tsc", ["-p", path.join(temporaryRoot, "tsconfig.json"), "--pretty", "false"], {
    cwd: temporaryRoot,
    stdio: "pipe",
  });

  const puzzle = await import(path.join(outputRoot, "puzzleEngine.js"));
  const dataEngine = await import(path.join(outputRoot, "dataEngine.js"));
  const gameRules = await import(path.join(outputRoot, "gameRules.js"));
  const profilesModule = await import(path.join(outputRoot, "generationProfiles.js"));
  const trioRules = await import(path.join(outputRoot, "dailyTrioRules.js"));
  const valueRules = await import(path.join(outputRoot, "roundValueRules.js"));

  const composeRound = puzzle.__composeRoundForTest;
  const datasetHasEnoughDisplayedVariety = puzzle.__datasetHasEnoughDisplayedVarietyForTest;
  const { canonicalizeDataset, validateRound } = dataEngine;
  const { ROUND_CONFIGS } = gameRules;
  const { generationProfiles, sourceCapacityForProfile } = profilesModule;
  const { validateDailyTrio } = trioRules;
  const { displayedTieGroups } = valueRules;

  const continents = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
  const iso = (index) => String.fromCharCode(65 + Math.floor(index / 676) % 26)
    + String.fromCharCode(65 + Math.floor(index / 26) % 26)
    + String.fromCharCode(65 + index % 26);
  const countries = Array.from({ length: 72 }, (_, index) => ({
    id: iso(index),
    name: `Country ${index + 1}`,
    region: "Synthetic test",
    continent: continents[index % continents.length],
    flag: "🏳️",
    population: 1_000_000 + index * 100_000,
  }));
  const sources = ["worldbank", "faostat", "who", "unesco", "ilostat", "naturalearth", "comtrade", "eia", "unhcr"];
  const types = ["Population", "Economy", "Health", "Education", "Trade", "Geography", "Environment", "Energy", "Displacement", "Labor", "Agriculture", "Transport"];

  function makeDataset(index) {
    const source = sources[index % sources.length];
    const type = types[index % types.length];
    const preferredWinner = index % 36;
    return canonicalizeDataset({
      category: {
        id: `synthetic-${index}`,
        source,
        dataset: "Synthetic feasibility fixture",
        name: `Synthetic ${type.toLowerCase()} measure ${index}`,
        shortName: `Measure ${index}`,
        indicator: `SYN.${index}`,
        icon: "📊",
        unit: "points",
        family: type,
        direction: "high",
        description: `Unique objective synthetic measure ${index}`,
        decimals: 1,
        certified: true,
        certificationGrade: "A",
        coverageFloor: 50,
        globalCoverage: countries.length,
        commonYear: 2026,
        enabled: true,
        roundType: type,
        similarityGroup: `similarity-${index}`,
        semanticFamily: `semantic-family-${index}`,
        semanticTopic: `semantic-topic-${index}`,
        warehouseBacked: true,
        credibilityScore: 96,
        trustStatus: "approved",
        objectiveStatus: "objective",
      },
      observations: countries.map((country, countryIndex) => {
        const cyclicDistance = (countryIndex - preferredWinner + countries.length) % countries.length;
        return {
          countryId: country.id,
          countryName: country.name,
          value: 10_000 - cyclicDistance * 13 - index * 0.001,
          year: "2026",
        };
      }),
      year: "2026",
    });
  }

  const datasets = Array.from({ length: 90 }, (_, index) => makeDataset(index));

  // Each mode must be constructible under its published strict dimensions.
  for (const difficulty of ["easy", "normal", "expert"]) {
    const config = ROUND_CONFIGS[difficulty];
    assert.equal(datasetHasEnoughDisplayedVariety(datasets[0], config), true);
    const result = composeRound(
      datasets,
      countries,
      `single-${difficulty}`,
      config,
      [],
      [],
      1,
      Date.now() + 8_000,
    );
    assert.ok(result.round, `${difficulty} must remain mathematically composable`);
    assert.deepEqual(validateRound(result.round.categories, result.round.bank), []);
    for (const category of result.round.categories) {
      assert.equal(displayedTieGroups(category, result.round.bank.map((country) => country.id)).length, 0);
    }
  }

  // A full 4 + 6 + 8 Daily trio must remain possible with the adaptive source
  // profiles, distinct categories, at most one shared country, and all tie rules.
  let completed = false;
  for (const profile of generationProfiles()) {
    if (sourceCapacityForProfile(datasets.map((dataset) => dataset.category), profile) < 18) continue;
    for (let attempt = 0; attempt < 16 && !completed; attempt += 1) {
      const rounds = {};
      for (const difficulty of ["expert", "normal", "easy"]) {
        const existing = Object.values(rounds);
        const result = composeRound(
          datasets,
          countries,
          `trio-${profile.name}-${difficulty}-${attempt}`,
          profile.configs[difficulty],
          existing.flatMap((round) => round.categories.map((dataset) => dataset.category)),
          existing.map((round) => new Set(round.bank.map((country) => country.id))),
          1,
          Date.now() + 8_000,
        );
        if (!result.round) break;
        rounds[difficulty] = result.round;
      }
      if (rounds.easy && rounds.normal && rounds.expert && validateDailyTrio(rounds).length === 0) completed = true;
    }
    if (completed) break;
  }
  assert.equal(completed, true, "The combined tie-free Daily trio must remain feasible");
  console.log("GeoStats v15.3 synthetic Daily feasibility stress test passed.");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
