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
  if (name === 'react-native') return { Text:'Text', BackHandler:{ addEventListener(){ return { remove(){} }; } } };
  if (name === 'expo-crypto') return { randomUUID:() => 'request-' + ++uuid };
  if (name === 'expo-router') return {
    router:{ replace:target => events.push(target), push:target => events.push(target) },
    useFocusEffect:fn => hooks.useEffect(fn, [fn]),
  };
  if (name.endsWith('/session/provider')) return { useSession:() => session };
  if (name.endsWith('/classes/CreateClassView')) return { CreateClassView:'CreateClassView' };
  if (name.endsWith('/classes/ClassForm')) return { ClassForm:'ClassForm' };
  if (name.endsWith('/components/ui')) return { Screen:'Screen', Button:'Button', ErrorMessage:'Error', s:{} };
  if (name.endsWith('/components/navigation')) return { AppHeader:'AppHeader' };
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
const FirstClass = local(path.join(mobile, 'src/app/first-class.tsx')).default;
const fields = { class_name:'  Science 7  ', grade_level:7, language:'english', description:'  Morning class  ' };
const row = { id:'confirmed-class' };
function start(create = async () => row) {
  events.length = 0;
  runner = { cursor:0, slots:[], queue:[] };
  session = { profile:{id:'teacher-a',role:'instructor'}, classes:{create}, refreshProfile:async () => ({profile_status:'active'}) };
  const render = () => {
    runner.cursor = 0;
    const output = FirstClass();
    while (runner.queue.length) runner.queue.shift()();
    return output?.props;
  };
  render().onChange(fields);
  return { render, leave:() => runner.slots.forEach(slot => slot?.cleanup?.()) };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('create class validates and uses only the confirmed server id after one request', async () => {
  const request = deferred();
  const calls = [];
  const app = start((draft,key) => { calls.push({draft,key}); return request.promise; });
  const submit = app.render().onSubmit();
  await app.render().onSubmit();
  await app.render().onCheckClasses();
  app.render().onBack();
  app.render().onAccount();
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].draft,{class_name:'Science 7',grade_level:7,language:'english',description:'Morning class'});
  assert.deepEqual(events,[]);
  request.resolve(row); await submit;
  assert.deepEqual(events,[{pathname:'/class-details',params:{id:'confirmed-class',created:'1'}}]);
});
test('uncertain save retains locked values and reuses its request identity', async () => {
  const calls = [];
  const app = start(async (draft,key) => { calls.push({draft,key}); if(calls.length === 1) throw new Error('Connection interrupted'); return row; });
  await app.render().onSubmit();
  assert.equal(app.render().locked,true);
  app.render().onChange({...fields,class_name:'Changed'});
  assert.equal(app.render().fields.class_name,fields.class_name);
  await app.render().onSubmit();
  assert.equal(calls[0].key,calls[1].key);
  assert.deepEqual(calls[0].draft,calls[1].draft);
});
test('leaving while a create request is pending suppresses its redirect', async () => {
  const request = deferred();
  const app = start(() => request.promise);
  const submit = app.render().onSubmit();
  app.leave();
  request.resolve(row); await submit;
  assert.deepEqual(events,[]);
});
test('checking classes blocks creation and ignores a response after session loss', async () => {
  let created = 0;
  const app = start(async () => { created++; return row; });
  const request = deferred();
  session.refreshProfile = () => request.promise;
  const checking = app.render().onCheckClasses();
  await app.render().onSubmit();
  assert.equal(created,0);
  session.profile = null;
  assert.equal(app.render(),undefined);
  request.resolve({profile_status:'active'}); await checking;
  assert.deepEqual(events,[]);
});
test('invalid fields never issue a request and normal navigation retains its routes', async () => {
  let created = 0;
  const app = start(async () => { created++; return row; });
  app.render().onChange({...fields,grade_level:null});
  await app.render().onSubmit();
  assert.equal(created,0);
  assert.match(app.render().error,/Grade/);
  app.render().onBack(); app.render().onAccount();
  assert.deepEqual(events,['/instructor','/account']);
});
test('definitive validation failure allows correction and clears stale guidance', async () => {
  const app = start(async () => { const error = new Error('Please correct the class details'); error.status = 422; throw error; });
  await app.render().onSubmit();
  assert.equal(app.render().locked,false);
  assert.match(app.render().error,/correct/);
  app.render().onChange({...fields,class_name:'Corrected class'});
  assert.equal(app.render().fields.class_name,'Corrected class');
  assert.equal(app.render().error,'');
});
test('failed class check retains entered details and permits retry', async () => {
  const app = start();
  session.refreshProfile = async () => { throw new Error('Service unavailable'); };
  await app.render().onCheckClasses();
  assert.match(app.render().error,/unavailable/);
  assert.deepEqual(app.render().fields,fields);
  assert.equal(app.render().operation,null);
  session.refreshProfile = async () => ({role:'instructor',profile_status:'active'});
  await app.render().onCheckClasses();
  assert.deepEqual(events,['/instructor']);
});
