const fs=require('fs'); const path=require('path'); const root=path.resolve(__dirname,'..');
const failures=[]; const check=(c,m)=>{if(!c)failures.push(m)};
const game=fs.readFileSync(path.join(root,'lib/gameRules.ts'),'utf8');
const gen=fs.readFileSync(path.join(root,'lib/categoryGeneration.ts'),'utf8');
const puzzle=fs.readFileSync(path.join(root,'lib/puzzleEngine.ts'),'utf8');
const hist=fs.readFileSync(path.join(root,'scripts/import-historical-categories.py'),'utf8');
const cckp=fs.readFileSync(path.join(root,'scripts/import-world-bank-climate.py'),'utf8');
const wpp=fs.readFileSync(path.join(root,'scripts/import-un-wpp.py'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/054_v16_2_7_catalog_generator_rebuild.sql'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/rebuild-v16-2-7.yml'),'utf8');
const integrity=fs.readFileSync(path.join(root,'scripts/audit-source-integrity.py'),'utf8');
const reach=fs.readFileSync(path.join(root,'scripts/audit-v16-2-7-reachability.cjs'),'utf8');
const dataSources=fs.readFileSync(path.join(root,'lib/dataSources.ts'),'utf8');
const trust=fs.readFileSync(path.join(root,'lib/categoryTrust.ts'),'utf8');
const dataPage=fs.readFileSync(path.join(root,'app/data/page.tsx'),'utf8');
const serverCatalog=fs.readFileSync(path.join(root,'lib/serverPlayableCatalog.ts'),'utf8');
const serverWarehouse=fs.readFileSync(path.join(root,'lib/serverWarehouseCategories.ts'),'utf8');
const warehouseRoute=fs.readFileSync(path.join(root,'app/api/warehouse-category/route.ts'),'utf8');
const playerLinks=fs.readFileSync(path.join(root,'lib/playerSourceLinks.ts'),'utf8');
const naturalEarth=fs.readFileSync(path.join(root,'scripts/import-natural-earth.py'),'utf8');
const stageCatalog=fs.readFileSync(path.join(root,'scripts/stage-v16-2-7-catalog.py'),'utf8');
check(/MAX_BOARD_WINNER_GLOBAL_RANK\s*=\s*20/.test(game),'Top-20 winner rule missing');
check(!game.includes('isHistoricalCategory(category) ? Math.max(coverage'), 'history/date winner exemption remains');
check(dataPage.includes('verified global top 20') && !dataPage.includes('verified global top 30'),'player-facing data policy still documents Top 30');
check(serverCatalog.includes('.eq("computed_playable_v16_2", true)') && serverCatalog.includes('.eq("enabled", true)') && serverCatalog.includes('.eq("eligible_daily", true)'), 'production catalog loader can expose staged-but-unpublished categories');
check(serverWarehouse.includes('category.enabled !== true') && serverWarehouse.includes('category.eligible_daily !== true'), 'direct warehouse loader can expose staged-but-unpublished categories');
for(const t of ['unmembership','constitute','ipu','unwpp','worldbankclimate','imfweo','unescoich','noaatsunami','whoghed','undesamigrant','wtoservices','untourismdirect','fifa','ioc','worldbankhistory','globalfindex2025','faofra2025','unicefdata','undphdr','vdemv16','faostatfoodsecurity','koppengeiger','worldbankinfra','faostatlanduse','faostatworldcover','worldbankwbl','jmpwash','unwup2025','unwupcities2025']) {
  check(playerLinks.includes(`${t}:`), `player source fallback map omits ${t}`);
}
check(warehouseRoute.includes('\"untourism\"'), 'warehouse API allowlist omits legacy untourism');

for(const t of ['fifa','ioc','worldbankhistory','globalfindex2025','faofra2025','unicefdata','undphdr','vdemv16','faostatfoodsecurity','koppengeiger','worldbankinfra','faostatlanduse','faostatworldcover','worldbankwbl','jmpwash','unwup2025','unwupcities2025']) {
  check(serverWarehouse.includes(`${t}:`), `server warehouse source map omits ${t}`);
  check(warehouseRoute.includes(`"${t}"`), `warehouse API allowlist omits ${t}`);
}

