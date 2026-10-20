const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname,'../apps/mobile');
const local = Module.createRequire(path.join(mobile,'package.json'));
const React = local('react'), babel = local('@babel/core'), original = Module._load;
const sessions=[];let background, native;
Module._load=function(name,parent,main){
  if(name==='react-native')return {...local('react-native-web'),AppState:{addEventListener(_,callback){background=callback;return {remove(){background=null;}};}}};
  if(name==='react-native-safe-area-context')return {SafeAreaView:local('react-native-web').View};
  if(name==='expo-router')return {useFocusEffect:effect=>React.useEffect(effect,[effect])};
  if(name==='./liveSpeech'&&parent.filename.endsWith('useLiveWordTracking.ts'))return {createLiveSpeech(language,callbacks){
    const session={language,callbacks,stops:0,disposed:false,async start(){callbacks.onStart();},stop(){this.stops++;},dispose(){this.disposed=true;}};sessions.push(session);return session;
  }};
  if(name==='expo'&&parent.filename.endsWith('liveSpeech.ts'))return {requireOptionalNativeModule(){return native;}};
  if(name==='../learning/useLessonSpeech')return {useLessonSpeech(){return {speaking:false,error:'',async play(){return true;},async stop(){return true;}};}};
  return original.call(this,name,parent,main);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=function(module,filename){module._compile(babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,plugins:[
  [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],
  [local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]}).code,filename);};
