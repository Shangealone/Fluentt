// Explicitly synthetic QA fixtures. These checks do not create live learner records.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../apps/admin'), local = Module.createRequire(path.join(root, 'package.json'));
const React = local('react'), ts = local('typescript'), original = Module._load;
Module._load = function(name, parent, main) {
  if(name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) });
  if(name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return original.call(this, name, parent, main);
};
for(const ext of ['.ts','.tsx']) Module._extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText,filename);
const {PerformanceMonitor} = local(path.join(root,'src/components/performance-monitor.tsx'));
const {OversightPanel} = local(path.join(root,'src/components/oversight-panel.tsx'));
const {isPerformanceReport} = local(path.join(root,'src/services/performance-contract.ts'));
const counts = {learn_question:0,learn_lesson:0,voice_phrase:0,tutor_reply:0,tutor_session:0};
const fixture = {metric_version:'client-reported-activity-v1',scope:'active-personal-learners',as_of:'2026-10-27T12:00:00Z',window_start:'2026-09-28T00:00:00Z',days:30,learners:1,learners_with_activity:0,counts,timeline:[],items:[{...counts,id:'synthetic-only',username:'QA Learner',last_activity:null}],offset:0,has_more:false};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];return[...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(child=>nodes(child,predicate))];}
function text(tree){if(tree==null||typeof tree==='boolean')return'';if(typeof tree!=='object')return String(tree);return React.Children.toArray(tree.props?.children).map(text).join(' ');}
function harness(props={permitted:true,preview:false},Component=PerformanceMonitor) {
  const slots=[],effects=[],listeners={};let cursor=0;
  global.window={addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:key=>delete listeners[key],location:{replace:url=>{h.redirect=url;}}};
  global.document={hidden:false,addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:key=>delete listeners[key]};
  const h={render(){cursor=0;const queue=[],saved={useState:React.useState,useEffect:React.useEffect};
    React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
    React.useEffect=(fn,deps)=>{const i=cursor++,prior=effects[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))queue.push(()=>{prior?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
    try{const tree=Component(props);queue.forEach(fn=>fn());return tree;}finally{Object.assign(React,saved);}
  },blur(){listeners.blur();h.render();},focus(){listeners.focus();h.render();},dispose(){effects.forEach(e=>e?.cleanup?.());}};
  return h;
}
test('contract accepts genuine zero but rejects absent counts and foreign scope',()=>{
  assert(isPerformanceReport(fixture));
  for(const change of [{counts:null},{counts:{...counts,voice_phrase:-1}},{scope:'research'},{learners_with_activity:2},{days:4},{items:[null]}]) {
    assert.equal(isPerformanceReport({...fixture,...change}),false);
  }
});
test('preview and ungranted accounts never request live monitoring or display synthetic zero',()=>{
  let calls=0;global.fetch=async()=>{calls++;throw Error('must not fetch');};
  for(const props of [{permitted:true,preview:true},{permitted:false,preview:false}]) {
    const h=harness(props),tree=h.render();assert.equal(calls,0);assert(text(tree).includes('—'));assert(!text(tree).includes('QA Learner'));h.dispose();
  }
});
test('filters hide previous records and old asynchronous responses cannot replace the new selection',async()=>{
  const requests=[];global.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
  const h=harness();h.render();requests[0].resolve(Response.json(fixture));await tick();assert(text(h.render()).includes('QA Learner'));
  nodes(h.render(),n=>n.type==='button'&&text(n).replace(/\s+/g,' ')==='7 days')[0].props.onClick();
  assert(!text(h.render()).includes('QA Learner'));assert.equal(requests.length,2);assert(requests[0].options.signal.aborted);
  nodes(h.render(),n=>n.type==='button'&&text(n).replace(/\s+/g,' ')==='90 days')[0].props.onClick();h.render();
  requests[1].resolve(Response.json({...fixture,days:7}));await tick();assert(!text(h.render()).includes('QA Learner'));
  requests[2].resolve(Response.json({...fixture,days:90,items:[]}));await tick();assert(!text(h.render()).includes('QA Learner'));h.dispose();
});
test('blur clears protected data, refocus revalidates and permission failures clear results',async()=>{
  const requests=[];global.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
  const h=harness();h.render();requests[0].resolve(Response.json(fixture));await tick();assert(text(h.render()).includes('QA Learner'));
  h.blur();assert(!text(h.render()).includes('QA Learner'));h.focus();assert.equal(requests.length,2);
  requests[1].resolve(new Response('{}',{status:403}));await tick();const tree=h.render();
  assert(!text(tree).includes('QA Learner'));assert(text(tree).includes('operator must grant'));h.dispose();
});
test('expired administrator sessions redirect without showing learner records',async()=>{
  global.fetch=async()=>new Response('{}',{status:401});const h=harness();h.render();await tick();
  assert.equal(h.redirect,'/login?expired=1');assert(!text(h.render()).includes('QA Learner'));h.dispose();
});

const schoolFixture={view:'users',metric_version:'admin-school-oversight-v1',as_of:'2026-10-28T00:00:00Z',
  items:[{id:'00000000-0000-0000-0000-000000000001',username:'Synthetic School QA',role:'school_student',status:'active',revision:'a'.repeat(64)}],offset:0,has_more:false,summary:{}};

test('school oversight drops protected records on blur and rejects late responses',async()=>{
  const requests=[];global.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
  const h=harness({view:'users',permitted:true,preview:false},OversightPanel);
  h.render();requests[0].resolve(Response.json(schoolFixture));await tick();assert(text(h.render()).includes('Synthetic School QA'));
  h.blur();assert(!text(h.render()).includes('Synthetic School QA'));
  h.focus();requests[1].resolve(new Response('{}',{status:403}));await tick();
  assert(!text(h.render()).includes('Synthetic School QA'));assert(text(h.render()).includes('explicit read access'));h.dispose();
});

test('school status unknown-outcome retry retains the exact body, revision and request UUID',async()=>{
  const calls=[];let postCount=0;
  global.fetch=async(url,options)=>{calls.push({url,options});if(options.method==='POST'){postCount++;return new Response('{}',{status:postCount===1?503:403});}return Response.json(schoolFixture);};
  const h=harness({view:'users',permitted:true,preview:false,canWrite:true,csrf:'synthetic-csrf'},OversightPanel);
  h.render();await tick();
  nodes(h.render(),n=>n.type==='button'&&text(n)==='Deactivate')[0].props.onClick();
  await nodes(h.render(),n=>n.type==='button'&&text(n)==='Confirm status change')[0].props.onClick();await tick();
  assert(text(h.render()).includes('Change not confirmed'));
  await nodes(h.render(),n=>n.type==='button'&&text(n)==='Retry original change')[0].props.onClick();await tick();
  const posts=calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,2);
  assert.equal(posts[0].options.body,posts[1].options.body);assert.deepEqual(posts[0].options.headers,posts[1].options.headers);
  assert(!text(h.render()).includes('Synthetic School QA'));assert(text(h.render()).includes('Access was revoked'));h.dispose();
});
