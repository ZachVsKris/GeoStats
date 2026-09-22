const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const migrationPath = "supabase/migrations/20260922010000_restore_final_reviewed_catalog.sql";
const before = fs.readFileSync(migrationPath, "utf8");
execFileSync(process.execPath, ["scripts/prepare-final-catalog-restoration.cjs"], { stdio: "pipe" });
const after = fs.readFileSync(migrationPath, "utf8");
assert.equal(after, before, "Final catalog migration must be reproducible from reviewed audit evidence");

assert.match(after, /not in \(336,354\)/, "Migration must accept only the audited baseline or its idempotent final state");
assert.match(after, /<> 354/, "Migration must pin the final reviewed catalog size");
assert.match(after, /count\(\*\) from final_catalog_repairs\) <> 18/, "Migration must repair exactly 18 categories");
assert.match(after, /assert_v16_3_4_runtime_catalog/, "Migration must run the runtime catalog safety assertion");
assert.match(after, /source-suitability retirement was re-enabled/i, "Migration must preserve source-suitability retirements");

const payloadMatch = after.match(/\$repairs\$(\[.*\])\$repairs\$/);
assert.ok(payloadMatch, "Migration must contain a bounded repair payload");
const repairs = JSON.parse(payloadMatch[1]);
assert.equal(repairs.length, 18);
assert.equal(new Set(repairs.map((repair) => repair.id)).size, 18);
assert.equal(repairs.flatMap((repair) => repair.proofs).length, 54);
for (const repair of repairs) {
  assert.deepEqual(repair.proofs.map((proof) => proof.difficulty).sort(), ["easy", "expert", "normal"]);
  for (const proof of repair.proofs) {
    assert.equal(proof.reachable, true);
    assert.ok(proof.witness.categories.includes(repair.id));
    assert.equal(proof.witness.categories.length, proof.difficulty === "expert" ? 6 : 4);
    assert.equal(proof.witness.countries.length, proof.difficulty === "easy" ? 4 : proof.difficulty === "normal" ? 6 : 8);
  }
}

console.log("PASS: final catalog restoration is bounded, reproducible, and release-guarded");
