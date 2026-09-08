const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(id=>id in mocks?mocks[id]:require(id),mod.exports,mod);return mod.exports;}
(async()=>{
 const storage=new Map();global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 let analytics=load('lib/analytics.ts');const id=analytics.analyticsVisitorId();assert.match(id,/^[a-f0-9-]{36}$/);
 analytics=load('lib/analytics.ts');assert.equal(analytics.analyticsVisitorId(),id,'same browser retains ID across sessions');
 storage.set('geostats-analytics-visitor-v1',JSON.stringify({id,createdAt:Date.now()-91*86400000}));
 assert.notEqual(load('lib/analytics.ts').analyticsVisitorId(),id,'identifier rotates');
 global.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.ok(load('lib/analytics.ts').analyticsVisitorId(),'blocked storage never blocks gameplay');
 let calls=0, rpcError=null, params;
 const report=load('app/api/reports/route.ts',{'../../../lib/supabase/server':{createSupabaseAdminClient:()=>({rpc:async(_,p)=>{calls++;params=p;return {error:rpcError};}}),createSupabaseServerClient:async()=>null}});
 const post=(body,origin='https://geostats.xyz')=>report.POST(new Request('https://geostats.xyz/api/reports',{method:'POST',headers:{origin,'Content-Type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)}));
 const valid={kind:'data',message:'Synthetic test: the displayed unit seems wrong.',path:'/daily?token=secret',categoryId:'fixture',difficulty:'easy'};
 assert.equal((await post(valid,'https://attacker.example')).status,403);assert.equal(calls,0);
 assert.equal((await post({...valid,message:'short'})).status,400);assert.equal(calls,0);
 assert.equal((await post(valid)).status,200);assert.equal(params.p_page_path,'/daily');assert.equal(params.p_user_id,null);assert.equal(params.p_rate_key.length,64);assert.ok(!params.p_rate_key.includes('192.0.2.1'));
 rpcError={message:'report_rate_limit'};assert.equal((await post(valid)).status,429);
 rpcError={message:'internal database details'};const failed=await post(valid);assert.equal(failed.status,503);assert.ok(!JSON.stringify(await failed.json()).includes('internal database'));
 const admin=load('app/api/admin/reports/route.ts',{'../../../../lib/supabase/adminAuth':{requireAdmin:async()=>({ok:false,status:403,error:'Restricted'})}});
 assert.equal((await admin.GET()).status,403);assert.equal((await admin.PATCH(new Request('https://geostats.xyz/api/admin/reports',{method:'PATCH'}))).status,403);
 console.log('PASS: visitor persistence/rotation/storage fallback, report origin/input/privacy/rate-limit handling, private Admin access.');
})().catch(e=>{console.error(e);process.exitCode=1;});
