// Synthetic QA activity only; no live voice, provider or human research observations.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const mobile=path.resolve(__dirname,'../apps/mobile'),local=Module.createRequire(path.join(mobile,'package.json'));
const React=local('react'),babel=local('@babel/core'),original=Module._load;let session;
Module._load=function(name,parent,main){
  if(name==='react-native')return local('react-native-web');
  if(name==='react-native-safe-area-context')return {SafeAreaView:local('react-native-web').View};
  if(name==='expo-router')return {useFocusEffect:fn=>React.useEffect(fn,[fn]),router:{push(){},canGoBack(){return false;}}};
  if(name.endsWith('/session/provider'))return {useSession:()=>session};
  if(name==='../pronunciation/useAudioRecorder')return {useAudioRecorder:()=>({status:'idle',durationMs:0})};
  return original.call(this,name,parent,main);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=function(module,filename){module._compile(babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,plugins:[
  [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext==='.tsx',allExtensions:true}],[local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],[local.resolve('@babel/plugin-transform-modules-commonjs'),{noInterop:filename.endsWith('ConversationPractice.tsx')}]]}).code,filename);};
const {useActivityHistory,hasPracticeAnswer}=local(path.join(mobile,'src/features/history/useActivityHistory.ts'));
const {PersonalHistory}=local(path.join(mobile,'src/features/history/PersonalHistory.tsx'));
const {createDemoPersonalHistory}=local(path.join(mobile,'src/demo/personalHistory.ts'));
const {ConversationPractice}=local(path.join(mobile,'src/features/conversation/ConversationPractice.tsx'));
const Stats=local(path.join(mobile,'src/app/personal-stats.tsx')).default;
const {personalHistoryAccess,validatePersonalActivity}=local(path.join(mobile,'src/services/api/personalHistory.ts'));
function harness(Component){const slots=[],effects=[];let cursor;return {render(){cursor=0;const queue=[],saved={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback};
  React.useState=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
  React.useRef=init=>{const i=cursor++;return slots[i]??(slots[i]={current:init});};
  React.useCallback=(fn,deps)=>{const i=cursor++,prior=slots[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))slots[i]={fn,deps};return slots[i].fn;};
  React.useEffect=(fn,deps)=>{const i=cursor++,prior=effects[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))queue.push(()=>{prior?.cleanup?.();effects[i]={deps,cleanup:fn()};});};
  try{const tree=Component();queue.forEach(fn=>fn());return tree;}finally{Object.assign(React,saved);}
},blur(){effects.forEach(effect=>effect?.cleanup?.());}};}
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];return[...(predicate(tree)?[tree]:[]),...React.Children.toArray(tree.props?.children).flatMap(child=>nodes(child,predicate))];}
function text(tree){return nodes(tree,node=>typeof node.props?.children==='string').map(node=>node.props.children).join(' ');}
const press=(h,label)=>{const node=nodes(h.render(),n=>n.props?.label===label)[0];assert.ok(node,label);node.props.onPress();};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const input={kind:'learn_question',source_id:'en-want-water',title:'Build a sentence',prompt:'I want water',language:'english'};
const row=body=>({...body,id:body.event_key,recorded_at:'2026-10-21T01:00:00Z',evidence:'client-reported-activity-v1'});

test('history receipts deduplicate, expose failed saves and retry the same request identity',async()=>{
  const calls=[];let fail=true;const api={async record(body){calls.push(body);if(fail)throw new Error('Synthetic network loss');return row(body);}};
  const h=harness(()=>useActivityHistory(api,'synthetic-owner'));h.render();
  h.render().recordOnce('q1',input);h.render().recordOnce('q1',input);await tick();assert.equal(calls.length,1);assert.match(h.render().error,/could not be saved/);
  fail=false;h.render().retry();await tick();assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(h.render().error,'');
  assert.equal('answer' in calls[0],false);assert.equal('score' in calls[0],false);h.blur();h.render().recordOnce('late',input);await tick();assert.equal(calls.length,2);
});

test('history has no default/demo fabricated records and filters only actual sample actions',async()=>{
  const api=createDemoPersonalHistory();assert.equal((await api.list()).items.length,0);
  for(let i=0;i<23;i++)await api.record({...input,event_key:require('node:crypto').randomUUID(),kind:i===0?'voice_phrase':'learn_question'});
  const page=await api.list();assert.equal(page.items.length,20);assert.equal(page.has_more,true);assert.equal((await api.list('all',20)).items.length,3);
  assert.equal((await api.list('voice')).items.length,1);assert.equal((await api.list('tutor')).items.length,0);
  assert.equal((await createDemoPersonalHistory().list()).items.length,0);
});

test('Stats opens a separate History view and keeps classroom roles out',()=>{
  session={profile:{id:'qa',role:'personal_student',learning_focus:{}},isDemo:true,activityHistory:createDemoPersonalHistory()};
  const h=harness(Stats);press(h,'History');assert.equal(nodes(h.render(),n=>n.type===PersonalHistory).length,1);
  assert.equal(h.render().props.title,'Your learning history');press(h,'Overview');assert.equal(nodes(h.render(),n=>n.type===PersonalHistory).length,0);h.blur();
  session.profile.role='school_student';const other=harness(Stats);assert.equal(other.render(),null);other.blur();
});

