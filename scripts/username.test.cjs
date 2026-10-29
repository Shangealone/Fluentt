// Actual username handlers and dependency-aware effects with synthetic session state.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const React = local('react');
const babel = local('@babel/core');
const original = Module._load;
let role, session;
const routes = [];
Module._load = function(name, parent, isMain) {
  if (name === 'expo-router') return { router: { replace: route => routes.push(route) }, useLocalSearchParams: () => ({role}), Redirect: () => null };
  if (name.endsWith('/session/provider')) return { useSession: () => session };
  if (name === 'react-native') return local('react-native-web');
  if (name === 'react-native-safe-area-context') return { SafeAreaView: local('react-native-web').View };
  return original.call(this, name, parent, isMain);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = function(module, filename) {
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc:false, configFile:false,
    plugins:[[local.resolve('@babel/plugin-transform-typescript'),{isTSX:ext === '.tsx',allExtensions:true}],
      [local.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],local.resolve('@babel/plugin-transform-modules-commonjs')] });
  module._compile(result.code, filename);
};
const Username = local(path.join(mobile, 'src/app/username.tsx')).default;
const { identity } = local(path.join(mobile, 'src/services/api/identity.ts'));
let availabilityCalls = 0;
identity.check = async () => { availabilityCalls++; return {available:false,message:'Already taken in the real system'}; };
function nodes(element, predicate) {
  if (!element || typeof element !== 'object') return [];
  const children = React.Children.toArray(element.props?.children);
  return [...(predicate(element) ? [element] : []), ...children.flatMap(child => nodes(child, predicate))];
}
function harness() {
  const slots=[], effects=[]; let cursor;
  return { render() {
    cursor=0; const queue=[];
    const saved={useState:React.useState,useRef:React.useRef,useEffect:React.useEffect};
    React.useState = init => { const index=cursor++; if (!(index in slots)) slots[index]=typeof init === 'function' ? init() : init;
      return [slots[index], value => {slots[index]=typeof value === 'function' ? value(slots[index]) : value;}]; };
    React.useRef = init => { const index=cursor++; return slots[index] ?? (slots[index]={current:init}); };
    React.useEffect = (callback,deps) => { const index=cursor++, prior=effects[index];
      if (!prior || deps.some((value,i) => !Object.is(value,prior.deps[i]))) queue.push(() => {prior?.cleanup?.();effects[index]={deps,cleanup:callback()};}); };
    try { const tree=Username(); queue.forEach(effect => effect()); return tree; } finally {Object.assign(React,saved);}
  }, cleanup() {effects.forEach(effect => effect?.cleanup?.());} };
}
function profile(username) { return {id:'synthetic',username,canonical_username:username.toLowerCase(),role,profile_status:'active',grade:null,language:'english',experience:'some_words',learning_focus:{topics:['Vocabulary'],lessons:[]}}; }
const nextTurn = () => new Promise(resolve => setImmediate(resolve));
test('editing a demo username clears the public sample password from real-account fields',()=>{
  role='personal_student';session={profile:null,isDemo:false,pending:false};
  const h=harness();
  nodes(h.render(),node=>node.props?.accessibilityLabel==='Use demo username @learner_kat')[0].props.onPress();
  nodes(h.render(),node=>node.props?.accessibilityLabel==='Username')[0].props.onChangeText('Shan Gealone');
  for(const label of ['Password','Confirm Password'])assert.equal(nodes(h.render(),node=>node.props?.accessibilityLabel===label)[0].props.value,'');
  h.cleanup();
});
for (const [selectedRole, handle, target] of [['school_student','clara_reyes','/student'],['instructor','teacher_elena','/instructor'],['personal_student','learner_kat','/student']]) {
  test(`autofill + Continue enters the ${selectedRole} dashboard and skips real availability`, async () => {
    role=selectedRole; routes.length=0; availabilityCalls=0; const calls=[];
    session={profile:null,isDemo:false,pending:false,async create(...args) {calls.push(args);session.profile=profile(args[0]);session.isDemo=true;}};
    const h=harness();
    nodes(h.render(),node => node.props?.accessibilityLabel === `Use demo username @${handle}`)[0].props.onPress();
    h.render();
    assert.equal(nodes(h.render(),node => node.props?.accessibilityLabel === 'Username')[0].props.value,handle);
    assert.equal(nodes(h.render(),node => node.props?.accessibilityLabel === 'Password')[0].props.value,'FluenttDemo123!');
    assert.equal(nodes(h.render(),node => node.props?.accessibilityLabel === 'Confirm Password')[0].props.value,'FluenttDemo123!');
    nodes(h.render(),node => node.props?.label === `Continue as @${handle} →`)[0].props.onPress();
    await nextTurn(); h.render();
    assert.deepEqual(calls,[[handle,role,true]]); assert.deepEqual(routes,[target]);
    await new Promise(resolve => setTimeout(resolve,450)); assert.equal(availabilityCalls,0);
    h.cleanup();
  });
}
for (const [selectedRole, handle, target] of [['school_student','juan_delacruz','/student'],['instructor','guro_santos','/instructor'],['personal_student','maria_clara','/student']]) {
  test(`Fast-Enter uses the selected ${selectedRole} name even before state updates`, async () => {
    role=selectedRole; routes.length=0; const calls=[];
    session={profile:null,isDemo:false,pending:false,async create(...args) {calls.push(args);session.profile=profile(args[0]);session.isDemo=true;}};
    const h=harness();
    nodes(h.render(),node => node.props?.label === `⚡ Fast-Enter as @${handle}`)[0].props.onPress();
    await nextTurn(); h.render();
    assert.deepEqual(calls,[[handle,role,true]]); assert.deepEqual(routes,[target]); h.cleanup();
  });
}
test('creation waits for the matching profile and blocks duplicate taps',async()=>{
  role='school_student';routes.length=0;let calls=0,resolve;
  session={profile:null,isDemo:false,pending:false,create(){calls++;return new Promise(done => {resolve=done;});}};
  const h=harness();nodes(h.render(),node=>node.props?.accessibilityLabel === 'Use demo username @clara_reyes')[0].props.onPress();
  const press=nodes(h.render(),node=>node.props?.label === 'Continue as @clara_reyes →')[0].props.onPress;
  press();press();assert.equal(calls,1);assert.deepEqual(routes,[]);
  resolve();await nextTurn();h.render();assert.deepEqual(routes,[]);
  session.profile=profile('another_learner');h.render();assert.deepEqual(routes,[]);
  session.profile=profile('clara_reyes');h.render();assert.deepEqual(routes,['/student']);h.cleanup();
});
test('failed creation stays on username and shows the error',async()=>{
  role='school_student';routes.length=0;
  session={profile:null,isDemo:false,pending:false,async create(){throw new Error('Secure save failed');}};
  const h=harness();nodes(h.render(),node=>node.props?.accessibilityLabel === 'Use demo username @clara_reyes')[0].props.onPress();
  nodes(h.render(),node=>node.props?.label === 'Continue as @clara_reyes →')[0].props.onPress();
  await nextTurn();const tree=h.render();assert.deepEqual(routes,[]);
  assert(nodes(tree,node=>node.props?.message === 'Secure save failed').length);h.cleanup();
});
