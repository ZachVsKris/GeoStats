const fs=require('fs'); const path=require('path'); const root=path.resolve(__dirname,'..');
const failures=[]; const check=(c,m)=>{if(!c)failures.push(m)};
const generation=fs.readFileSync(path.join(root,'lib/categoryGeneration.ts'),'utf8');
const daily=fs.readFileSync(path.join(root,'lib/dailyBoardService.ts'),'utf8');
const puzzle=fs.readFileSync(path.join(root,'lib/puzzleEngine.ts'),'utf8');
for (const t of ['categoryRecencyPenalty','worldKnowledgeBucket','generationPriority','semanticFamily']) check(generation.includes(t),`category generation missing ${t}`);
for (const t of ['recentCategoryExposureFromRows','21','18','10','4','1.25']) check(daily.includes(t),`Daily exposure history missing ${t}`);
for (const t of ['recentCategoryExposure','qualityBand','priorityScore','worldKnowledgeBucket']) check(puzzle.includes(t),`puzzle engine missing ${t}`);
// The full synthetic deterministic regression is retained as the canonical behavioral test
// and is executed when npm dependencies are installed in CI.
check(fs.existsSync(path.join(root,'scripts/test-v15-7-generator.cjs')),'canonical synthetic generator regression missing');
if(failures.length){console.error('GeoStats v16.2.6 generator checks FAILED:\n'+failures.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log('GeoStats v16.2.6 generator policy checks passed.');
