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
  if (name.endsWith('/session/provider')) return { useSession:()=>({teacherLessons:teacherApi}) };
  if (name === './BuilderView') return { BuilderView:'Builder' };
  if (name.endsWith('/components/ui')) return {Button:'Button',EmptyState:'Empty',ErrorMessage:'Error',Loading:'Loading',s:{}};
  if (name === '../teacher-lessons/LessonEditor') return {LessonEditor:'OwnLesson'};
  if (name === '../teacher-lessons/LessonUI') return {LessonButton:'Button',LessonNote:'Note',l:{}};
  if (name === '../teacher-lessons/QuestionAuthor') return {newQuestion:()=>({method:'true_false',prompt:'Synthetic',content:{},answer_key:{value:true}}),prepareQuestion:q=>q,questionError:()=>null,QuestionAuthor:'Author',TeacherQuestionPreview:'Preview'};
  if (name === './LessonContentEditor') return { LessonContentEditor:'Content', LessonReadingPreview:'ReadingPreview' };
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


let teacherApi={};
const { AssignmentEditor }=local(path.join(mobile,'src/features/assignments/AssignmentEditor.tsx'));
const lesson={lesson_id:'lesson',lesson_name:'Shared lesson',source:'curriculum'};
const item={id:'revision',question_id:'question',eligible:true,version:1,definition:{method:'true_false',prompt:'Synthetic',content:{},lesson_id:'lesson'}};
function start(createQuestion,extra={}){teacherApi=extra.teacherApi??{};runner={cursor:0,slots:[],queue:[]};const render=()=>{runner.cursor=0;const output=AssignmentEditor({initial:null,initialLesson:extra.lesson??lesson,classId:'class',classroom:{id:'class'},api:{createQuestion,...extra.api},active:true});while(runner.queue.length)runner.queue.shift()();return output.props;};return {render};}
const flush=()=>new Promise(r=>setImmediate(r));
function find(node,type,label){if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=find(child,type,label);if(found)return found;}return null;}if(node.type===type&&(!label||node.props.label===label))return node;return find(node.props?.children,type,label);}
test('publishing a new question retains assignment details and selects the returned revision',async()=>{
 const app=start(async()=>item);app.render().onTitle('My draft');app.render().onInstructions('Keep these instructions');app.render().onCreateQuestions();await flush();
 const props=app.render();assert.ok(props.authorContent);find(props.authorContent,'Button','Publish question').props.onPress();app.render().onAcceptConfirm();await flush();
 const result=app.render();assert.equal(result.title,'My draft');assert.equal(result.instructions,'Keep these instructions');assert.equal(result.lesson.lesson_id,'lesson');assert.equal(result.items[0].id,'revision');assert.equal(result.authorContent,undefined);assert.equal(result.dirty,true);
});
test('uncertain publication retries its original question and identity',async()=>{
 const calls=[];const app=start(async(...args)=>{calls.push(structuredClone(args));if(calls.length===1)throw new Error('Interrupted');return item;});
 app.render().onTitle('Keep draft');app.render().onCreateQuestions();await flush();find(app.render().authorContent,'Button','Publish question').props.onPress();app.render().onAcceptConfirm();await flush();
 find(app.render().authorContent,'Button','Retry original publication').props.onPress();app.render().onAcceptConfirm();await flush();assert.deepEqual(calls[0],calls[1]);assert.equal(app.render().title,'Keep draft');
});

test('own-lesson authoring returns with assignment details and asks before switching versions',async()=>{
 const own={lesson_id:'old',source:'teacher',teacher_lesson_id:'root'};
 const app=start(async()=>item,{lesson:own,teacherApi:{get:async()=>({id:'root',status:'published'})},api:{lesson:async(_class,id)=>({lesson_id:id,source:'teacher',teacher_lesson_id:'root'})}});
 app.render().onTitle('Retained title');app.render().onInstructions('Retained instructions');app.render().onCreateQuestions();await flush();
 const editor=app.render();assert.equal(editor.initial.id,'root');assert.equal(editor.initialStep,'Quiz');
 editor.onReturnToAssignment({status:'published',lesson_id:'new',version_id:'v2',shares:[{class_id:'class',version_id:'v2'}]});await flush();
 assert.equal(app.render().title,'Retained title');assert.equal(app.render().lesson.lesson_id,'old');app.render().onAcceptConfirm();
 assert.equal(app.render().lesson.lesson_id,'new');assert.equal(app.render().instructions,'Retained instructions');
});
