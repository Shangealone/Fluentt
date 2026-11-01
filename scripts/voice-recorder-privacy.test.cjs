// Actual recorder hook with synthetic browser APIs; never opens a microphone.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../apps/mobile'),local=Module.createRequire(path.join(root,'package.json')),React=local('react'),ts=local('typescript'),original=Module._load;
Module._load=function(name,parent,main){
  if(name==='react-native')return{Platform:{OS:'web'}};
  if(name==='expo-audio')return{RecordingPresets:{HIGH_QUALITY:{}},useAudioRecorder(){return{};}};
  return original.call(this,name,parent,main);
};
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);
const {useAudioRecorder}=local(path.join(root,'src/features/pronunciation/useAudioRecorder.ts'));
function harness(){
  const slots=[],effects=[];
  return{
    render(){
      let index=0;const pending=[],saved={useState:React.useState,useRef:React.useRef,useCallback:React.useCallback,useEffect:React.useEffect};
      React.useState=initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
      React.useRef=initial=>{const i=index++;return slots[i]??(slots[i]={current:initial});};
      React.useCallback=(fn,deps)=>{const i=index++,prior=slots[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))slots[i]={fn,deps};return slots[i].fn;};
      React.useEffect=(fn,deps)=>{const i=index++,prior=effects[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))pending.push(()=>{prior?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
      try{const result=useAudioRecorder({privateTemporary:true,maximumDurationMs:29000});pending.forEach(fn=>fn());return result;}finally{Object.assign(React,saved);}
    },
    unmount(){effects.forEach(e=>e?.cleanup?.());},
  };
}
function setup(){
  const saved={navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),MediaRecorder:globalThis.MediaRecorder,create:URL.createObjectURL,revoke:URL.revokeObjectURL,now:Date.now};
  let clock=1000;Date.now=()=>clock;
  const recorders=[],created=[],revoked=[],tracks=[];
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getUserMedia(){const track={stopped:0,stop(){this.stopped++;}};tracks.push(track);return{getTracks:()=>[track]};}}}});
  globalThis.MediaRecorder=class{
    static isTypeSupported(){return true;}
    constructor(stream,options){this.state='inactive';this.mimeType=options.mimeType;recorders.push(this);}
    start(){this.state='recording';}
    stop(){this.state='inactive';}
    finish(){this.ondataavailable?.({data:new Blob(['final audio chunk'])});this.onstop?.();}
  };
  URL.createObjectURL=blob=>{const url=`blob:synthetic-${created.length}`;created.push({url,blob});return url;};
  URL.revokeObjectURL=url=>revoked.push(url);
  const hook=harness();
  return{hook,recorders,created,revoked,tracks,advance(){clock+=1500;},restore(){hook.unmount();Date.now=saved.now;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;globalThis.MediaRecorder=saved.MediaRecorder;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete globalThis.navigator;}};
}

test('private web preview URL is revoked on leaving the recorder',async()=>{
  const s=setup();try{
    await s.hook.render().startRecording();s.advance();await s.hook.render().stopRecording();s.recorders[0].finish();
    assert.equal(s.hook.render().status,'recorded');assert.equal(s.created[0].blob.size,17);
    s.hook.unmount();assert.deepEqual(s.revoked,[s.created[0].url]);
    assert(s.tracks.every(track=>track.stopped>0));
  }finally{s.restore();}
});

test('late private stop callback cannot restore a discarded recording',async()=>{
  const s=setup();try{
    await s.hook.render().startRecording();s.advance();await s.hook.render().stopRecording();
    await s.hook.render().discardRecording();s.recorders[0].finish();
    assert.equal(s.hook.render().audioPayload,null);assert.equal(s.hook.render().status,'ready');
    assert.equal(s.created.length,0);
  }finally{s.restore();}
});

test('private discard revokes preview once and stale chunks cannot enter the next take',async()=>{
  const s=setup();try{
    await s.hook.render().startRecording();s.advance();await s.hook.render().stopRecording();s.recorders[0].finish();
    await s.hook.render().discardRecording();assert.deepEqual(s.revoked,[s.created[0].url]);
    await s.hook.render().startRecording();s.recorders[0].finish();
    s.advance();await s.hook.render().stopRecording();s.recorders[1].finish();
    assert.equal(s.hook.render().audioPayload.size,17);assert.equal(s.created.length,2);
    s.hook.unmount();assert.deepEqual(s.revoked,s.created.map(row=>row.url));
  }finally{s.restore();}
});
