// Actual setup-controller regressions with synthetic profiles; no requests or stored accounts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const babel = local('@babel/core');
const controllerFile = path.join(mobile, 'src/features/setup/PersonalSetup.tsx');
let current;
const originalLoad = Module._load;
Module._load = function(name,parent,main) {
 if (parent?.filename === controllerFile) {
  if(name==='react')return Object.fromEntries(['useState','useRef','useCallback','useEffect'].map(hook=>[hook,(...args)=>current.hooks[hook](...args)]));
  if(name==='react-native')return {BackHandler:{addEventListener(_,callback){current.listeners.add(callback);const listeners=current.listeners;return {remove:()=>listeners.delete(callback)};}}};
  if(name==='expo-router')return {Redirect:()=>null,router:{replace:target=>current.routes.push(target),push:target=>current.routes.push(target)},useFocusEffect:callback=>{current.nextFocus=callback;}};
  if(name.endsWith('/session/provider'))return {useSession:()=>current.session};
  if(name==='./PersonalSetupView')return {PersonalSetupView:()=>null};
 }
 return originalLoad.call(this,name,parent,main);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=function(mod,file){const result=babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,plugins:[[local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],[local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]});mod._compile(result.code,file);};
const {PersonalSetup}=local(controllerFile);
const {levelFromExperience,experienceForLevel}=local(path.join(mobile,'src/features/setup/preferences.ts'));
const equalDeps=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function harness(step,profile={language:null,experience:null}) {
 const h={slots:[],index:0,effects:[],listeners:new Set(),routes:[],focused:true,nextFocus:null,focus:null,focusCleanup:null,view:null,saves:[],signouts:0};
 h.hooks={useState(initial){const i=h.index++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return [h.slots[i],value=>{h.slots[i]=typeof value==='function'?value(h.slots[i]):value;}];},useRef(initial){const i=h.index++;return h.slots[i]??={current:initial};},useCallback(fn,deps){const i=h.index++;if(!equalDeps(h.slots[i]?.deps,deps))h.slots[i]={fn,deps};return h.slots[i].fn;},useEffect(fn,deps){const i=h.index++;if(!equalDeps(h.slots[i]?.deps,deps)){const previous=h.slots[i];h.slots[i]={deps};h.effects.push(()=>{previous?.cleanup?.();h.slots[i].cleanup=fn();});}}};
 h.session={profile:{id:'synthetic',role:'personal_student',has_password:true,...profile},save:async body=>{h.saves.push(body);},logout:()=>{h.signouts++;}};
 h.render=()=>{current=h;h.index=0;h.nextFocus=null;h.view=PersonalSetup({step}).props;h.effects.splice(0).forEach(fn=>fn());if(h.nextFocus!==h.focus){h.focusCleanup?.();h.focus=h.nextFocus;h.focusCleanup=h.focused?h.focus?.():null;}return h.view;};
 h.blur=()=>{h.focused=false;h.focusCleanup?.();h.focusCleanup=null;};
 h.dispose=()=>{h.focusCleanup?.();for(const s of h.slots)s?.cleanup?.();};
 h.flush=async()=>{await new Promise(setImmediate);return h.render();};
 return h;
}

test('saved experience maps to three practice levels without inventing a default selection',()=>{
 assert.equal(levelFromExperience(null),null);assert.equal(levelFromExperience(undefined),null);
 for(const [experience,level]of [['starting_fresh','easy'],['some_words','easy'],['simple_conversations','medium'],['comfortable','hard']])assert.equal(levelFromExperience(experience),level);
 assert.equal(experienceForLevel('easy','some_words'),'some_words');assert.equal(experienceForLevel('easy','comfortable'),'starting_fresh');assert.equal(experienceForLevel('medium','some_words'),'simple_conversations');assert.equal(experienceForLevel('hard','some_words'),'comfortable');
});

