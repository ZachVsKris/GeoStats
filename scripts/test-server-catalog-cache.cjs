const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { load } = require('./test-catalog-recovery.cjs');
const actual = load('lib/playableCatalog.ts');
const fixtures = require('./fixtures/runtime-catalog-drift-2026-09-07.json');
async function run(rows, cap, expectedError) {
  const offsets = [], sizes = [];
  const admin = { from() { return {
    select() { return this; }, eq() { return this; }, order() { return this; },
    async range(from, to) { offsets.push(from); return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }; },
  }; } };
  const code = ts.transpileModule(fs.readFileSync('lib/serverPlayableCatalog.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mocks = {
    'server-only': {}, './playableCatalog': actual,
    './supabase/server': { createSupabaseAdminClient: () => admin },
    './version': { PLAYABLE_CATALOG_CACHE_VERSION: 'test' },
    'next/cache': { unstable_cache: fn => async (...args) => {
      const result = await fn(...args); sizes.push(Buffer.byteLength(JSON.stringify(result))); return result;
    } },
  };
  const mod = { exports: {} };
  new Function('require','module','exports',code)(id => { assert.ok(id in mocks, id); return mocks[id]; },mod,mod.exports);
  if (expectedError) return assert.rejects(mod.exports.loadServerPlayableCategoryCatalog(), expectedError);
  const result = await mod.exports.loadServerPlayableCategoryCatalog();
  assert.equal(result.length, rows.length);
  assert.equal(offsets.at(-1), rows.length, 'Continue after capped or partially filtered pages');
  assert.ok(sizes.every(size => size < 2 * 1024 * 1024), 'Every cached value stays below the provider limit');
}
(async () => {
  await run(fixtures, 1);
  await run(fixtures, 100);
  await run([fixtures[0], fixtures[0]], 1, /identity collision/);
  console.log('Server catalog bounded-page cache behavior passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
