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
  if (name === './BuilderView') return { BuilderView:'Builder' };
  if (name.endsWith('/components/ui')) return {Button:'Button',EmptyState:'Empty',ErrorMessage:'Error',Loading:'Loading',s:{}};
  if (name === '../teacher-lessons/LessonUI') return {LessonButton:'Button',LessonNote:'Note',l:{}};
  if (name === '../teacher-lessons/QuestionAuthor') return {newQuestion:()=>({method:'true_false',prompt:'Synthetic',content:{},answer_key:{value:true}}),prepareQuestion:q=>q,questionError:()=>null,QuestionAuthor:'Author',TeacherQuestionPreview:'Preview'};
  if (name === '../teacher-lessons/SimpleQuestionAuthor') return {SimpleQuestionAuthor:'LessonQuestionForm',simpleQuestionError:()=>null};
  if (name === '../teacher-lessons/WritingUI') return {w:{}};
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


const { AssignmentEditor }=local(path.join(mobile,'src/features/assignments/AssignmentEditor.tsx'));
const lesson={lesson_id:'lesson',lesson_name:'Shared lesson',source:'curriculum'};
const item={id:'revision',question_id:'question',eligible:true,version:1,definition:{method:'true_false',prompt:'Synthetic',content:{},lesson_id:'lesson'}};
function start(createQuestion, initialLesson = lesson, create) {
 runner = {cursor: 0, slots: [], queue: []};
 const api = {createQuestion, create};
 function render() {
  runner.cursor = 0;
  const output = AssignmentEditor({initial: null, initialLesson, classId: 'class', classroom: {id: 'class'}, api, active: true});
  while (runner.queue.length) runner.queue.shift()();
  return output.props;
 }
 return {render};
}
const flush=()=>new Promise(r=>setImmediate(r));
function find(node,type,label){if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=find(child,type,label);if(found)return found;}return null;}if(node.type===type&&(!label||node.props.label===label))return node;return find(node.props?.children,type,label);}
for (const source of ['curriculum', 'teacher']) {
 test(`creating a ${source} question preserves assignment details and appends the revision`, async () => {
  const app = start(async (_class, lessonId) => { assert.equal(lessonId, 'lesson'); return item; }, {...lesson, source});
  const existing = {...item, id: 'existing-revision', question_id: 'existing-question'};
  app.render().onTitle('My draft'); app.render().onInstructions('Keep these instructions');
  app.render().onAdd(existing); app.render().onCreateQuestion();
  const form = find(app.render().authorContent, 'LessonQuestionForm');
  assert.ok(form, 'The builder uses the lesson question form');
  form.props.onChoosingChange(false);
  find(app.render().authorContent, 'Button', 'Create and add').props.onPress();
  app.render().onAcceptConfirm(); await flush();
  const result = app.render();
  assert.equal(result.title, 'My draft'); assert.equal(result.instructions, 'Keep these instructions');
  assert.equal(result.lesson.source, source); assert.equal(result.lesson.lesson_id, 'lesson');
  assert.deepEqual(result.items, [existing, item]); assert.equal(result.authorContent, undefined); assert.equal(result.dirty, true);
 });
}
test('uncertain publication retries its original question and identity',async()=>{
 const calls=[];const app=start(async(...args)=>{calls.push(structuredClone(args));if(calls.length===1)throw new Error('Interrupted');return item;});
 app.render().onTitle('Keep draft');app.render().onCreateQuestion();find(app.render().authorContent,'LessonQuestionForm').props.onChoosingChange(false);find(app.render().authorContent,'Button','Create and add').props.onPress();app.render().onAcceptConfirm();await flush();
 find(app.render().authorContent,'Button','Retry creating question').props.onPress();app.render().onAcceptConfirm();await flush();assert.deepEqual(calls[0],calls[1]);assert.equal(app.render().title,'Keep draft');
});

test('discarding question edits keeps the selected questions without creating anything', () => {
 const app = start(() => assert.fail('Question creation should require confirmation'));
 app.render().onAdd(item); app.render().onCreateQuestion();
 find(app.render().authorContent, 'Button', 'Back to assignment').props.onPress();
 app.render().onAcceptConfirm();
 assert.equal(app.render().authorContent, undefined);
 assert.deepEqual(app.render().items, [item]);
});

test('the editor cannot open question creation once 200 questions are selected', () => {
 const app = start(() => assert.fail('Question creation should be blocked at the limit'));
 for (let index = 0; index < 200; index++) app.render().onAdd({...item, id: `revision-${index}`, question_id: `question-${index}`});
 app.render().onCreateQuestion();
 assert.equal(app.render().items.length, 200);
 assert.equal(app.render().authorContent, undefined);
});

test('saving an assignment draft uses the order from the shared question list', async () => {
 const earlier = {...item, id: 'earlier-revision', question_id: 'earlier-question'};
 const app = start(undefined, lesson, async (_classId, body) => {
  assert.deepEqual(body.question_revision_ids, [item.id, earlier.id]);
  return {title: body.title, instructions: body.instructions, context: lesson, questions: [item, earlier], editable: true};
 });
 app.render().onTitle('Ordered assignment');
 app.render().onAdd(earlier);
 app.render().onAdd(item);
 app.render().onQuestionsChange([item, earlier]);
 app.render().onSave();
 await flush();
 assert.deepEqual(app.render().items, [item, earlier]);
 assert.equal(app.render().dirty, false);
});