const {speechWords,spokenWordCount}=local(path.join(mobile,'src/features/pronunciation/liveWordTracking.ts'));
const {useLiveWordTracking}=local(path.join(mobile,'src/features/pronunciation/useLiveWordTracking.ts'));
const {LivePronunciationPractice}=local(path.join(mobile,'src/features/pronunciation/LivePronunciationPractice.tsx'));
const {createLiveSpeech:createWeb,prepareOfflineSpeech}=local(path.join(mobile,'src/features/pronunciation/liveSpeech.web.ts'));
const {createLiveSpeech:createNative}=local(path.join(mobile,'src/features/pronunciation/liveSpeech.ts'));
function harness(Component){
  const slots=[],effects=[];let cursor;
  return {render(){cursor=0;const queue=[],saved={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback};
    React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
    React.useRef=init=>{const i=cursor++;return slots[i]??(slots[i]={current:init});};
    React.useCallback=(fn,deps)=>{const i=cursor++,prior=slots[i];if(!prior||deps.some((value,j)=>!Object.is(value,prior.deps[j])))slots[i]={fn,deps};return slots[i].fn;};
    React.useEffect=(fn,deps)=>{const i=cursor++,prior=effects[i];if(!prior||deps.some((value,j)=>!Object.is(value,prior.deps[j])))queue.push(()=>{prior?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
    try{const result=Component();queue.forEach(fn=>fn());return result;}finally{Object.assign(React,saved);}
  },blur(){effects.forEach(effect=>effect?.cleanup?.());}};
}
function nodes(element,predicate){if(!element||typeof element!=='object')return[];return[...(predicate(element)?[element]:[]),...React.Children.toArray(element.props?.children).flatMap(child=>nodes(child,predicate))];}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const activity={id:'phrase',language:'english',target_text:'I like eating pizza.',version:1,instructions:null};

test('ordered word matching highlights only heard words, including repeats and Tagalog',()=>{
  assert.deepEqual(speechWords('I LIKE eating pizza!'),['i','like','eating','pizza']);
  assert.equal(spokenWordCount(activity.target_text,'i like'),2);
  assert.equal(spokenWordCount(activity.target_text,'i like pizza'),2);
  assert.equal(spokenWordCount(activity.target_text,'pizza eating like i'),1);
  assert.equal(spokenWordCount(activity.target_text,'um i i like eating pizza'),4);
  assert.equal(spokenWordCount('The book is on the table','the book is on table'),4);
  assert.equal(spokenWordCount('Gusto ko ng pizza.','gusto ko'),2);
  assert.equal(spokenWordCount('Gusto ko ng pizza.','Gusto ko ng pizza!'),4);
  assert.equal(spokenWordCount("Don't stop",'don’t stop'),2);
});
test('live interim updates can revise highlights; only a full finalized phrase completes',async()=>{
  const h=harness(()=>useLiveWordTracking(activity.target_text,'english'));h.render();await h.render().start();const session=sessions.at(-1);
  session.callbacks.onResult('i like',false);assert.equal(h.render().count,2);assert.equal(h.render().status,'listening');
  session.callbacks.onResult('i light',false);assert.equal(h.render().count,1);
  session.callbacks.onResult('i like eating pizza',false);assert.equal(h.render().count,4);assert.equal(h.render().status,'stopping');assert.equal(session.stops,1);
  session.callbacks.onResult('i like eating pizza',true);assert.equal(h.render().status,'complete');assert.equal(h.render().settled,false);
  session.callbacks.onEnd();assert.equal(h.render().settled,true);
  await h.render().start();assert.equal(h.render().count,0);assert.equal(h.render().transcript,'');
  session.callbacks.onResult('i like eating pizza',true);assert.equal(h.render().count,0);h.blur();
});
test('partial stops, errors, background and blur cannot complete or retain a stale session',async()=>{
  const h=harness(()=>useLiveWordTracking(activity.target_text,'english'));h.render();await h.render().start();let session=sessions.at(-1);
  session.callbacks.onResult('i like',true);h.render().stop();session.callbacks.onEnd();assert.equal(h.render().status,'paused');assert.equal(h.render().count,2);
  await h.render().start();session=sessions.at(-1);session.callbacks.onError('Microphone denied');assert.equal(h.render().status,'error');assert.equal(session.disposed,true);
  await h.render().start();session=sessions.at(-1);session.callbacks.onResult('i like',false);background('background');assert.equal(h.render().count,0);assert.equal(session.disposed,true);
  session.callbacks.onResult('i like eating pizza',true);assert.equal(h.render().status,'idle');
  await h.render().start();session=sessions.at(-1);h.blur();session.callbacks.onResult('i like eating pizza',true);assert.equal(h.render().status,'idle');
});
test('personal phrase UI displays progressive heard states and automatic completion',async()=>{
  let done=0;const h=harness(()=>LivePronunciationPractice({activity,onDone(){done++;}}));h.render();
  nodes(h.render(),node=>node.props?.label==='Record')[0].props.onPress();await tick();const session=sessions.at(-1);
  session.callbacks.onResult('i like',false);
  assert.equal(nodes(h.render(),node=>node.props?.accessibilityLabel?.endsWith(': heard')).length,2);
  assert.equal(nodes(h.render(),node=>node.props?.accessibilityLabel?.endsWith(': not yet heard')).length,2);
  session.callbacks.onResult('i like eating pizza',true);session.callbacks.onEnd();
  assert.equal(nodes(h.render(),node=>node.props?.accessibilityLabel?.endsWith(': heard')).length,4);
  nodes(h.render(),node=>node.props?.label==='Choose another phrase')[0].props.onPress();assert.equal(done,1);h.blur();
});
test('web driver uses local recognition, combines interim results and releases listeners',async()=>{
  let instance;class Recognition{processLocally=false;static async available(){return 'available';}constructor(){instance=this;}start(){this.onstart();}stop(){}abort(){this.aborted=true;}}
  global.window={SpeechRecognition:Recognition};const results=[];
  const session=createWeb('english',{onStart(){},onResult:(text,final)=>results.push({text,final}),onError(){},onEnd(){}});
  await session.start();assert.equal(instance.processLocally,true);assert.equal(instance.interimResults,true);assert.equal(instance.lang,'en-US');
  instance.onresult({results:[{isFinal:true,0:{transcript:'i like'}},{isFinal:false,0:{transcript:'eating'}}]});assert.deepEqual(results,[{text:'i like eating',final:false}]);
  session.dispose();assert.equal(instance.aborted,true);assert.equal(instance.onresult,null);
  class RemoteOnly{start(){throw new Error('must never start');}}global.window={SpeechRecognition:RemoteOnly};
  await assert.rejects(createWeb('english',{}).start(),/does not support on-device/);delete global.window;
});
test('native driver requires offline language, never persists audio and cancels pending permission starts',async()=>{
  const listeners={};let options,resolvePermission;
  native={isRecognitionAvailable:()=>true,supportsOnDeviceRecognition:()=>true,async getStateAsync(){return 'inactive';},async getSupportedLocales(){return {installedLocales:['en_US']};},async requestPermissionsAsync(){return {granted:true};},addListener(name,fn){listeners[name]=fn;return {remove(){delete listeners[name];}};},start(value){options=value;},stop(){},abort(){}};
  const callbacks={onStart(){},onResult(){},onError(){},onEnd(){}};
  const session=createNative('english',callbacks);await session.start();assert.equal(options.lang,'en-US');assert.equal(options.requiresOnDeviceRecognition,true);assert.deepEqual(options.recordingOptions,{persist:false});session.dispose();assert.deepEqual(listeners,{});
  await assert.rejects(createNative('tagalog',callbacks).start(),/Install an offline Tagalog/);
  options=null;native.requestPermissionsAsync=()=>new Promise(resolve=>{resolvePermission=resolve;});
  const pending=createNative('english',callbacks),start=pending.start();await tick();pending.dispose();resolvePermission({granted:true});await start;assert.equal(options,null);
});
test('browser offline setup downloads only a supported language and never starts the microphone',async()=>{
  const requests=[];class Recognition{
    static async available(options){requests.push(['available',options]);return 'downloadable';}
    static async install(options){requests.push(['install',options]);return true;}
    start(){throw new Error('setup must not record');}
  }
  global.window={SpeechRecognition:Recognition};await prepareOfflineSpeech('english');
  assert.deepEqual(requests,[['available',{langs:['en-US'],processLocally:true}],['install',{langs:['en-US'],processLocally:true}]]);
  Recognition.available=async()=> 'unavailable';
  await assert.rejects(prepareOfflineSpeech('tagalog'),/does not offer offline Tagalog/);delete global.window;
});