for(const t of ['history','government-civics','culture-language-religion','sports','physical-geography','geology-natural-hazards','economy-finance','trade','food-agriculture']) check(gen.includes(`"${t}"`)||gen.includes(`${t}:`),`macro-domain missing ${t}`);
for(const t of ['weightedAnchorSample','generateAnchoredRoundFromLoadedCatalog','chooseSeededAnchoredCandidate']) check(puzzle.includes(t),`anchor-first generator missing ${t}`);
check(!puzzle.includes('.slice(0, 40)'), 'Random still uses the old 40-board strong-band prune');
check(!puzzle.includes('strongBand'), 'Random strong-band logic remains');
check(hist.includes('_mark_defined_subset') && hist.includes('universal suffrage record'), 'historical subset universe repair missing');
check(cckp.includes("(?:-\\d{2})?$") && cckp.includes('produced only'), 'CCKP YYYY-MM parsing/fail-closed coverage repair missing');
check(wpp.includes("'measurementType':('share' if vtype=='percentage'"), 'UN WPP measurement type constraint repair missing');
for(const t of ['category_decision_provenance_v16_2_7','apply_v16_2_7_legacy_reaudit','generator_reachability_v16_2_7','catalog_macro_domain_summary_v16_2_7','assert_v16_2_7_release']) check(migration.includes(t),`v16.2.7 migration missing ${t}`);
const incrementalGate=fs.readFileSync(path.join(root,'supabase/migrations/066_v16_2_7_balanced_incremental_publication_gate.sql'),'utf8');
for(const t of ['create or replace function public.assert_v16_2_7_release()','p<325','macro_n<12','history_n<5','culture_n<15','physical_n<20','concentrated_n::numeric/nullif(p,0)>0.63','bad<>0','unproved<>0','dups<>0']) check(incrementalGate.includes(t),`v16.2.7 incremental publication gate missing ${t}`);

for(const t of ['fertility-below-3','under-five-mortality-below-50','infant-mortality-below-25','mobile-subscriptions-50','crossing_direction']) check(hist.includes(t),`v16.2.7 history expansion missing ${t}`);
for(const t of ['globalfindex2025','faofra2025','unicefdata','undphdr','vdemv16','faostatfoodsecurity','koppengeiger','worldbankinfra','faostatlanduse','faostatworldcover','worldbankwbl','jmpwash','unwup2025','unwupcities2025']) {
  check(workflow.includes(t),`rebuild workflow omits ${t}`);
  check(integrity.includes(`"${t}"`),`independent integrity audit omits ${t}`);
}
check(workflow.includes('npm run check-v16-2-7') && workflow.includes('playwright install --with-deps chromium firefox webkit'),'rebuild preflight does not run full cross-browser frontend/e2e validation');
const playwright=fs.readFileSync(path.join(root,'playwright.config.ts'),'utf8');
for(const browser of ['Desktop Chrome','Desktop Edge','Desktop Firefox','Desktop Safari','Pixel 7','iPhone 13']) check(playwright.includes(browser),`cross-browser Playwright matrix missing ${browser}`);
for(const t of ['RANDOM_SAMPLES','DAILY_DAYS','generateSeededRoundFromLoadedCatalog','generateDailyTrioFromLoadedCatalog','missingAnchors','countryOpportunityCoverage','missingPewAnchors','history:un-admission']) check(reach.includes(t),`production diversity/reachability audit missing ${t}`);
for(const t of ['warehouseIdByGameplayId','gameplayIdByWarehouseId','warehouseCategoryId','gameplay_category_id','FORCED_ONLY','forcedReachabilityFailures','Ambiguous warehouse identity','No warehouse identity']) check(reach.includes(t),`reachability warehouse-id resolution/diagnostics missing ${t}`);
check(/case\s+"fifa"/.test(dataSources) && /case\s+"ioc"/.test(dataSources),'runtime data-source switch omits sports source ids');
check(/case\s+"fifa"/.test(trust) && /case\s+"ioc"/.test(trust),'category trust baselines omit sports sources');
const sports=fs.readFileSync(path.join(root,'scripts/import-sports-history.py'),'utf8');
const playable=fs.readFileSync(path.join(root,'lib/playableCatalog.ts'),'utf8');
for(const t of ['FIFAWorldCupImporter','IOCOlympicsImporter','eligible_universe_type','defined_subset']) check(sports.includes(t),`sports importer missing ${t}`);
for(const t of ['resolvedSourceId','sourceSlug','undesamigrant','untourismdirect','FIFA: "fifa"','International Olympic Committee','globalfindex2025','faofra2025','unicefdata','undphdr','vdemv16','faostatfoodsecurity','koppengeiger','worldbankinfra','faostatlanduse','faostatworldcover','worldbankwbl','jmpwash','unwup2025','unwupcities2025']) check(playable.includes(t),`source-family routing missing ${t}`);
for(const t of ['unsdg:true','United Nations Statistics Division']) check(playable.includes(t),`UN SDG source-family routing missing ${t}`);
for(const t of ['longest-average-land-border','highest-land-border-density','ELIGIBLE_UNIVERSES']) check(naturalEarth.includes(t),`physical-geography importer missing ${t}`);
check(stageCatalog.includes('apply_v16_2_7_physical_geography_curation'),'post-audit physical-geography curation is not staged');
if(failures.length){console.error('GeoStats v16.2.7 static checks FAILED:\n'+failures.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log('GeoStats v16.2.7 static rebuild checks passed.');
