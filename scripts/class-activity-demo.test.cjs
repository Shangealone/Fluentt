// Synthetic, in-memory QA only. No database accounts or real learner outcomes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../apps/mobile'),local=Module.createRequire(path.join(root,'package.json')),ts=local('typescript'),React=local('react');
let params={},session,load;
const original=Module._load;
Module._load=function(name,parent,main){
  if(name==='expo-router')return {useLocalSearchParams:()=>params,router:{},usePreventRemove:()=>()=>{}};
  if(name==='expo-crypto')return {randomUUID:()=> 'synthetic-key'};
  if(name==='react-native')return local('react-native-web');
  if(name==='react-native-safe-area-context')return {SafeAreaView:local('react-native-web').View};
  if(name.endsWith('/session/provider'))return {useSession:()=>session};
  if(name.endsWith('/dashboard/usePagedList'))return {usePagedList:fetch=>{load=fetch;return{state:{phase:'loading',rows:[]},reload(){}};}};
  return original.call(this,name,parent,main);
};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
const {demoStore,DEMO_ASSIGNMENT_ITEMS:items,DEMO_LESSON_CONTEXT:lesson,createDemoAssignmentApi,createDemoCaptureApi,createDemoResultsApi}=local(path.join(root,'src/demo/demoData.ts'));
const Builder=local(path.join(root,'src/app/assignment-builder.tsx')).default;
const body=ids=>({title:'Synthetic mixed-type activity',instructions:'QA only',lesson_id:lesson.lesson_id,question_revision_ids:ids});

test('new builder route never loads an existing draft; explicit edits check class identity',async()=>{
  const saved={useCallback:React.useCallback};React.useCallback=fn=>fn;
  let gets=0;session={isDemo:false,profile:{role:'instructor'},classes:{async get(id){return{id};}},assignments:{async get(id){gets++;return{id,class_id:'class-a'};}}};
  try{
    params={classId:'class-a'};Builder();const created=await load();assert.equal(created[0].draft,null);assert.equal(gets,0);
    params={classId:'class-a',id:'draft-a'};Builder();assert.equal((await load())[0].draft.id,'draft-a');assert.equal(gets,1);
    params={classId:'class-b',id:'draft-a'};Builder();await assert.rejects(load(),/different class/);
    params={};Builder();await assert.rejects(load(),/Open a class/);
  }finally{Object.assign(React,saved);}
});
test('demo catalog filters every type, respects lesson/class scope, and starts empty drafts',async()=>{
  demoStore.reset();const api=createDemoAssignmentApi();
  for(const item of items){const page=await api.questions('demo-class-1',lesson.lesson_id,'',item.definition.method);assert.equal(page.items.length,1);assert.equal(page.items[0].id,item.id);}
  assert.equal((await api.questions('demo-class-2',lesson.lesson_id)).items.length,0);
  assert.equal((await api.questions('demo-class-1','other-lesson')).items.length,0);
  assert.equal((await api.questions('demo-class-1',lesson.lesson_id,'NO_MATCHING_SYNTHETIC_PROMPT')).items.length,0);
  const draft=await api.create('demo-class-1',body([]),'qa');assert.deepEqual(draft.questions,[]);
  await assert.rejects(api.publish(draft,'qa'),/Add questions/);
});
test('selected mixed types persist through draft save, publication and exact student delivery',async()=>{
  demoStore.reset();const api=createDemoAssignmentApi(),capture=createDemoCaptureApi();
  const chosen=['identification','multiple_choice'].map(method=>items.find(i=>i.definition.method===method));
  let draft=await api.create('demo-class-1',body([chosen[0].id]),'qa-create');
  assert.deepEqual(draft.questions.map(i=>i.id),[chosen[0].id]);
  draft=await api.save(draft,body(chosen.map(i=>i.id)));
  const published=await api.publish(draft,'qa-publish');assert.equal(published.editable,false);
  assert.equal((await api.published('demo-class-2')).items.some(row=>row.id===draft.id),false);
  const metadata=await api.publishedDetail(draft.id);assert.deepEqual(metadata.methods,['identification','multiple_choice']);assert(!('questions' in metadata));
  await api.publish(draft,'qa-publish');assert.equal((await api.published('demo-class-1')).items.filter(row=>row.id===draft.id).length,1);
  await assert.rejects(api.save(published,body([])),/cannot be edited/);await assert.rejects(api.archive(published),/cannot be archived/);
  published.questions.length=0;const attempt=await capture.start(draft.id);
  assert.deepEqual(attempt.questions.map(i=>i.id),chosen.map(i=>i.id));assert.equal(attempt.question_count,2);
  assert.equal((await capture.start(draft.id)).id,attempt.id);
  const other=await api.create('demo-class-1',body([items[1].id]),'qa-other');await api.publish(other,'qa-other-publish');
  const otherAttempt=await capture.start(other.id);assert.notEqual(otherAttempt.id,attempt.id);
  const progress={position:1,responses:[{assignment_question_id:attempt.questions[0].assignment_question_id,answer:{text:'Synthetic answer'}}]};
  await capture.save(attempt,progress);assert.equal((await capture.read(attempt.id)).responses.length,1);assert.equal((await capture.read(otherAttempt.id)).responses.length,0);
  const receipt=await capture.submit(attempt,progress,'qa-submit');assert.equal(receipt.status,'submitted');assert.deepEqual(receipt.questions,[]);assert.deepEqual(receipt.responses,[]);
  await assert.rejects(capture.save(receipt,progress),/cannot be changed/);
  await assert.rejects(createDemoResultsApi().student(draft.id),/No scores/);
  await assert.rejects(createDemoResultsApi().owner(attempt.id),/No scores/);
  demoStore.reset();
});
