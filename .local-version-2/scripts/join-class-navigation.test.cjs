// Regression checks of the actual route controller with synthetic session/Back events.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const babel = local('@babel/core');
const routeFile = path.join(mobile, 'src/app/class-code.tsx');
let current;
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (parent?.filename === routeFile) {
    if (name === 'react') return Object.fromEntries(['useState','useRef','useCallback','useEffect'].map(hook=>[hook,(...args)=>current.hooks[hook](...args)]));
    if (name === 'react-native') return { BackHandler: { addEventListener(_, callback) { current.listeners.add(callback); const listeners=current.listeners;return {remove:()=>listeners.delete(callback)}; } } };
    if (name === 'expo-router') return {router:{replace:target=>current.routes.push(target),push:target=>current.routes.push(target)},useFocusEffect:callback=>{current.nextFocus=callback;}};
    if (name.endsWith('/session/provider')) return {useSession:()=>current.session};
    if (name.endsWith('/JoinClassView')) return {JoinClassView:()=>null};
  }
  return originalLoad.call(this,name,parent,main);
};
for (const ext of ['.ts','.tsx']) Module._extensions[ext] = function(mod,file) {
 const result=babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,plugins:[[local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],[local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]});mod._compile(result.code,file);
};
const Route=local(routeFile).default;
const preview={class_name:'Synthetic class',grade_level:5,language:'english',instructor_display_name:null,class_version:'a'.repeat(64)};
const membership={...preview,id:'synthetic-membership',class_id:'synthetic-class',joined_at:'2026-10-29',status:'active'};
const equalDeps=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function harness() {
 const h={slots:[],index:0,effects:[],listeners:new Set(),routes:[],focused:true,nextFocus:null,focus:null,focusCleanup:null,view:null};
 h.hooks={
  useState(initial){const i=h.index++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return [h.slots[i],value=>{h.slots[i]=typeof value==='function'?value(h.slots[i]):value;}];},
  useRef(initial){const i=h.index++;return h.slots[i]??=( {current:initial} );},
  useCallback(fn,deps){const i=h.index++;if(!equalDeps(h.slots[i]?.deps,deps))h.slots[i]={fn,deps};return h.slots[i].fn;},
  useEffect(fn,deps){const i=h.index++;if(!equalDeps(h.slots[i]?.deps,deps)){const previous=h.slots[i];h.slots[i]={deps};h.effects.push(()=>{previous?.cleanup?.();h.slots[i].cleanup=fn();});}}
 };
 h.session={profile:{role:'school_student',profile_status:'onboarding'},enrollment:{preview:async()=>preview,confirm:async()=>membership},refreshProfile:async()=>h.session.profile,logout(){}};
 h.render=()=>{current=h;h.index=0;h.nextFocus=null;h.view=Route().props;h.effects.splice(0).forEach(fn=>fn());if(h.nextFocus!==h.focus){h.focusCleanup?.();h.focus=h.nextFocus;h.focusCleanup=h.focused?h.focus?.():null;}return h.view;};
 h.blur=()=>{h.focused=false;h.focusCleanup?.();h.focusCleanup=null;};
 h.focusScreen=()=>{h.focused=true;h.focusCleanup=h.focus?.();};
 h.dispose=()=>{h.focusCleanup?.();for(const s of h.slots)s?.cleanup?.();};
 h.flush=async()=>{await new Promise(setImmediate);return h.render();};
 return h;
}

test('Android Back is subscribed only while Join a class is focused',()=>{
 const h=harness();try{h.render();assert.equal(h.listeners.size,1);h.blur();assert.equal(h.listeners.size,0,'Account must not inherit the hidden class-code Back handler');h.focusScreen();assert.equal(h.listeners.size,1);}finally{h.dispose();}
});

test('an uncertain join keeps its original retry through Back, Stay, and change-code attempts',async()=>{
 const h=harness();const requests=[];let attempts=0;h.session.enrollment.confirm=async body=>{requests.push(body);if(++attempts===1)throw Object.assign(new Error('Interrupted'),{status:0});return membership;};
 try{
  h.render().onCodeChange('123456');h.render().onCheck();await h.flush();assert(h.view.preview);
  h.view.onJoin();await h.flush();assert(h.view.pending);assert.equal(h.view.confirmed,null);
  h.view.onChangeCode();h.render();assert(h.view.pending,'changing code must not discard an uncertain join');
  h.view.onBack();h.render();assert(h.view.showExit,'Back should ask before leaving an uncertain pending join');assert(h.view.pending);
  h.view.onStay();h.render();assert(!h.view.showExit);assert(h.view.pending);
  h.view.onJoin();await h.flush();assert.equal(h.view.confirmed.id,membership.id);assert(!h.view.pending);assert.deepEqual(requests[0],requests[1]);
 }finally{h.dispose();}
});

test('ordinary preview Back cancels, and enrolled students return to My Classes',async()=>{
 const h=harness();try{h.render().onCodeChange('123456');h.render().onCheck();await h.flush();h.view.onBack();h.render();assert.equal(h.view.preview,null);assert(!h.view.showExit);h.session.profile.profile_status='active';h.render().onBack();assert.equal(h.routes.at(-1),'/student');}finally{h.dispose();}
});
