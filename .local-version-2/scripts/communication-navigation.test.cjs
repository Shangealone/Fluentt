const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const React = local('react');
const babel = local('@babel/core');
const events = [];
const original = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'react-native') return local('react-native-web');
  if (name.endsWith('/accessibility/Primitives')) return { Text: local('react-native-web').Text, useWindowDimensions: () => ({ width: 390, fontScale: 1 }) };
  if (name === 'react-native-safe-area-context') return { SafeAreaView: local('react-native-web').View };
  if (name === 'expo-router') return { router: { navigate: route => events.push(route) } };
  if (name.endsWith('/PersonalIcon')) return { PersonalIcon: () => null };
  if (name === './InstructorClassCard') return { classroomIllustration: {}, InstructorClassCard: () => null };
  return original.call(this, name, parent, main);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = function(module, filename) {
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    plugins: [[local.resolve('@babel/plugin-transform-typescript'), { isTSX: ext === '.tsx', allExtensions: true }],
      [local.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], local.resolve('@babel/plugin-transform-modules-commonjs')] });
  module._compile(result.code, filename);
};
function walk(element) {
  return React.isValidElement(element) ? [element, ...React.Children.toArray(element.props.children).flatMap(walk)] : [];
}
const { InstructorHomeNavigation } = local(path.join(mobile, 'src/features/dashboard/InstructorHome.tsx'));
for (const activeRoute of ['/instructor', '/communication']) test(`teaching navigation selects ${activeRoute} and preserves destinations`, () => {
  const tabs = walk(InstructorHomeNavigation({ activeRoute })).filter(item => item.props.accessibilityRole === 'tab');
  assert.equal(tabs.length, 4);
  assert.deepEqual(tabs.filter(item => item.props.accessibilityState.selected).map(item => item.props.accessibilityLabel), [activeRoute === '/communication' ? 'Messages' : 'Home']);
  events.length = 0;
  tabs.find(item => item.props.accessibilityState.selected).props.onPress();
  assert.deepEqual(events, []);
  tabs.forEach(item => item.props.onPress());
  assert.deepEqual(events, ['/instructor', '/communication', '/notifications', '/instructor-monitoring'].filter(route => route !== activeRoute));
});
