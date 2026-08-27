const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function check(ok,msg){if(!ok){console.error('FAIL:',msg);process.exitCode=1}}
const categories=read('lib/categories.ts');
const generation=read('lib/categoryGeneration.ts');
const puzzle=read('lib/puzzleEngine.ts');
const migration=read('supabase/migrations/048_v16_2_6_eligible_universe_recovery.sql');
const successors=read('scripts/historical_successors.py');
check(categories.includes('eligibleUniverseType?: "universal" | "defined_subset"'), 'Category eligibility metadata missing');
check(generation.includes('subsetExposureBoost') && generation.includes('categorySubsetExposureBoost'), 'Subset exposure correction missing');
check(puzzle.includes('+ categorySubsetExposureBoost(category, recentCategoryExposure)'), 'Generator does not use subset exposure correction');
check(migration.includes("eligible_universe_type in ('universal','defined_subset')"), 'Eligible-universe SQL constraint missing');
check(migration.includes('eligible_country_count,0)>=12') && migration.includes('>=16'), 'Subset playability floors missing');
check(migration.includes('common-year snapshot is incomplete') || migration.includes('common-year snapshot is incomplete'.replace('-','–')), 'Subset-completeness blocker missing');
check(successors.includes('USSR') && successors.includes('YUGOSLAVIA') && successors.includes('CZECHOSLOVAKIA') && successors.includes('SUDAN_PRE_2011'), 'Historical successor framework incomplete');
if(!process.exitCode) console.log('GeoStats v16.2.6 expansion-recovery static checks passed.');
