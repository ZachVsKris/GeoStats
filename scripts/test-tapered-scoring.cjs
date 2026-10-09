const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'geostats-tapered-'));
for (const name of fs.readdirSync(path.join(root, 'lib'))) {
  if (!name.endsWith('.ts')) continue;
  const result = ts.transpileModule(fs.readFileSync(path.join(root, 'lib', name), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  fs.writeFileSync(path.join(output, name.replace(/\.ts$/, '.js')), result.outputText);
}
try {
  const { ROUND_CONFIGS, pointsForBankSize } = require(path.join(output, 'gameRules.js'));
  const { poolLeaderboard, scorePlacements } = require(path.join(output, 'dataEngine.js'));
  const { SCORING_VERSION } = require(path.join(output, 'version.js'));
  assert.equal(SCORING_VERSION, 'placements-tapered-v1');
  const expected = {
    easy: [100,65,45,25], normal: [100,70,45,25,10,0], expert: [100,75,55,40,25,15,5,0],
  };
  for (const [mode, points] of Object.entries(expected)) {
    const config = ROUND_CONFIGS[mode];
    assert.deepEqual(config.pointsByRank, points);
    assert.deepEqual(pointsForBankSize(config.countryCount), points);
    assert.equal(config.maxScore, config.categoryCount * 100);
    const bank = points.map((_, i) => ({ id: `C${i}` }));
    for (const direction of ['high', 'low']) {
      const ranked = bank.map((country, i) => ({ countryId: country.id, value: direction === 'high' ? points.length-i : i, globalRank: i+1 }));
      const dataset = { category: { id: 'test', name: 'Test', direction }, ranked, byCountry: new Map(ranked.map(r => [r.countryId,r])) };
      assert.deepEqual(poolLeaderboard(dataset, bank.slice().reverse()).map(r => r.points), points);
      for (let i=0; i<bank.length; i++) {
        const row = scorePlacements([dataset], bank, { test: bank[i].id })[0];
        assert.equal(row.selected.poolRank, i+1);
        assert.equal(row.selected.points, points[i]);
        assert.equal(row.best.country.id, bank[0].id);
      }
    }
    const gaps = points.slice(1).map((p,i) => points[i]-p);
    assert(gaps.every((g,i) => i === 0 || g <= gaps[i-1]));
    assert(points.every(p => p%5 === 0));
  }
  if (process.argv[2]) {
    const fixtures = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const totals = {};
    for (const fixture of fixtures) {
      const categories = fixture.board.categories.map(c => ({ ...c, byCountry: new Map(c.ranked.map(r => [r.countryId,r])) }));
      const rows = scorePlacements(categories, fixture.board.bank, fixture.assignments);
      totals[fixture.id] = rows.reduce((sum,r) => sum+r.selected.points,0);
      assert.equal(new Set(categories.map(c => poolLeaderboard(c,fixture.board.bank)[0].country.id)).size, categories.length);
    }
    if (process.argv[3]) {
      const sqlRows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
      assert.equal(sqlRows.length, fixtures.length);
      for (const row of sqlRows) assert.equal(row.new_score, totals[row.id], `SQL/client disagreement for saved result ${row.id}`);
    }
    console.log(`Verified ${fixtures.length} saved games against client scoring and unchanged distinct winners.`);
  }
  console.log('Tapered scoring: every rank, both ranking directions, maxima and diminishing gaps passed.');
} finally { fs.rmSync(output, { recursive: true, force: true }); }
