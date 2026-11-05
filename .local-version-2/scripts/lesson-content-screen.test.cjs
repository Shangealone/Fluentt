// Route-level behavior checks with synthetic sessions; no network or database writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const babel = local('@babel/core');
const React = local('react');
let runner;
let session;
let uuid = 0;
const events = [];
const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
const hooks = {
  ...React,
  useState(initial) {
    const index = runner.cursor++;
    if (!(index in runner.slots)) runner.slots[index] = typeof initial === 'function' ? initial() : initial;
    const owner = runner;
    return [owner.slots[index], value => { owner.slots[index] = typeof value === 'function' ? value(owner.slots[index]) : value; }];
  },
  useRef(initial) {
    const index = runner.cursor++;
    return runner.slots[index] ??= { current: initial };
  },
  useCallback(fn, deps) {
    const index = runner.cursor++;
    if (!same(runner.slots[index]?.deps, deps)) runner.slots[index] = { fn, deps };
    return runner.slots[index].fn;
  },
  useEffect(fn, deps) {
    const index = runner.cursor++;
    const old = runner.slots[index];
    if (!same(old?.deps, deps)) {
      runner.queue.push(() => { old?.cleanup?.(); runner.slots[index] = { deps, cleanup: fn() }; });
    }
  },
};
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === 'react') return hooks;
  if (name === 'react-native') return { Platform:{OS:'test'}, View:'View' };
  if (name === 'expo-crypto') return { randomUUID:() => 'request-' + ++uuid };
  if (name === 'expo-router') return {
    router:{ replace:target => events.push(target), push:target => events.push(target) },
    useFocusEffect:fn => hooks.useEffect(fn, [fn]), usePreventRemove:() => () => {},
  };
  if (name.endsWith('/accessibility/Primitives')) return { Text:'Text' };
  if (name === './LessonUI') return { LessonButton:'Button', LessonFrame:'Frame', LessonHero:'Hero', LessonLoading:'Loading', LessonNote:'Note', l:{} };
  if (name === './LessonEditorParts') return { LessonDetailsFields:'Details', LessonQuizFields:'Quiz', LessonReview:'Review', LessonSharePicker:'Share', LessonSteps:'Steps', lessonSteps:['Details','Content','Quiz','Review'] };
  if (name === './LessonContentEditor') return { LessonContentEditor:'Content', LessonReadingPreview:'ReadingPreview' };
  if (name === './LessonWritingEditor') return { LessonWritingEditor:'Content', partHeading:(heading,index)=>heading.trim() || `Part ${index+1}` };
  if (name === './SimpleQuestionAuthor') return { SimpleQuestionAuthor:'SimpleQuestion', simpleQuestionError:()=>null };
  if (name === './LessonQuestionList') return { LessonQuestionList:'QuestionList' };
  if (name === './WritingUI') return { w:{} };
  if (name === './QuestionAuthor') return { cloneQuestion:structuredClone, prepareQuestion:q=>q, questionError:()=>null, newQuestion:()=>({}), QuestionAuthor:'Question', TeacherQuestionPreview:'QuestionPreview' };
  return originalLoad.call(this, name, parent, isMain);
};
for (const ext of ['.ts','.tsx']) Module._extensions[ext] = (module, filename) => {
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc:false, configFile:false, plugins:[
      [local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext === '.tsx',allExtensions:true}],
      [local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],
      local.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  });
  module._compile(result.code, filename);
};

