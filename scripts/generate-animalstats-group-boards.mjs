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
 const parts=['pilot','existing-coverage','fish-records','tetrapod-spatial','marine','aquatic-eggs'].map(n=>JSON.parse(fs.readFileSync(`data/animalstats/${n}.json`)));
 const d=Object.fromEntries(['animals','traits','values','sources','photos'].map(k=>[k,parts.flatMap(p=>p[k].filter(row=>k!=='photos'||p===parts[4]||!parts[4].photos.some(photo=>photo.animalId===row.animalId)))]));
 const errors=validateAnimalDataset(d);if(errors.length)throw new Error(errors.join("\n"));
 const pub=publishedAnimalTraitIds(d),validate=createAnimalBoardValidator(d),vm=new Map(d.values.filter(v=>v.confidence==='approved').map(v=>[v.animalId+':'+v.traitId,v]));
 const portraits=new Set(d.photos.filter(p=>p.approved).map(p=>p.animalId));
 const groups={birds:['bird'],insects:['insect'],dogs:['dog-breed'],cats:['cat-breed'],reptiles:['lizard','snake','turtle','crocodilian','reptile'],amphibians:['frog','salamander','amphibian'],fish:['fish','shark','ray'],invertebrates:['insect','bivalve','crustacean','echinoderm','cephalopod','gastropod','mollusc','cnidarian','arachnid','chelicerate','annelid','sponge'],mammals:null,mixed:null,marine:null};
 const marineIds=new Set(JSON.parse(fs.readFileSync('data/animalstats/research/marine-admission.json')).marineAnimalIds);
 for(const a of d.animals)if(a.taxonomicGroup==='marine-mammal')marineIds.add(a.id);
 const existing=['group-boards','group-boards-2'].flatMap(name=>fs.existsSync(`data/animalstats/${name}.json`)?JSON.parse(fs.readFileSync(`data/animalstats/${name}.json`)).boards:[]);
 const out=existing.filter(b=>b.traitIds.every(t=>pub.has(t))&&validate(b).valid&&animalBoardComposition(d,b).eligible),seen=new Set(out.map(b=>b.id));
 function* combos(a,n,s=0,p=[]){if(!n){yield p;return;}for(let i=s;i<=a.length-n;i++)yield*combos(a,n-1,i+1,[...p,a[i]]);}
 const report={policy:'intuitive-majority-distinct-winners-v6',notes:['No publication cap or per-lineup variant cap. Runtime budget is resumable and does not determine eligibility.','At least 3% between every adjacent numeric rank; exact ties remain blocked. Uncertainty overlap, source compatibility, unique winners and at least half intuitive remain required.'],groups:[]};
 const seconds=Number(process.env.ANIMAL_GENERATION_SECONDS??5);
 if(!Number.isFinite(seconds)||seconds<=0)throw new Error('ANIMAL_GENERATION_SECONDS must be positive');
 const boardKey=b=>b.mode+'|'+[...b.animalIds].sort().join(',')+'|'+[...b.traitIds].sort().join(',');
 const contents=new Set(out.map(boardKey));
 const availableTraits=d.traits.filter(t=>pub.has(t.id)&&!t.id.startsWith('adult_shoulder_height'));
 for(const [group,types] of Object.entries(process.argv.includes('--validate-only')?{}:groups).filter(([name])=>!process.env.ANIMAL_GENERATION_GROUPS||process.env.ANIMAL_GENERATION_GROUPS.split(',').includes(name))) {
  const animals=d.animals.filter(a=>a.active&&(a.extinctionStatus??'living')==='living'&&a.familiarityTier!=='edge'&&portraits.has(a.id)&&(group==='mixed'?a.entityType!=='breed':group==='marine'?marineIds.has(a.id):types?types.includes(a.taxonomicGroup):animalMajorGroup(a)==='mammals'&&a.entityType!=='breed'));
  for(const mode of ['easy','normal','expert']) {
   const start=out.length,n=mode==='easy'?4:mode==='normal'?6:8,k=mode==='expert'?6:4,minimumIntuitive=Math.ceil(k/2);
   const row={group,mode,portraitAnimals:animals.length,animalsWithEnoughMetrics:0,attempts:0,added:0,rejections:{}};report.groups.push(row);
   const reject=reason=>{row.rejections[reason]=(row.rejections[reason]??0)+1;};
   // Trait-guided pools make sparse marine/invertebrate facts reachable, instead
   // of repeatedly drawing incompatible animals from the entire catalog.
   const usable=animals.filter(a=>new Set(availableTraits.filter(t=>vm.has(a.id+':'+t.id)).map(t=>t.metricKey)).size>=k);
   row.animalsWithEnoughMetrics=usable.length;
   if(usable.length<n){reject('not enough illustrated animals with '+k+' distinct metrics');continue;}
   const pools=availableTraits.map(t=>usable.filter(a=>vm.has(a.id+':'+t.id))).filter(pool=>pool.length>=n);
   if(!pools.length){reject('no shared trait pool');continue;}
   let seed=parseInt(createHash('sha256').update(group+mode+existing.length).digest('hex').slice(0,8),16);
   const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
   const shuffle=items=>{const list=[...items];for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
   const lineups=new Set(),deadline=Date.now()+seconds*1000;
   while(Date.now()<deadline){
    row.attempts++;
    const pool=row.attempts%4===0?usable:pools[Math.floor(random()*pools.length)];
    const aa=shuffle(pool).slice(0,n).sort((a,b)=>a.id.localeCompare(b.id)),ids=aa.map(a=>a.id),lineup=ids.join(',');
    if((group==='mixed'&&new Set(aa.map(animalMajorGroup)).size<2)||(group==='marine'&&(!aa.some(a=>animalMajorGroup(a)==='fish')||!aa.some(a=>animalMajorGroup(a)!=='fish')))){reject('group composition');continue;}
    if(lineups.has(lineup)){reject('sampled lineup already explored');continue;}lineups.add(lineup);
    if(aa.filter(a=>a.taxonomicGroup==='bat').length>1){reject('bat dominance');continue;}
    const shell={animalIds:ids,traitIds:[],mode};if(animalBoardComposition(d,shell).familiar<(n===4?1:2)){reject('no familiar anchor');continue;}
    const tt=shuffle(availableTraits.filter(t=>{
     if(!ids.every(id=>vm.has(id+':'+t.id)))return false;
     const vv=ids.map(id=>vm.get(id+':'+t.id)).sort((a,b)=>a.valueNumeric-b.valueNumeric);
     if(new Set(vv.map(v=>v.sex)).size>1||new Set(vv.map(v=>v.lifeStage)).size>1)return false;
     return vv.every((v,i)=>!i||((v.valueMin??v.valueNumeric)>(vv[i-1].valueMax??vv[i-1].valueNumeric)&&(t.separationMethod==='distinct_ordinal'||v.valueNumeric/vv[i-1].valueNumeric>=1.03-1e-12)));
    }));
    if(new Set(tt.map(t=>t.metricKey)).size<k){reject('not enough compatible distinct metrics');continue;}
    if(tt.filter(t=>t.categoryKind==='intuitive').length<minimumIntuitive){reject('less than half intuitive');continue;}
    for(const traits of combos(tt,k)){
     if(Date.now()>=deadline)break;
     if(traits.filter(t=>t.categoryKind==='intuitive').length<minimumIntuitive||new Set(traits.map(t=>t.metricKey)).size!==k)continue;
     const winners=traits.map(t=>[...ids].sort((a,b)=>(vm.get(a+':'+t.id).valueNumeric-vm.get(b+':'+t.id).valueNumeric)*(t.direction==='higher_wins'?-1:1))[0]);
     if(new Set(winners).size!==k){reject('category winners compete for same animal');continue;}
     const traitIds=traits.map(t=>t.id).sort();
     const b={id:'groups-'+group+'-'+mode+'-'+createHash('sha256').update(lineup+'|'+traitIds.join(',')).digest('hex').slice(0,12),title:group,collection:'living',boardType:group==='mixed'?'mixed':'themed',mode,animalIds:ids,traitIds,editorial:{policy:report.policy,intuitiveMinimum:minimumIntuitive}};
     if(seen.has(b.id)||contents.has(boardKey(b)))continue;
     const result=validate(b);
     if(result.valid&&animalBoardComposition(d,b).eligible){out.push(b);seen.add(b.id);contents.add(boardKey(b));break;}
     else for(const reason of result.rejectionReasons)reject(reason.replace(/trait [^:]+:/,'trait:'));
    }
   }
   row.added=out.length-start;
   console.log(group,mode,'added',row.added,'attempts',row.attempts);
  }
 }
 report.totalBoards=out.length;
 report.notes.push('Each sampled lineup contributes one new board per pass to prioritize animal diversity; later passes can add further variants.');
 fs.writeFileSync('data/animalstats/research/generation-rejections.json',JSON.stringify(report,null,2)+'\n');
 const middle=Math.ceil(out.length/2);
 fs.writeFileSync('data/animalstats/group-boards.json',JSON.stringify({boards:out.slice(0,middle)})+'\n');
 fs.writeFileSync('data/animalstats/group-boards-2.json',JSON.stringify({boards:out.slice(middle)})+'\n');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
