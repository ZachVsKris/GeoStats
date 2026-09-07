// Read-only against live-source exports. Bounded failures are unresolved, never deletions.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {load}=require('./test-catalog-recovery.cjs');
const {loadAuditExport}=require('./load-audit-export.cjs');
const {loaded,countries,mapping,hashes}=loadAuditExport(process.argv[2]);
const mode=process.argv[3],output=process.argv[4];
const {generateAnchoredRoundFromLoadedCatalog,generateDailyTrioFromLoadedCatalog,selectSeededAnchorCategoryId}=load('lib/puzzleEngine.ts');
const {validateRound}=load('lib/dataEngine.ts');
const {validateDailyTrio}=load('lib/dailyTrioRules.ts');
const {ROUND_CONFIGS,semanticFamily}=load('lib/gameRules.ts');
const {worldKnowledgeBucket}=load('lib/categoryGeneration.ts');
const {RULES_VERSION}=load('lib/version.ts');
const result={catalogSize:loaded.catalogSize,rulesVersion:RULES_VERSION,startedAt:new Date().toISOString(),sourceHashes:hashes,mode};
function save(){fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n')}
if(mode==='reachability'){
  result.proofs=[];
  for(const d of loaded.datasets){
    for(const difficulty of d.category.playableDifficulties??['easy','normal','expert']){
      try{
        const g=generateAnchoredRoundFromLoadedCatalog(countries,d.category.id,difficulty,loaded,`LIVE-414-${difficulty}-${d.category.id}`,true);
        assert.deepEqual(validateRound(g.round.categories,g.round.bank),[]);
        assert.ok(g.round.categories.some(x=>x.category.id===d.category.id));
        result.proofs.push({category_id:mapping[d.category.id],difficulty,reachable:true,witness:{categories:g.round.categories.map(x=>x.category.id),countries:g.round.bank.map(c=>c.id)}});
      }catch(e){result.proofs.push({category_id:mapping[d.category.id],difficulty,reachable:null,error:e.message});}
    }
    if(result.proofs.length%30===0){save();console.log(`${result.proofs.length} mode checks; unresolved ${result.proofs.filter(p=>!p.reachable).length}`)}
  }
  result.unresolved=result.proofs.filter(p=>p.reachable!==true);
  result.expectedModeChecks=loaded.datasets.reduce((n,d)=>n+(d.category.playableDifficulties??['easy','normal','expert']).length,0);
  assert.equal(result.proofs.length,result.expectedModeChecks);
  if(result.unresolved.length)process.exitCode=1;
}else if(mode==='capacity'){
  const {estimatePlayableBoardCapacity}=load('lib/seedCapacity.ts');
  result.modes={};
  for(const difficulty of ['easy','normal','expert']){
    result.modes[difficulty]=estimatePlayableBoardCapacity(loaded.datasets,countries,ROUND_CONFIGS[difficulty],{samples:3000,budgetMs:80000,perSetBudgetMs:20});
    save();console.log(difficulty+': '+JSON.stringify(result.modes[difficulty]));
  }
}else if(mode==='freshness'){
  result.days=[];result.anchors={};
  result.anchorSamplesPerMode=3000;
  for(const difficulty of ['easy','normal','expert']){for(let n=0;n<result.anchorSamplesPerMode;n++){
    const id=selectSeededAnchorCategoryId(`LIVE-414-${difficulty}-${n}`,difficulty,loaded);assert.ok(id);
    result.anchors[id]=(result.anchors[id]??0)+1;
  }save();console.log(`${difficulty}: anchor samples complete`);}
  const history=[];
  for(let n=0;n<30;n++){
    const recentCategoryExposure={category:{},family:{},bucket:{}},recentCountryExposure={};
    for(const [i,trio] of [...history].reverse().slice(0,21).entries())for(const r of Object.values(trio)){
      const w=i<3?18:i<7?10:i<14?4:1.25;
      for(const d of r.categories){const c=d.category,f=semanticFamily(c),b=worldKnowledgeBucket(c);recentCategoryExposure.category[c.id]=Math.max(recentCategoryExposure.category[c.id]??0,w);recentCategoryExposure.family[f]=(recentCategoryExposure.family[f]??0)+w;recentCategoryExposure.bucket[b]=(recentCategoryExposure.bucket[b]??0)+w;}
      if(i<7)for(const c of r.bank)recentCountryExposure[c.id]=(recentCountryExposure[c.id]??0)+7-i;
    }
    const date=new Date(Date.UTC(2026,8,8+n)).toISOString().slice(0,10);
    try{
      const g=generateDailyTrioFromLoadedCatalog(countries,date,loaded,{},'RELEASE-AUDIT',{budgetMs:30000,candidateTarget:40,jointSearch:true,jointFirst:true,recentCategoryExposure,recentCountryExposure});
      assert.deepEqual(validateDailyTrio(g.trio),[]);for(const r of Object.values(g.trio))assert.deepEqual(validateRound(r.categories,r.bank),[]);
      history.push(g.trio);result.days.push({date,valid:true,modes:Object.fromEntries(Object.entries(g.trio).map(([mode,r])=>[mode,{categories:r.categories.map(d=>d.category.id),countries:r.bank.map(c=>c.id)}]))});
    }catch(e){result.days.push({date,valid:false,error:e.message});}
    save();console.log(`${date}: ${result.days.at(-1).valid}`);
  }
  const valid=result.days.filter(d=>d.valid),categoryDays={},countryDays={};
  for(const d of valid){
    for(const id of new Set(Object.values(d.modes).flatMap(m=>m.categories)))categoryDays[id]=(categoryDays[id]??0)+1;
    for(const id of new Set(Object.values(d.modes).flatMap(m=>m.countries)))countryDays[id]=(countryDays[id]??0)+1;
  }
  result.summary={validDays:valid.length,failedDays:result.days.length-valid.length,anchorCategories:Object.keys(result.anchors).length,representedCategories:Object.keys(categoryDays).length,representedCountries:Object.keys(countryDays).length,mostFrequentCategoryDays:Math.max(0,...Object.values(categoryDays)),categoryDays,countryDays};
  if(result.summary.failedDays)process.exitCode=1;
}else throw Error('Choose reachability, capacity or freshness');
result.completedAt=new Date().toISOString();save();
console.log(JSON.stringify({mode,completed:true,catalogSize:loaded.catalogSize,unresolved:result.unresolved?.length}));
