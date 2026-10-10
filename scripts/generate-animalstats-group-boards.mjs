import fs from 'node:fs';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const dir=fs.mkdtempSync('/tmp/groups-');
try {
 for(const n of ['categorySemantics','gameRules','animalstats','animalstatsCoverage','animalstatsComposition']) fs.writeFileSync(`${dir}/${n}.mjs`,ts.transpileModule(fs.readFileSync(`lib/${n}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 const {createAnimalBoardValidator,validateAnimalDataset}=await import(pathToFileURL(`${dir}/animalstats.mjs`));
 const {publishedAnimalTraitIds,animalMajorGroup}=await import(pathToFileURL(`${dir}/animalstatsCoverage.mjs`));
 const {animalBoardComposition}=await import(pathToFileURL(`${dir}/animalstatsComposition.mjs`));
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
 const d=Object.fromEntries(['animals','traits','values','sources','photos'].map(k=>[k,parts.flatMap(p=>p[k])]));
 const errors=validateAnimalDataset(d);if(errors.length)throw new Error(errors.join("\n"));
 const pub=publishedAnimalTraitIds(d),validate=createAnimalBoardValidator(d),vm=new Map(d.values.filter(v=>v.confidence==='approved').map(v=>[v.animalId+':'+v.traitId,v]));
 const portraits=new Set(d.photos.filter(p=>p.approved).map(p=>p.animalId));
 const groups={reptiles:['lizard','snake','turtle','crocodilian','reptile'],amphibians:['frog','salamander'],fish:['fish','shark','ray'],invertebrates:['insect','bivalve','crustacean','echinoderm'],mammals:null};
 const existing=JSON.parse(fs.readFileSync('data/animalstats/group-boards.json')).boards;
 const out=existing.filter(b=>b.traitIds.every(t=>pub.has(t))&&validate(b).valid&&animalBoardComposition(d,b).eligible),seen=new Set(out.map(b=>b.id));
 function* combos(a,n,s=0,p=[]){if(!n){yield p;return;}for(let i=s;i<=a.length-n;i++)yield*combos(a,n-1,i+1,[...p,a[i]]);}
 for(const [group,types] of Object.entries(groups)) {
  const animals=d.animals.filter(a=>a.active&&a.familiarityTier!=='edge'&&portraits.has(a.id)&&(types?types.includes(a.taxonomicGroup):animalMajorGroup(a)==='mammals'&&a.entityType!=='breed'));
  if(animals.length<4) continue;
  for(const mode of ['easy','normal']) {
   const start=out.length,existingModeCount=out.filter(b=>b.title===group&&b.mode===mode).length,n=mode==='easy'?4:6;
   if(existingModeCount>=1000)continue;const maximumNew=Math.min(500,1000-existingModeCount);
   if(animals.length<n)continue;
   // Reproducible sampled lineups avoid both combinatorial blow-up and always
   // placing the alphabetically first animals in every newly generated board.
   let seed=parseInt(createHash('sha256').update(group+mode).digest('hex').slice(0,8),16);
   const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
   const lineups=new Set();let attempts=0;
   while(out.length-start<maximumNew&&attempts++<4000){
    const shuffled=[...animals];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    const aa=shuffled.slice(0,n).sort((a,b)=>a.id.localeCompare(b.id)),ids=aa.map(a=>a.id),lineup=ids.join(',');
    if(lineups.has(lineup)||aa.filter(a=>a.taxonomicGroup==='bat').length>1)continue;lineups.add(lineup);
    const shell={animalIds:ids,traitIds:[],mode};if(animalBoardComposition(d,shell).familiar<(n===4?1:2))continue;
    const tt=d.traits.filter(t=>{
     if(!pub.has(t.id)||t.id.startsWith('adult_shoulder_height')||!ids.every(id=>vm.has(id+':'+t.id)))return false;
     const vv=ids.map(id=>vm.get(id+':'+t.id)).sort((a,b)=>a.valueNumeric-b.valueNumeric);
     if(new Set(vv.map(v=>v.sex)).size>1||new Set(vv.map(v=>v.lifeStage)).size>1)return false;
     return vv.every((v,i)=>!i||((v.valueMin??v.valueNumeric)>(vv[i-1].valueMax??vv[i-1].valueNumeric)&&(t.separationMethod!=='positive_ratio_5_percent'||v.valueNumeric/vv[i-1].valueNumeric>=1.05)));
    });
    let added=0;const already=out.filter(b=>b.title===group&&b.mode===mode&&[...b.animalIds].sort().join(',')===lineup).length;if(already>=4)continue;
    for(const traits of combos(tt,4)){
     if(traits.filter(t=>t.categoryKind==='intuitive').length<3||new Set(traits.map(t=>t.metricKey)).size!==4||traits.filter(t=>t.gameplayFamily==='environment').length>2)continue;
     const winners=traits.map(t=>[...ids].sort((a,b)=>(vm.get(a+':'+t.id).valueNumeric-vm.get(b+':'+t.id).valueNumeric)*(t.direction==='higher_wins'?-1:1))[0]);
     if(new Set(winners).size!==4)continue;
     const b={id:'groups-'+group+'-'+mode+'-'+createHash('sha256').update(lineup+'|'+traits.map(t=>t.id).join(',')).digest('hex').slice(0,12),title:group,collection:'living',boardType:'themed',mode,animalIds:ids,traitIds:traits.map(t=>t.id),editorial:{policy:'intuitive-majority-distinct-winners-v5',intuitiveMinimum:3}};
     if(seen.has(b.id))continue;
     if(validate(b).valid&&animalBoardComposition(d,b).eligible){out.push(b);seen.add(b.id);added++;}
     if(added+already>=4||out.length-start>=maximumNew)break;
    }
   }
   console.log(group,mode,'added',out.length-start,'sampled lineups',lineups.size);
  }
 }
 fs.writeFileSync('data/animalstats/group-boards.json',JSON.stringify({boards:out})+'\n');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