const { LessonEditor } = local(path.join(mobile, 'src/features/teacher-lessons/LessonEditor.tsx'));
const draft = { title:'Greetings', introduction:'Welcome', grade:null, proficiency_level:'beginner', language:'english', subject_id:'subject', sections:[{heading:'First',body:'Text'},{heading:'Second',body:'More text'}], questions:[] };
const saved = { ...draft, id:'lesson', version_id:'version', revision:'revision', status:'draft', versions:[], shares:[] };
function mount(api, props = {}) {
  events.length=0; runner={cursor:0,slots:[],queue:[]};
  const render=()=>{runner.cursor=0;const output=LessonEditor({initial:null,subjects:[],api,classId:'class',initialStep:'Content',...props});while(runner.queue.length)runner.queue.shift()();return output;};
  return {render};
}
function start(api) {
  const app=mount(api), {render}=app;
  find(render(), 'Content').props.onChange(structuredClone(draft.sections));
  // Enter valid details through the existing Details step.
  find(render(),'Steps').props.onSelect('Details');
  find(render(),'Details').props.change(structuredClone(draft));
  find(render(),'Steps').props.onSelect('Content');
  return app;
}
function find(node,type,label) {
  if(!node)return null;
  if(Array.isArray(node)){for(const n of node){const r=find(n,type,label);if(r)return r;}return null;}
  if(node.type===type&&(!label||node.props.label===label))return node;
  return find(node.props?.children,type,label);
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('first content save retains the selected section in the confirmed route',async()=>{
  const calls=[];const app=start({create:async(body,key)=>{calls.push({body,key});return saved;}});
  find(app.render(),'Content').props.onActive(1);
  find(app.render(),'Button','Save draft').props.onPress();await flush();
  assert.equal(calls.length,1);
  assert.equal(events[0].params.step,'Content');assert.equal(events[0].params.section,'1');
  assert.equal(find(app.render(),'Content').props.active,1);
});
test('reading preview preserves local text and selected section',()=>{
  const app=start({});find(app.render(),'Content').props.onActive(1);
  find(app.render(),'Button','Preview as a student').props.onPress();
  const preview=find(app.render(),'ReadingPreview');assert.equal(preview.props.draft.sections[1].body,'More text');
  preview.props.onClose();assert.equal(find(app.render(),'Content').props.active,1);
});
test('invalid section opens inline validation without saving',()=>{
  let calls=0;const app=start({create:async()=>{calls++;return saved;}});
  find(app.render(),'Content').props.onChange([{heading:'Introduction',body:''}]);
  find(app.render(),'Button','Save draft').props.onPress();
  const content=find(app.render(),'Content');assert.equal(content.props.active,0);assert.equal(content.props.showValidation,true);assert.equal(calls,0);
});
test('uncertain content save freezes edits and retries identical data and identity',async()=>{
  const calls=[];const app=start({create:async(body,key)=>{calls.push({body,key});if(calls.length===1)throw new Error('Interrupted');return saved;}});
  find(app.render(),'Content').props.onActive(1);
  find(app.render(),'Button','Save draft').props.onPress();await flush();
  assert.equal(find(app.render(),'Content').props.disabled,true);
  find(app.render(),'Button','Retry original request').props.onPress();await flush();
  assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);
  assert.equal(events[0].params.step,'Content');assert.equal(events[0].params.section,'1');
});
test('editing a published lesson creates its draft only after confirmation',async()=>{
  const published={...saved,status:'published',published_at:'published',version_id:'published-version'};
  const calls=[];
  const app=mount({change:async(base,body)=>{calls.push({base,body});return saved;}},{initial:published,initialEdit:true});
  assert.equal(calls.length,0);
  find(app.render(),'Button','Start editing').props.onPress();
  await flush();
  assert.equal(calls.length,1);
  assert.equal(calls[0].body.action,'new_version');
  assert.equal(calls[0].body.version_id,published.version_id);
  assert.deepEqual(events[0].params,{id:'lesson',versionId:'version',step:'Details',classId:'class'});
});
test('Edit lesson opens an existing draft without creating another',()=>{
  const published={...saved,status:'published',published_at:'published',version_id:'published-version',
    versions:[{version_id:'published-version',published_at:'published'},{version_id:'version',published_at:null}]};
  const app=mount({change:()=>assert.fail('Must open the existing draft')},{initial:published});
  find(app.render(),'Button','Edit lesson').props.onPress();
  assert.deepEqual(events[0].params,{id:'lesson',versionId:'version',classId:'class'});
});
