const assert = require('node:assert/strict');
const {load} = require('./test-catalog-recovery.cjs');
const {buildCategoryRegistry} = load('lib/playableCatalog.ts');
const {isPreservedOwnerRetirement} = load('lib/ownerCategoryRetirements.ts');
const notes = require('../audits/owner-review-2026-09-08.json');
for(const row of require('./fixtures/owner-review-copy.json')) {
  const note=notes.find(n=>n.id===row.id);
  const [category]=buildCategoryRegistry([{...row,metadata:{...row.metadata,ownerReviewTitle:note.new_title,ownerReviewDescription:note.new_description}}]);
  assert.ok(category,row.id);
  assert.equal(category.boardDescription,note.new_description);
  if(note.new_title)assert.equal(category.name,note.new_title.replace('{year}',String(row.common_year)));
  // A source refresh must update the displayed growth year rather than freezing 2025.
  if(row.id==='gdpGrowth') {
    const [next]=buildCategoryRegistry([{...row,common_year:2026,metadata:{ownerReviewTitle:note.new_title}}]);
    assert.ok(next.name.endsWith('2026'));
  }
}
assert.ok(isPreservedOwnerRetirement('arablePct','2026-09-08'));
assert.ok(!isPreservedOwnerRetirement('arablePct','2026-09-09'));
assert.ok(!isPreservedOwnerRetirement('unrelated-invalid-category','2026-09-08'));
assert.ok(!isPreservedOwnerRetirement('arablePct',''));
assert.equal(notes.filter(n=>n.action==='retire').length,49);
console.log('Owner review copy, refreshed years, and dated-board retirement checks passed');
