const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let signedIn=true, missing=false, updated=null;
const db={auth:{getClaims:async()=>({data:signedIn?{claims:{sub:'verified-user',email:'player@example.test'}}:null,error:null})},from:()=>{
 const chain={select(){return chain;},eq(column,value){assert.equal(column,'id');assert.equal(value,'verified-user');return chain;},ilike(){return chain;},neq(){return chain;},limit:async()=>({data:[],error:null}),update(value){updated=value;return chain;},maybeSingle:async()=>({data:missing?null:{username:updated?.username||'ExistingName',username_customized:true},error:null})};return chain;
}};
const moduleObject={exports:{}};
const code=ts.transpileModule(fs.readFileSync('app/api/profile/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports','module',code)(id=>id.endsWith('/supabase/server')?{createSupabaseServerClient:async()=>db}:require(id),moduleObject.exports,moduleObject);
(async()=>{
 const route=moduleObject.exports;
 const request=name=>new Request('https://geostats.xyz/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,id:'attacker-chosen-id'})});
 signedIn=false;assert.equal((await route.GET()).status,401);assert.equal((await route.PATCH(request('ChosenName'))).status,401);assert.equal(updated,null);
 signedIn=true;let response=await route.GET();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await route.PATCH(request('admin'))).status,400);
 response=await route.PATCH(request('ChosenName'));assert.equal(response.status,200);assert.equal((await response.json()).username,'ChosenName');
 missing=true;assert.equal((await route.PATCH(request('AnotherName'))).status,409,'missing rows cannot report success');
 console.log('PASS: verified identity, own-profile restriction, reserved names, confirmed write, missing-row failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
