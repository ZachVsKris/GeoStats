import fs from 'node:fs';import ts from 'typescript';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const tmp=fs.mkdtempSync('/tmp/fossil-history-');
try {
 for(const n of ['categorySemantics','gameRules','animalstats','animalstatsCoverage','animalstatsComposition'])fs.writeFileSync(`${tmp}/${n}.mjs`,ts.transpileModule(fs.readFileSync(`lib/${n}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from "\.\/([^".]+)"/g,'from "./$1.mjs"'));
 const {createAnimalBoardValidator,validateAnimalDataset}=await import(pathToFileURL(`${tmp}/animalstats.mjs`)),{publishedAnimalTraitIds}=await import(pathToFileURL(`${tmp}/animalstatsCoverage.mjs`)),{animalBoardComposition}=await import(pathToFileURL(`${tmp}/animalstatsComposition.mjs`));
 const d=JSON.parse(fs.readFileSync('data/animalstats/extinct.json'));if(validateAnimalDataset(d).length)throw new Error(validateAnimalDataset(d).join('\n'));
 const validate=createAnimalBoardValidator(d),pub=publishedAnimalTraitIds(d),vm=new Map(d.values.map(v=>[v.animalId+':'+v.traitId,v]));let boards=d.boards.filter(b=>validate(b).valid&&b.traitIds.every(t=>pub.has(t))&&animalBoardComposition(d,b).eligible),ids=new Set(boards.map(b=>b.id));const added=[];let seed=12102026;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};const shuffle=x=>{const a=[...x];for(let i=a.length-1;i;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};function* combos(a,k,s=0,p=[]){if(!k){yield p;return;}for(let i=s;i<=a.length-k;i++)yield*combos(a,k-1,i+1,[...p,a[i]]);}
 for(const mode of ['easy','normal','expert']){
  const n=mode==='easy'?4:mode==='normal'?6:8,k=mode==='expert'?6:4,deadline=Date.now()+1000*Number(process.env.ANIMAL_GENERATION_SECONDS??8),start=boards.length;let attempts=0;
  while(Date.now()<deadline){attempts++;const targetGroup=process.env.ANIMAL_EXTINCT_GROUP;const animals=shuffle(d.animals.filter(a=>!targetGroup||a.taxonomicGroup===targetGroup)).slice(0,n),aa=animals.map(a=>a.id).sort();if(animals.length!==n||animals.filter(a=>a.familiarityTier==='core').length<(n===4?1:2))continue;
   const traits=shuffle(d.traits.filter(t=>pub.has(t.id)&&aa.every(a=>vm.has(a+':'+t.id)))).filter(t=>{const rows=aa.map(a=>vm.get(a+':'+t.id)).sort((a,b)=>a.valueNumeric-b.valueNumeric);return rows.every((v,i)=>!i||(v.valueNumeric/rows[i-1].valueNumeric>=1.03-1e-12&&(v.valueMin??v.valueNumeric)>(rows[i-1].valueMax??rows[i-1].valueNumeric)));});
   if(new Set(traits.map(t=>t.metricKey)).size<k)continue;
   for(const ts of combos(traits,k)){
    if(Date.now()>deadline)break;if(new Set(ts.map(t=>t.metricKey)).size!==k||ts.filter(t=>t.categoryKind==='intuitive').length<Math.ceil(k/2))continue;if(!ts.some(t=>t.canonicalSourceId===(process.env.ANIMAL_EXTINCT_GROUP==='extinct-mammal'?'pbdb-extinct-mammals-20261012':'extinct-pbdb-discovery-20261010')))continue;
    const ww=ts.map(t=>[...aa].sort((a,b)=>(vm.get(a+':'+t.id).valueNumeric-vm.get(b+':'+t.id).valueNumeric)*(t.direction==='higher_wins'?-1:1))[0]);if(new Set(ww).size!==k)continue;
    if(animals.some(a=>animals.filter(b=>b.scientificName.split(' ')[0]===a.scientificName.split(' ')[0]).length>2))continue;const tt=ts.map(t=>t.id).sort(),id='extinct-history-'+mode+'-'+createHash('sha256').update(aa.join(',')+'|'+tt.join(',')).digest('hex').slice(0,12);if(ids.has(id))continue;
    const b={id,title:process.env.ANIMAL_EXTINCT_GROUP==='extinct-mammal'?'Extinct Special · Mammals':'Extinct Special · Dinosaurs',collection:'extinct-special',boardType:'themed',mode,animalIds:aa,traitIds:tt,editorial:{policy:'intuitive-majority-distinct-winners-v6',intuitiveMinimum:Math.ceil(k/2)}};
    if(validate(b).valid&&animalBoardComposition(d,b).eligible){boards.push(b);ids.add(id);added.push(id);break;}
   }
  }
  console.log(mode,'added',boards.length-start,'attempts',attempts);
 }
 fs.writeFileSync('data/animalstats/extinct.json',JSON.stringify({...d,boards})+'\n');fs.writeFileSync('data/animalstats/research/fossil-history-board-admission.json',JSON.stringify({added:added.length,ids:added,policy:'Exact-species fossil discovery histories; every rank distinct and at least 3% apart; living animals excluded'},null,2)+'\n');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
