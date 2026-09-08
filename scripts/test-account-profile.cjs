const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const tick = async () => { for (let i=0;i<10;i++) await Promise.resolve(); };
async function main() {
  const listeners = new Map();
  global.window = { setTimeout, clearTimeout, addEventListener: (key, fn) => { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); }, removeEventListener: (key, fn) => listeners.get(key)?.delete(fn), dispatchEvent: e => listeners.get(e.type)?.forEach(fn=>fn(e)) };
  global.CustomEvent = class { constructor(type, options) { this.type=type; this.detail=options.detail; } };
  global.localStorage = { getItem: () => null };
  const profileLoads = [];
  const authCallbacks = [];
  let patch;
  global.fetch = (url, options = {}) => {
    const request=deferred();
    if (options.method === 'PATCH') patch=request;
    else profileLoads.push(request);
    return request.promise;
  };
  const instances=[];
  function mount() {
    let cursor=0;
    const values=[], effects=[];
    const react={
      useState: initial => { const index=cursor++; if (!(index in values)) values[index]=initial; return [values[index], value=>{values[index]=typeof value==='function'?value(values[index]):value;}]; },
      useRef: initial => {const index=cursor++; return values[index] ||= {current:initial};},
      useMemo: fn=>{const index=cursor++; return values[index] ||= fn();},
      useEffect: fn=>{effects.push(fn);},
    };
    const module={exports:{}};
    new Function('require','exports','module',compile('components/AccountControls.tsx'))(id=> {
      if(id==='react')return react;
      if(id==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
      if(id.includes('supabase/browser'))return {createSupabaseBrowserClient:()=>({auth:{onAuthStateChange:fn=>{authCallbacks.push(fn);return {data:{listener:null,subscription:{unsubscribe(){}}}};}}})};
      if(id.includes('analytics'))return {trackAnalytics(){}};
      if(id.includes('googleProvider'))return {};
      throw Error(id);
    },module.exports,module);
    const render=()=>{cursor=0;effects.length=0;return module.exports.default({hideLeaderboardLink:true});};
    let tree=render(); const cleanup=effects.map(fn=>fn()).filter(fn=>typeof fn==='function');
    const instance={values,render,cleanup};instances.push(instance);return instance;
  }
  const a=mount(), b=mount();
  const user={id:'user-a',email:'player@example.test'};
  authCallbacks.forEach(fn=>fn('INITIAL_SESSION',{user}));
  await new Promise(r=>setTimeout(r,1));
  assert.equal(profileLoads.length,2);
  authCallbacks.forEach(fn=>fn('SIGNED_IN',{user}));
  await new Promise(r=>setTimeout(r,1));
  assert.equal(profileLoads.length,2,'focus events must not restart profile loading');
  profileLoads[0].resolve(new Response(JSON.stringify({username:'generated_name',displayName:'Google Name',usernameCustomized:false})));
  await tick();
  // Open required onboarding and submit a new name while the other header has a stale request.
  function nodes(tree) { if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
  let tree=a.render();
  nodes(tree).find(n=>n.type==='input'&&n.props.autoComplete==='username').props.onChange({target:{value:'ChosenName'}});
  tree=a.render();
  const save=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Save username');
  const saving=save.props.onClick();
  patch.resolve(new Response(JSON.stringify({username:'ChosenName'})));
  await saving;
  profileLoads[1].resolve(new Response(JSON.stringify({username:'stale_name',displayName:'Google Name',usernameCustomized:false})));
  await tick();
  for(const instance of instances) {
    assert.ok(nodes(instance.render()).some(n=>n.type==='button'&&n.props.children==='ChosenName'),'all account controls show saved username, not late response or Google name');
  }
  authCallbacks.forEach(fn=>fn('SIGNED_OUT',null));
  assert.ok(nodes(a.render()).some(n=>n.type==='button'&&n.props.children==='Sign in'));
  instances.forEach(i=>i.cleanup.forEach(fn=>fn()));
  console.log('PASS: auth event deduplication, username synchronization, stale response protection, sign-out cleanup.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
