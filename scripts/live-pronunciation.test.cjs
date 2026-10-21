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
  if(name==='./liveSpeech'&&parent.filename.endsWith('useLiveWordTracking.ts'))return {createLiveSpeech(language,callbacks,options){
    const session={language,callbacks,options,stops:0,disposed:false,async start(){callbacks.onStart();},stop(){this.stops++;},dispose(){this.disposed=true;}};sessions.push(session);return session;
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
  session.callbacks.onResult('i like eating pizza',false);assert.equal(h.render().count,4);assert.equal(h.render().status,'listening');assert.equal(session.stops,0);
  session.callbacks.onResult('i like eating pizza',true);assert.equal(h.render().status,'complete');assert.equal(h.render().settled,false);assert.equal(session.stops,1);
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

// All provider results below are synthetic QA responses. No live audio/model claim.
const capability={available:true,provider:'azure-speech',locale:'en-US',maximum_duration_ms:30000,consent_version:'azure-whole-phrase-audio-v1',reason:'ready'};
const score={status:'scored',activity_id:activity.id,activity_version:activity.version,overall_score:37.5,accuracy_score:91,fluency_score:82,completeness_score:75,duration_ms:1000,provider:'azure-speech',locale:'en-US',contract_version:'whole-phrase-azure-rest-v1',model_version:null,simulated:false};
function uiText(tree){return nodes(tree,node=>typeof node.props?.children==='string'||Array.isArray(node.props?.children)).map(node=>React.Children.toArray(node.props.children).filter(value=>typeof value==='string'||typeof value==='number').join('')).join(' ');}
function readyApi(assess){return {async scoringCapabilities(){return capability;},assessWholePhrase:assess};}
async function enableAssessment(h){h.render();await tick();const toggle=nodes(h.render(),node=>node.props?.accessibilityRole==='checkbox')[0];assert.ok(toggle);toggle.props.onPress();h.render();}

test('whole-phrase scoring waits for finalized words, complete audio and end, then submits once',async()=>{
  const calls=[];let resolve;const api=readyApi((...args)=>{calls.push(args);return new Promise(r=>{resolve=r;});});
  const h=harness(()=>LivePronunciationPractice({activity,api,onDone(){}}));
  try{
    await enableAssessment(h);nodes(h.render(),node=>node.props?.label==='Record')[0].props.onPress();await tick();const session=sessions.at(-1);
    assert.equal(session.options.captureAudio,true);
    session.callbacks.onResult('i like eating pizza',false);h.render();assert.equal(calls.length,0);assert.equal(session.stops,0);
    session.callbacks.onResult('i like eating pizza',true);h.render();assert.equal(calls.length,0);
    const audio=new Blob(['SYNTHETIC_AUDIO_QA']),clip={audio,durationMs:1000,release(){}};
    session.callbacks.onRecording(clip);h.render();assert.equal(calls.length,0);
    session.callbacks.onEnd();h.render();assert.equal(calls.length,1);assert.equal(calls[0][1],audio);
    h.render();assert.equal(calls.length,1);resolve(score);await tick();
    const text=uiText(h.render());assert.ok(text.includes('37.5'));assert.ok(text.includes('Overall pronunciation score'));
    assert.equal(calls.length,1);
  }finally{h.blur();}
});

test('no permission keeps practice local and cannot generate a score from word matches',async()=>{
  const calls=[];const api=readyApi(async(...args)=>{calls.push(args);return score;});const h=harness(()=>LivePronunciationPractice({activity,api,onDone(){}}));
  try{
    h.render();await tick();nodes(h.render(),node=>node.props?.label==='Record')[0].props.onPress();await tick();const session=sessions.at(-1);
    assert.equal(session.options.captureAudio,false);session.callbacks.onResult('i like eating pizza',true);session.callbacks.onEnd();h.render();await tick();
    assert.equal(calls.length,0);assert.ok(!uiText(h.render()).includes('Overall pronunciation score'));
  }finally{h.blur();}
});

test('Voice history records the finished phrase once without audio, transcript or score',async()=>{
  const saved=[];const history={async record(body){saved.push(body);return body;}};
  const h=harness(()=>LivePronunciationPractice({activity,history,owner:'qa',onDone(){}}));
  try{
    h.render();nodes(h.render(),node=>node.props?.label==='Record')[0].props.onPress();await tick();const session=sessions.at(-1);
    session.callbacks.onResult('i like',false);h.render();await tick();assert.equal(saved.length,0);
    session.callbacks.onResult('i like eating pizza',true);h.render();await tick();assert.equal(saved.length,0);
    session.callbacks.onEnd();h.render();await tick();h.render();assert.equal(saved.length,1);assert.equal(saved[0].prompt,activity.target_text);
    assert.equal(saved[0].kind,'voice_phrase');for(const key of ['audio','transcript','score','answer'])assert.equal(key in saved[0],false);
  }finally{h.blur();}
});

test('manual finish assesses the complete recording only after explicit assessment; failure never retries',async()=>{
  let calls=0;const api=readyApi(async()=>{calls++;throw new Error('Synthetic provider unavailable');});const h=harness(()=>LivePronunciationPractice({activity,api,onDone(){}}));
  try{
    await enableAssessment(h);nodes(h.render(),node=>node.props?.label==='Record')[0].props.onPress();await tick();const session=sessions.at(-1);
    session.callbacks.onResult('i like',true);nodes(h.render(),node=>node.props?.label==='Finish recording')[0].props.onPress();
    session.callbacks.onRecording({audio:new Blob(['SYNTHETIC']),durationMs:1000,release(){}});session.callbacks.onEnd();
    const button=nodes(h.render(),node=>node.props?.label==='Assess whole recording')[0];assert.ok(button);assert.equal(calls,0);
    button.props.onPress();await tick();h.render();h.render();assert.equal(calls,1);assert.ok(!uiText(h.render()).includes('Overall pronunciation score'));
  }finally{h.blur();}
});

test('late assessment after leaving is discarded and simulated results are never shown as real',async()=>{
  const {useWholePhraseAssessment}=local(path.join(mobile,'src/features/pronunciation/useWholePhraseAssessment.ts'));
  let resolve,calls=0,released=0;const api=readyApi(()=>{calls++;return new Promise(r=>resolve=r);});
  const h=harness(()=>useWholePhraseAssessment(activity,api));
  h.render();await tick();h.render().setConsent(true);h.render();
  const clip={audio:new Blob(['SYNTHETIC']),durationMs:1000,release(){released++;}};
  const pending=h.render().assess(clip);h.blur();resolve(score);await pending;assert.equal(h.render().result,null);assert.equal(released,1);assert.equal(calls,1);
  const fake=readyApi(async()=>({...score,simulated:true}));const j=harness(()=>useWholePhraseAssessment(activity,fake));
  try{j.render();await tick();j.render().setConsent(true);await j.render().assess(clip);assert.equal(j.render().result,null);assert.match(j.render().error,/No verified/);}finally{j.blur();}
});

test('WAV encoder preserves actual PCM audio samples for server-side acoustic assessment',()=>{
  const {pcm16Wav}=local(path.join(mobile,'src/features/pronunciation/wholePhraseAudio.web.ts'));
  const data=pcm16Wav(new Float32Array([-1,0,1]));const view=new DataView(data);
  assert.equal(new TextDecoder().decode(data.slice(0,4)),'RIFF');assert.equal(view.getUint32(24,true),16000);
  assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint16(34,true),16);
  assert.deepEqual([view.getInt16(44,true),view.getInt16(46,true),view.getInt16(48,true)],[-32768,0,32767]);
});

test('browser capture includes the final recorder chunk before resampling the whole clip',async()=>{
  const {startWholePhraseCapture}=local(path.join(mobile,'src/features/pronunciation/wholePhraseAudio.web.ts'));
  const names=['navigator','MediaRecorder','AudioContext','OfflineAudioContext'],saved=names.map(name=>Object.getOwnPropertyDescriptor(global,name));
  let recorder,stops=0,closed=0,decodedText='';
  class Recorder{state='inactive';mimeType='audio/webm';constructor(){recorder=this;}start(){this.state='recording';this.ondataavailable({data:new Blob(['first-'])});}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['last'])});this.onstop();}}
  class Context{async decodeAudioData(data){decodedText=new TextDecoder().decode(data);return {duration:1};}async close(){closed++;}}
  class Offline{constructor(channels,frames,rate){assert.deepEqual([channels,frames,rate],[1,16000,16000]);}createBufferSource(){return {connect(){},start(){}};}async startRendering(){return {duration:1,getChannelData(){return new Float32Array(16000).fill(0.25);}};}}
  const values=[{mediaDevices:{async getUserMedia(){return {getTracks:()=>[{stop(){stops++;}}]};}}},Recorder,Context,Offline];
  names.forEach((name,i)=>Object.defineProperty(global,name,{configurable:true,writable:true,value:values[i]}));
  try{
    const capture=await startWholePhraseCapture();assert.equal(recorder.state,'recording');
    const clip=await capture.finish();assert.equal(decodedText,'first-last');assert.equal(clip.durationMs,1000);assert.equal(clip.audio.type,'audio/wav');assert.equal(clip.audio.size,32044);
    const view=new DataView(await clip.audio.arrayBuffer());assert.equal(view.getInt16(44,true),8191);assert.equal(closed,1);assert.ok(stops>0);capture.dispose();
    const cancelled=await startWholePhraseCapture();cancelled.dispose();await assert.rejects(cancelled.finish(),/discarded/);assert.equal(closed,1);
  }finally{names.forEach((name,i)=>{if(saved[i])Object.defineProperty(global,name,saved[i]);else delete global[name];});}
});