test('history filters, pagination, errors and late owner responses never show stale records',async()=>{
  const calls=[];let resolve;const first={...row({...input,event_key:'old'}),title:'Old owner lesson'};
  const api={list(area,offset){calls.push({area,offset});return new Promise(done=>{resolve=done;});}};
  let owner='first';const h=harness(()=>PersonalHistory({api,owner,demo:false}));h.render();resolve({items:[first],offset:0,has_more:true});await tick();assert.ok(text(h.render()).includes('Old owner lesson'));
  press(h,'Voice');assert.ok(!text(h.render()).includes('Old owner lesson'));assert.equal(calls.at(-1).area,'voice');
  owner='second';h.render();const current=resolve;h.blur();current({items:[first],offset:0,has_more:false});await tick();assert.ok(!text(h.render()).includes('Old owner lesson'));
  const bad=harness(()=>PersonalHistory({api:{async list(){throw new Error('Private synthetic error');}},owner:'qa',demo:false}));bad.render();await tick();
  assert.ok(nodes(bad.render(),n=>n.props?.message?.includes('could not load')).length);assert.ok(!text(bad.render()).includes('Private synthetic error'));bad.blur();
});

test('only entered answers count: false is an answer, empty blanks and unrecalled cards are not',()=>{
  assert.equal(hasPracticeAnswer('true_false',{value:false}),true);assert.equal(hasPracticeAnswer('identification',{text:''}),false);
  assert.equal(hasPracticeAnswer('fill_in_the_blank',{blanks:[{blank_id:'b',text:''}]}),false);
  assert.equal(hasPracticeAnswer('flashcards',{revealed:true,recall:null}),false);assert.equal(hasPracticeAnswer('flashcards',{revealed:true,recall:'good'}),true);
  assert.equal(hasPracticeAnswer('multiple_select',{selected_option_ids:[]}),false);
});

test('authenticated history client validates receipts and never accepts scores or another event',async()=>{
  const previous=global.fetch,base=process.env.EXPO_PUBLIC_API_URL,calls=[];process.env.EXPO_PUBLIC_API_URL='https://synthetic.example';
  const body={...input,event_key:require('node:crypto').randomUUID()};
  global.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(options.method==='POST'?row(body):{items:[row(body)],offset:0,has_more:false}),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const api=personalHistoryAccess(fn=>fn('SYNTHETIC_CREDENTIAL'));await api.record(body);assert.deepEqual(JSON.parse(calls[0].options.body),body);assert.equal(calls[0].options.headers.Authorization,'Bearer SYNTHETIC_CREDENTIAL');
    assert.equal((await api.list('voice')).items.length,1);assert.ok(calls[1].url.endsWith('/me/personal-history?area=voice&offset=0'));
    for(const changes of [{score:100},{audio:'forbidden'},{evidence:'research'},{kind:'tutor_reply',prompt:'private'}])assert.throws(()=>validatePersonalActivity({...row(body),...changes}));
    global.fetch=async()=>new Response(JSON.stringify({...row(body),event_key:'another'}),{status:200});await assert.rejects(api.record(body),/did not match/);
  }finally{global.fetch=previous;if(base===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=base;}
});

test('Tutor logs only accepted replies/scenario metadata and never dialogue or school activity',async()=>{
  for(const role of ['personal_student','school_student']){
    const saved=[];const api={async record(body){saved.push(body);return row(body);}};
    const topic={id:'synthetic-topic',title:'Synthetic cafe scenario',language:'english',vocabulary_hints:[]};
    session={profile:{id:'qa',role,language:'english'},activityHistory:api,conversation:{async topics(){return{topics:[topic]};},async startSession(){return {session_id:'synthetic-session',topic_id:topic.id,topic_title:topic.title,language:'english',persona:'QA',messages:[],turns_count:0,max_turns:20};},async sendMessage(){return {user_message:{id:'message-qa',role:'user',content:'PRIVATE_SYNTHETIC_REPLY'},assistant_message:{id:'assistant-qa',role:'assistant',content:'PRIVATE_SYNTHETIC_RESPONSE'},turns_count:1,is_session_complete:false};},async endSession(){return {turns_completed:1};}}};
    const h=harness(()=>ConversationPractice({}));h.render();await tick();press(h,'Start Scenario');await tick();assert.equal(saved.length,0);
    nodes(h.render(),n=>n.props?.accessibilityLabel==='Your conversation reply')[0].props.onChangeText('PRIVATE_SYNTHETIC_REPLY');
    nodes(h.render(),n=>n.props?.accessibilityLabel==='Send reply')[0].props.onPress();await tick();h.render();
    const finish=nodes(h.render(),n=>typeof n.props?.onPress==='function'&&nodes(n,c=>c.props?.children==='Finish').length)[0];assert.ok(finish);finish.props.onPress();await tick();
    if(role==='personal_student'){assert.equal(saved.length,2);assert.deepEqual(saved.map(x=>x.kind),['tutor_reply','tutor_session']);assert.ok(saved.every(x=>x.prompt===null));assert.ok(!JSON.stringify(saved).includes('PRIVATE_SYNTHETIC'));}
    else assert.equal(saved.length,0);h.blur();
  }
});
