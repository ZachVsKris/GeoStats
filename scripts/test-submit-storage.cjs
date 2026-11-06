const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const path=require('path');
const root=path.resolve(__dirname,'..'),ts=require(root+'/node_modules/typescript');
const file=root+'/components/AccountControls.tsx';
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
for(const scenario of ['normal','full','blocked']){
 const effects=[],writes=[];
 const react={useMemo:f=>f(),useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:f=>effects.push(f)};
 const sandbox={exports:{},require:name=>name==='react'?react:name==='react/jsx-runtime'?require(root+'/node_modules/react/jsx-runtime'):name.includes('supabase/browser')?{createSupabaseBrowserClient:()=>null}: {},setTimeout,clearTimeout};
 if(scenario==='blocked')Object.defineProperty(sandbox,'localStorage',{get(){throw new DOMException('Storage access denied','SecurityError')}});
 else sandbox.localStorage={setItem(k,v){if(scenario==='full')throw new DOMException('Storage quota exceeded','QuotaExceededError');writes.push([k,JSON.parse(v)]);}};
 vm.runInNewContext(code,sandbox,{filename:file});
 sandbox.exports.default({results:true,pendingScore:{challengeDate:'2026-11-06',difficulty:'easy',assignments:{a:'IND'}}});
 for(const effect of effects)effect();
 if(scenario==='normal')assert.equal(writes.length,1);
 console.log(scenario+': result account controls mounted without throwing');
}

// Exercise the authenticated save path with actual history parsing and failing storage.
(async () => {
  for (const failure of ['full','blocked']) {
    const effects=[],requests=[];
    let savedResolve;
    const saved=new Promise(resolve=>savedResolve=resolve);
    const react={useMemo:f=>f(),useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:f=>effects.push(f)};
    const historyModule={exports:{}};
    const historyCode=ts.transpileModule(fs.readFileSync(root+'/lib/dailyScoreHistory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(historyCode,{exports:historyModule.exports});
    const client={auth:{onAuthStateChange(callback){callback('INITIAL_SESSION',{user:{id:'test',email:'test@example.invalid'}});return {data:{subscription:{unsubscribe(){}}}};}}};
    const sandbox={exports:{},setTimeout,clearTimeout,AbortController,
      window:{setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}},
      require:name=>name==='react'?react:name==='react/jsx-runtime'?require(root+'/node_modules/react/jsx-runtime'):name.includes('supabase/browser')?{createSupabaseBrowserClient:()=>client}:name.includes('dailyScoreHistory')?historyModule.exports:{},
      fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url==='/api/profile'?{username:'Test',usernameCustomized:true}:{}};}
    };
    if(failure==='blocked')Object.defineProperty(sandbox,'localStorage',{get(){throw new DOMException('Storage denied','SecurityError');}});
    else sandbox.localStorage={length:0,getItem:()=>null,setItem(){throw new DOMException('Quota exceeded','QuotaExceededError');},removeItem(){}};
    vm.runInNewContext(code,sandbox,{filename:file});
    sandbox.exports.default({results:true,pendingScore:{challengeDate:'2026-11-06',difficulty:'easy',assignments:{a:'IND'}},onScoreSaved:savedResolve});
    const cleanups=effects.map(effect=>effect());
    const timeout=setTimeout(()=>savedResolve(null),1000);
    const result=await saved;clearTimeout(timeout);
    for(const cleanup of cleanups)if(typeof cleanup==='function')cleanup();
    assert(result,'Current result was not acknowledged as saved');
    const posts=requests.filter(r=>r.url==='/api/scores');assert.equal(posts.length,1);
    assert.equal(JSON.parse(posts[0].options.body).assignments.a,'IND');
    console.log(failure+': signed-in current result reached score API and save callback');
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
