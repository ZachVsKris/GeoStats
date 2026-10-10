import fs from 'node:fs';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const temp=fs.mkdtempSync('/tmp/animal-expert-');
try {
 for(const name of ['categorySemantics','gameRules','animalstats','animalstatsCoverage','animalstatsComposition'])fs.writeFileSync(`${temp}/${name}.mjs`,ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 const {createAnimalBoardValidator,validateAnimalDataset}=await import(pathToFileURL(`${temp}/animalstats.mjs`));
 const {publishedAnimalTraitIds,animalMajorGroup}=await import(pathToFileURL(`${temp}/animalstatsCoverage.mjs`));
 const {animalBoardComposition}=await import(pathToFileURL(`${temp}/animalstatsComposition.mjs`));
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
 const marine=parts[4],data=Object.fromEntries(['animals','traits','values','sources','photos'].map(k=>[k,parts.flatMap(p=>p[k].filter(r=>k!=='photos'||p===marine||!marine.photos.some(photo=>photo.animalId===r.animalId)))]));
 const errors=validateAnimalDataset(data);if(errors.length)throw Error(errors.join('\n'));
 const validate=createAnimalBoardValidator(data),published=publishedAnimalTraitIds(data),photos=new Set(data.photos.filter(p=>p.approved).map(p=>p.animalId));
 const traits=data.traits.filter(t=>published.has(t.id)&&!t.id.startsWith('adult_shoulder_height'));
 const values=new Map(data.values.filter(v=>v.confidence==='approved'&&v.observationType!=='imputed').map(v=>[v.animalId+':'+v.traitId,v]));
 const metricMasks=new Map(),bit=i=>1n<<BigInt(i);
 traits.forEach((t,i)=>metricMasks.set(t.metricKey,(metricMasks.get(t.metricKey)??0n)|bit(i)));
 const metricCount=mask=>{let count=0;for(const m of metricMasks.values())if(mask&m)count++;return count;};
 const canonical=(a,t)=>{const v=values.get(a.id+':'+t.id);return v&&v.sourceId===t.canonicalSourceId&&v.unit===t.unit&&v.measurementBasis===t.measurementBasis&&(!t.eligibilityGroups.length||t.eligibilityGroups.includes(a.taxonomicGroup));};
 const personal=new Map(data.animals.map(a=>[a.id,traits.reduce((m,t,i)=>canonical(a,t)?m|bit(i):m,0n)]));
 const key=b=>b.mode+'|'+[...b.animalIds].sort().join(',')+'|'+[...b.traitIds].sort().join(',');
 const boards=['group-boards','group-boards-2'].flatMap(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)).boards),seen=new Set(boards.map(key));
 const marineIds=new Set(JSON.parse(fs.readFileSync('data/animalstats/research/marine-admission.json')).marineAnimalIds);
 for(const a of data.animals)if(a.taxonomicGroup==='marine-mammal')marineIds.add(a.id);
 const groups=['birds','dogs','cats','reptiles','amphibians','fish','insects','invertebrates','mammals','mixed','marine'];
 const seconds=Number(process.env.ANIMAL_EXPERT_SECONDS??12);if(!Number.isFinite(seconds)||seconds<=0)throw Error('ANIMAL_EXPERT_SECONDS must be positive');
 const report={policy:'3%-numeric-no-ties',algorithm:'Backtracking with intersections of shared trait masks and pairwise compatibility. Runtime budget is explicit; timed-out searches do not establish impossibility.',groups:[]};
 for(const group of groups.filter(name=>!process.env.ANIMAL_EXPERT_GROUPS||process.env.ANIMAL_EXPERT_GROUPS.split(',').includes(name))){
  const pool=data.animals.filter(a=>a.active&&(a.extinctionStatus??'living')==='living'&&a.familiarityTier!=='edge'&&photos.has(a.id)&&metricCount(personal.get(a.id))>=6).filter(a=>group==='mixed'?a.entityType!=='breed':group==='marine'?marineIds.has(a.id):group==='dogs'?a.taxonomicGroup==='dog-breed':group==='cats'?a.taxonomicGroup==='cat-breed':group==='birds'?a.taxonomicGroup==='bird':group==='insects'?a.taxonomicGroup==='insect':group==='invertebrates'?['insect','bivalve','gastropod','cephalopod','mollusc','crustacean','echinoderm','arachnid','cnidarian','chelicerate','annelid','sponge'].includes(a.taxonomicGroup):animalMajorGroup(a)===group);
  const row={group,animals:pool.length,states:0,compatibleEightAnimalLineups:0,added:0,exhaustive:false,rejections:{}};report.groups.push(row);if(pool.length<8){row.exhaustive=true;row.rejections['fewer than eight animals with six metrics']=1;continue;}
  // Shuffle once reproducibly. Index-ordered traversal then examines every
  // subset at most once, instead of repeatedly sampling the same dense pool.
  let seed=parseInt(createHash('sha256').update(group+boards.length).digest('hex').slice(0,8),16);
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const pair=pool.map(()=>[]);
  for(let i=0;i<pool.length;i++)for(let j=0;j<i;j++){
   let mask=personal.get(pool[i].id)&personal.get(pool[j].id);
   traits.forEach((t,k)=>{if(!(mask&bit(k)))return;const a=values.get(pool[i].id+':'+t.id),b=values.get(pool[j].id+':'+t.id),lo=Math.min(a.valueNumeric,b.valueNumeric),hi=Math.max(a.valueNumeric,b.valueNumeric);
    if(a.sex!==b.sex||a.lifeStage!==b.lifeStage||lo===hi||(t.separationMethod!=='distinct_ordinal'&&hi/lo<1.03-1e-12)||(t.id.startsWith('marine_description_year')&&hi-lo<2)||((a.valueMin??a.valueNumeric)<=(b.valueMax??b.valueNumeric)&&(b.valueMin??b.valueNumeric)<=(a.valueMax??a.valueNumeric)))mask&=~bit(k);
   });pair[i][j]=pair[j][i]=mask;
  }
  const deadline=Date.now()+seconds*1000,reject=reason=>row.rejections[reason]=(row.rejections[reason]??0)+1;
  function emit(selected,mask){
   const animals=selected.map(i=>pool[i]),ids=animals.map(a=>a.id).sort();
   if(animals.filter(a=>a.taxonomicGroup==='bat').length>1){reject('bat dominance');return;}
   if((group==='mixed'&&new Set(animals.map(animalMajorGroup)).size<2)||(group==='marine'&&(!animals.some(a=>animalMajorGroup(a)==='fish')||!animals.some(a=>animalMajorGroup(a)!=='fish')))){reject('group composition');return;}
   if(animalBoardComposition(data,{animalIds:ids,traitIds:[],mode:'expert'}).familiar<2){reject('familiar anchors');return;}
   row.compatibleEightAnimalLineups++;
   const options=traits.flatMap((t,i)=>mask&bit(i)?[{trait:t,winner:[...ids].sort((a,b)=>(values.get(a+':'+t.id).valueNumeric-values.get(b+':'+t.id).valueNumeric)*(t.direction==='higher_wins'?-1:1))[0]}]:[]).sort((a,b)=>(b.trait.categoryKind==='intuitive')-(a.trait.categoryKind==='intuitive'));
   if(new Set(options.map(o=>o.winner)).size<6){reject('fewer than six possible independent winners');return;}
   function choose(start,chosen,metrics,winners,intuitive){
    if(Date.now()>=deadline)return false;
    if(chosen.length===6){
     if(intuitive<3)return false;
     const traitIds=chosen.map(o=>o.trait.id).sort(),board={id:'groups-'+group+'-expert-'+createHash('sha256').update(ids.join(',')+'|'+traitIds.join(',')).digest('hex').slice(0,12),title:group,collection:'living',boardType:group==='mixed'?'mixed':'themed',mode:'expert',animalIds:ids,traitIds,editorial:{policy:'intuitive-majority-distinct-winners-v6',intuitiveMinimum:3}};
     if(seen.has(key(board)))return false;
     const result=validate(board);if(!result.valid){for(const reason of result.rejectionReasons)reject(reason);return false;}
     boards.push(board);seen.add(key(board));row.added++;return true;
    }
    for(let i=start;i<=options.length-(6-chosen.length);i++){const o=options[i];if(metrics.has(o.trait.metricKey)||winners.has(o.winner))continue;
     if(choose(i+1,[...chosen,o],new Set([...metrics,o.trait.metricKey]),new Set([...winners,o.winner]),intuitive+Number(o.trait.categoryKind==='intuitive')))return true;
    }return false;
   }
   choose(0,[],new Set(),new Set(),0);
  }
  function search(selected,candidates,mask){
   if(Date.now()>=deadline)return false;row.states++;
   if(selected.length===8){emit(selected,mask);return Date.now()<deadline;}
   for(let p=0;p<=candidates.length-(8-selected.length);p++){
    const i=candidates[p];let next=mask&personal.get(pool[i].id);for(const j of selected)next&=pair[i][j];
    if(metricCount(next)<6)continue;
    const remaining=candidates.slice(p+1).filter(j=>metricCount(next&personal.get(pool[j].id)&pair[i][j])>=6);
    if(remaining.length<7-selected.length)continue;
    if(!search([...selected,i],remaining,next))return false;
   }return true;
  }
  row.exhaustive=search([],pool.map((_,i)=>i),(1n<<BigInt(traits.length))-1n);
  console.log(group,JSON.stringify(row));
 }
 const mid=Math.ceil(boards.length/2);fs.writeFileSync('data/animalstats/group-boards.json',JSON.stringify({boards:boards.slice(0,mid)})+'\n');fs.writeFileSync('data/animalstats/group-boards-2.json',JSON.stringify({boards:boards.slice(mid)})+'\n');fs.writeFileSync('data/animalstats/research/expert-search.json',JSON.stringify(report,null,2)+'\n');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