test('language saves only on Continue, rejects duplicate taps, and advances after success',async()=>{
 const h=harness(1);let finish;h.session.save=body=>{h.saves.push(body);return new Promise(resolve=>{finish=resolve;});};
 try{h.render().onSave();assert.equal(h.saves.length,0);h.view.onSelect('tagalog');h.render();assert.equal(h.saves.length,0);h.view.onSave();h.view.onSave();h.render();assert(h.view.busy);assert.deepEqual(h.saves,[{language:'tagalog'}]);assert.equal(h.routes.length,0);finish();await h.flush();assert.deepEqual(h.routes,['/experience']);}finally{h.dispose();}
});

test('language Back follows saved completion and asks before signing out of first setup',()=>{
 for(const [profile,target]of [[{language:null,experience:null},null],[{language:'english',experience:null},'/experience'],[{language:'tagalog',experience:'some_words'},'/student']]){
  const h=harness(1,profile);try{h.render().onBack();h.render();if(target)assert.deepEqual(h.routes,[target]);else{assert(h.view.showExit);assert.equal(h.signouts,0);h.view.onStay();h.render();assert(!h.view.showExit);h.view.onBack();h.render();h.view.onSignOut();assert.equal(h.signouts,1);}}finally{h.dispose();}
 }
});

test('both languages save every chosen level, preserving legacy Easy when appropriate',async()=>{
 for(const language of ['english','tagalog'])for(const [saved,selection,expected]of [[null,'easy','starting_fresh'],['some_words','easy','some_words'],['comfortable','easy','starting_fresh'],['some_words','medium','simple_conversations'],[null,'hard','comfortable']]){
  const h=harness(2,{language,experience:saved});try{h.render();assert.equal(h.view.value,levelFromExperience(saved));h.view.onSelect(selection);h.render().onSave();await h.flush();assert.deepEqual(h.saves,[{language,experience:expected}]);assert.deepEqual(h.routes,['/student']);}finally{h.dispose();}
 }
});

test('failed saves keep the choice and permit retry without claiming success',async()=>{
 const h=harness(2,{language:'english',experience:null});let fail=true;h.session.save=async body=>{h.saves.push(body);if(fail)throw Object.assign(new Error('private backend details'),{status:503});};
 try{h.render().onSelect('medium');h.render().onSave();await h.flush();assert.equal(h.view.value,'medium');assert(h.view.error);assert(!h.view.error.includes('private'));assert.equal(h.routes.length,0);fail=false;h.view.onSave();await h.flush();assert.deepEqual(h.routes,['/student']);assert.equal(h.saves.length,2);}finally{h.dispose();}
});

test('Step 2 needs a saved language, requires a choice, and Back returns to Step 1',()=>{
 const missing=harness(2);try{assert.equal(missing.render().href,'/language');}finally{missing.dispose();}
 const h=harness(2,{language:'tagalog',experience:null});try{h.render().onSave();assert.equal(h.saves.length,0);h.view.onBack();assert.deepEqual(h.routes,['/language']);}finally{h.dispose();}
});

test('changing the saved language restores that language’s own starting preference',()=>{
 const h=harness(2,{language:'english',experience:'some_words'});try{h.render().onSelect('hard');h.render();h.session.profile={...h.session.profile,language:'tagalog',experience:null};h.render();h.render();assert.equal(h.view.value,null);}finally{h.dispose();}
});

test('Back subscriptions stop on blur and a late save cannot navigate another screen',async()=>{
 const h=harness(1,{language:'english',experience:'some_words'});let finish;h.session.save=()=>new Promise(resolve=>{finish=resolve;});
 try{h.render();assert.equal(h.listeners.size,1);h.view.onSave();h.render();h.view.onBack();assert.equal(h.routes.length,0);h.blur();assert.equal(h.listeners.size,0);finish();await h.flush();assert.equal(h.routes.length,0);}finally{h.dispose();}
});

test('the server profile update during saving does not prevent the expected next screen',async()=>{
 for(const step of [1,2]){
  const h=harness(step,{language:'english',experience:'some_words'});
  h.session.save=async body=>{h.saves.push(body);h.session.profile={...h.session.profile,...body};h.render();};
  try{h.render().onSelect(step===1?'tagalog':'hard');h.render().onSave();await h.flush();assert.deepEqual(h.routes,[step===1?'/experience':'/student']);}finally{h.dispose();}
 }
});
