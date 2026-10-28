const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../apps/mobile'),local=Module.createRequire(path.join(root,'package.json'));
const React=local('react'),babel=local('@babel/core'),original=Module._load;
let callback,capability,requestReply,seen=[];
Module._load=function(name,parent,main){
 if(name==='react-native')return {...local('react-native-web'),AppState:{addEventListener(_,cb){callback=cb;return{remove(){}};}}};
 if(name==='react-native-safe-area-context')return{SafeAreaView:local('react-native-web').View};
 if(name==='expo-router')return{useFocusEffect:effect=>React.useEffect(effect,[effect])};
 if(name==='../learning/useLessonSpeech')return{useLessonSpeech(){return{speaking:false,error:'',async stop(){},async play(){}};}};
 if(name==='../../services/api/liveTutor')return{liveTutorApi:{async capabilities(){return capability;},async reply(...args){seen.push(args);return requestReply(...args);}}};
 return original.call(this,name,parent,main);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,file)=>module._compile(babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,plugins:[
 [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],[local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')]}).code,file);
const {LiveTutorPractice}=local(path.join(root,'src/features/conversation/LiveTutorPractice.tsx'));
const {validateTutorReply,liveTutorApi}=local(path.join(root,'src/services/api/liveTutor.ts'));
function harness(Component){const slots=[],effects=[];let cursor;return{
 render(){cursor=0;const queue=[],saved={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback};
 React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];};
 React.useRef=init=>{const i=cursor++;return slots[i]??(slots[i]={current:init});};
 React.useCallback=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j])))slots[i]={fn,deps};return slots[i].fn;};
 React.useEffect=(fn,deps)=>{const i=cursor++,old=effects[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j])))queue.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
 try{const tree=Component();queue.forEach(fn=>fn());return tree;}finally{Object.assign(React,saved);}},blur(){effects.forEach(e=>e?.cleanup?.());}};}
function nodes(tree,match){if(!tree||typeof tree!=='object')return[];return[...(match(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(n=>nodes(n,match))];}
function button(h,label){return nodes(h.render(),n=>n.props?.label===label)[0];}
const tick=()=>new Promise(r=>setImmediate(r));
const topic={id:'topic',language:'english',title:'Cafe',persona:'Barista',starter_prompt:'Welcome! What would you like?',scenario_description:'Order a drink.',goal:'Order politely.'};
const fixture={reply:'We have decaf tea. Would you like it iced?',coaching:'Try asking about the cup size.',simulated:false,saved:false,provider:'Groq',model:'QA',contract:'local-tutor-groq-v1'};
async function ready(){seen=[];capability={available:true,topics:[topic],model:'QA'};requestReply=async()=>fixture;const h=harness(()=>LiveTutorPractice({language:'english',onBack(){}}));h.render();button(h,'Check AI connection').props.onPress();await tick();h.render();return h;}
async function choose(h){nodes(h.render(),n=>n.props?.accessibilityRole==='checkbox')[0].props.onPress();button(h,'Start live conversation').props.onPress();h.render();}
function draft(h,text){nodes(h.render(),n=>n.props?.accessibilityLabel==='Your live AI reply')[0].props.onChangeText(text);}
test('live demo requires permission before starting or sending, preserves history and generated coaching',async()=>{const h=await ready();try{
 assert.equal(button(h,'Start live conversation').props.disabled,true);assert.equal(seen.length,0);await choose(h);
 draft(h,'Do you have decaf tea?');button(h,'Send to AI partner').props.onPress();await tick();
 assert.deepEqual(seen[0][1],[{role:'assistant',content:topic.starter_prompt},{role:'user',content:'Do you have decaf tea?'}]);
 draft(h,'Iced please');button(h,'Send to AI partner').props.onPress();await tick();assert.equal(seen[1][1][2].content,fixture.reply);
 assert.equal(nodes(h.render(),n=>n.props?.children===fixture.coaching).length,1);
 }finally{h.blur();}});
test('failure keeps the actual draft and never displays a scripted replacement',async()=>{const h=await ready();try{await choose(h);requestReply=async()=>{throw Error('Synthetic provider unavailable');};draft(h,'Unsweetened tea please');button(h,'Send to AI partner').props.onPress();await tick();
 assert.equal(nodes(h.render(),n=>n.props?.accessibilityLabel==='Your live AI reply')[0].props.value,'Unsweetened tea please');
 assert.equal(nodes(h.render(),n=>n.props?.children==='AI partner · Generated reply').length,0);
 }finally{h.blur();}});
test('leaving or backgrounding clears consent and discards late AI replies',async()=>{const h=await ready();try{await choose(h);let resolve;requestReply=()=>new Promise(r=>resolve=r);draft(h,'Tea please');button(h,'Send to AI partner').props.onPress();await tick();callback('background');h.render();resolve(fixture);await tick();
 assert.equal(nodes(h.render(),n=>n.props?.accessibilityRole==='checkbox')[0].props.accessibilityState.checked,false);
 assert.equal(nodes(h.render(),n=>n.props?.children===fixture.reply).length,0);
 }finally{h.blur();}});
test('client rejects simulated, malformed and mismatched provider replies',()=>{assert.equal(validateTutorReply(fixture).reply,fixture.reply);for(const edit of [{simulated:true},{saved:true},{provider:'other'},{reply:''},{coaching:42},{contract:'unknown'}])assert.throws(()=>validateTutorReply({...fixture,...edit}));});
test('client sends text and permission without credentials or provider key to the fixed demo endpoint',async()=>{
 const old=process.env.EXPO_PUBLIC_API_URL,fetch=global.fetch;process.env.EXPO_PUBLIC_API_URL='http://localhost:8000';let sent;
 global.fetch=async(url,options)=>{sent={url,options};return{ok:true,status:200,json:async()=>fixture};};try{await liveTutorApi.reply('topic',[{role:'user',content:'Tea please'}]);assert(sent.url.endsWith('/api/v1/demo/tutor/reply'));const data=JSON.parse(sent.options.body);assert.equal(data.permission,'groq-text-demo-v1');assert.equal(sent.options.headers.Authorization,undefined);assert.equal('api_key' in data,false);}finally{global.fetch=fetch;if(old===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=old;}
});
