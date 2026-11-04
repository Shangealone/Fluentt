const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const local = Module.createRequire(path.resolve(__dirname, '../apps/mobile/package.json'));
const React = local('react');
const babel = local('@babel/core');
let slots, index, effects, prevent, tree, props;
function effect(fn, deps) {
  const i = index++, old = slots[i];
  if (!old || !deps || deps.some((value, n) => !Object.is(value, old.deps[n]))) {
    effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  }
}
const hooks = { ...React,
  useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
  useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
  useEffect: effect,
  useCallback(fn) { return fn; },
};
const original = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'react') return hooks;
  if (name === 'react-native') return { Image: 'Image', Modal: 'Modal', Pressable: 'Pressable', View: 'View', StyleSheet: { create: value => value } };
  if (name.endsWith('/accessibility/Primitives')) return { Text: 'Text', TextInput: 'Input', useWindowDimensions: () => ({ width: 390, fontScale: 1 }) };
  if (name === 'expo-router') return { router: {}, useFocusEffect: fn => effect(fn), usePreventRemove: (enabled, callback) => { prevent = { enabled, callback }; } };
  if (name === 'expo-crypto') return { randomUUID: () => 'original-key' };
  if (name.endsWith('/PersonalIcon')) return { PersonalIcon: 'Icon' };
  if (name === './CommunicationUI') return { m: {}, Action: 'Action' };
  return original.call(this, name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = function(module, filename) {
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    plugins: [[local.resolve('@babel/plugin-transform-typescript'), { isTSX: ext === '.tsx', allExtensions: true }],
      [local.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], local.resolve('@babel/plugin-transform-modules-commonjs')] });
  module._compile(result.code, filename);
};
const base = path.resolve(__dirname, '../apps/mobile/src/features/communications');
const { MessageComposer } = local(path.join(base, 'CommunicationBrowser.tsx'));
const { messageNavigation } = local(path.join(base, 'state.ts'));
function render() { index = 0; effects = []; tree = MessageComposer(props); effects.forEach(fn => fn()); }
function nodes(node) { return React.isValidElement(node) ? [node, ...React.Children.toArray(node.props.children).flatMap(nodes)] : []; }
function button(label) { return nodes(tree).find(node => node.props.label === label).props; }
function type(text) { nodes(tree).find(node => node.type === 'Input').props.onChangeText(text); render(); }
function reset(send = async () => ({})) { slots?.forEach(slot => slot?.cleanup?.()); slots = []; props = { api: { send }, classId: 'class', onSent() {} }; render(); }
test('dirty composer asks before navigation; Keep writing retains text; discard navigates after guard clears', () => {
  reset(); type('My draft'); let visits = 0;
  messageNavigation.request(() => visits++); render();
  assert.equal(visits, 0); assert(nodes(tree).some(node => node.type === 'Modal'));
  button('Keep writing').onPress(); render();
  assert.equal(nodes(tree).find(node => node.type === 'Input').props.value, 'My draft');
  messageNavigation.request(() => { assert.equal(prevent.enabled, false); visits++; }); render();
  button('Discard and leave').onPress(); render();
  assert.equal(visits, 1);
});
test('busy send blocks exit and interrupted retry retains original text and identity', async () => {
  let reject, calls = [];
  reset((...args) => { calls.push(args); return new Promise((_, fail) => { reject = fail; }); });
  type('Original message'); button('Post announcement').onPress(); render();
  let visits = 0; messageNavigation.request(() => visits++); render();
  assert.equal(visits, 0); assert(!nodes(tree).some(node => node.type === 'Modal'));
  reject(Error('Disconnected')); await new Promise(setImmediate); render();
  messageNavigation.request(() => visits++); render(); button('Keep writing').onPress(); render();
  button('Retry same message').onPress(); render();
  assert.deepEqual(calls[0], calls[1]); assert.equal(calls[1][3], 'original-key');
  reject(Error('Disconnected')); await new Promise(setImmediate); render();
});
