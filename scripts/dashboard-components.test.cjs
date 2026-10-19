// Synthetic server-render tests of actual screens. No runtime auth bypass or API calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mobile = path.resolve(__dirname, '../apps/mobile');
const local = Module.createRequire(path.join(mobile, 'package.json'));
const babel = local('@babel/core');
let currentSession;
let currentState;
const routerEvents = [];
let hasPreviousScreen = true;
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === 'react-native') return local('react-native-web');
  if (name === 'react-native-safe-area-context') return { SafeAreaView: local('react-native-web').View };
  if (name === 'expo-clipboard') return { setStringAsync: async () => false };
  if (name === 'expo-router') return { router: { push() {}, replace(path) { routerEvents.push(['replace', path]); }, canGoBack() { return hasPreviousScreen; }, back() { routerEvents.push(['back']); } }, useLocalSearchParams: () => ({ id: 'synthetic' }), useFocusEffect() {} };
  if (name.endsWith('/session/provider')) return { useSession: () => currentSession };
  if (name.endsWith('/dashboard/usePagedList')) return { usePagedList: () => ({ state: currentState, reload() {}, more() {} }) };
  return originalLoad.call(this, name, parent, isMain);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = function(module, filename) {
  const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    plugins: [[local.resolve('@babel/plugin-transform-typescript'), { isTSX: ext === '.tsx', allExtensions: true }],
      [local.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], local.resolve('@babel/plugin-transform-modules-commonjs')] });
  module._compile(result.code, filename);
};
const React = local('react');
const { renderToStaticMarkup } = local('react-dom/server');
const screens = {};
for (const name of ['student', 'instructor', 'account', 'preferences', 'class-details'])
  screens[name] = local(path.join(mobile, `src/app/${name}.tsx`)).default;
const membership = { id: 'synthetic-membership-a', class_id: 'synthetic-class-a', class_name: 'Synthetic A',
  grade_level: 5, language: 'tagalog', instructor_display_name: 'Synthetic Teacher', status: 'active', joined_at: '2026-10-17T00:00:00Z' };
const owned = { id: 'synthetic-owned', class_name: 'Synthetic owned class', grade_level: 6, language: 'english',
  join_code: '000042', status: 'active', created_at: '2026-10-17T00:00:00Z' };
function render(name, role, phase = 'ready', rows = []) {
  currentSession = { profile: { id: 'synthetic', username: 'SyntheticLearner', role, profile_status: 'active',
    grade: role === 'personal_student' ? 6 : null, language: role === 'personal_student' ? 'tagalog' : null },
    classes: {}, enrollment: {}, refreshProfile: async () => currentSession.profile, logout() {}, save: async () => {} };
  currentState = { phase, rows, error: phase === 'error' ? 'Backend unavailable' : null, hasMore: false };
  return renderToStaticMarkup(React.createElement(screens[name]));
}

test('personal dashboard shows saved profile/preferences, account action and explicitly future modules', () => {
  const html = render('student', 'personal_student');
  for (const text of ['SyntheticLearner', 'Your learning focus', 'Topics:', 'Lessons:', 'Tagalog', 'Edit learning preferences', 'My account', 'not yet available']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Grade 6'));
  assert.ok(!html.includes('Create a class'));
  assert.ok(!html.includes('Join another class'));
});
test('school dashboard renders authorized multi-class choices and selected enrollment context', () => {
  const html = render('student', 'school_student', 'ready', [membership, { ...membership, id: 'synthetic-membership-b', class_name: 'Synthetic B' }]);
  for (const text of ['Synthetic A', 'Synthetic B', 'Choose a class', 'Synthetic Teacher', 'Enrollment: active', 'Join another class']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Edit learning preferences'));
  assert.ok(!html.includes('000042'));
  assert.ok(!html.includes('Active Class'));
  assert.ok(!html.includes('Guro Santos'));
  assert.ok(!html.includes('DepEd-compliant'));
});
for (const phase of ['loading', 'error']) test(`school ${phase} hides old membership context`, () => {
  const html = render('student', 'school_student', phase, [membership]);
  assert.ok(!html.includes('Synthetic A')); assert.ok(!html.includes('Synthetic Teacher'));
  assert.ok(html.includes(phase === 'loading' ? 'Checking your latest account data' : 'Retry loading'));
});
for (const [label, rows] of [['zero', []], ['one', [owned]], ['multiple', [owned, { ...owned, id: 'other', class_name: 'Other owned class' }]]])
  test(`instructor ${label}-class dashboard uses returned class records and owner actions`, () => {
    const html = render('instructor', 'instructor', 'ready', rows);
    assert.ok(html.includes('Create a class')); assert.ok(html.includes('Refresh classes')); assert.ok(html.includes('My account'));
    assert.equal(html.includes('No classes are saved yet'), rows.length === 0);
    for (const row of rows) assert.ok(html.includes(row.class_name));
    assert.ok(!html.includes('student count')); assert.ok(!html.includes('Edit learning preferences'));
  });
for (const phase of ['loading', 'error']) test(`instructor ${phase} hides old owned classes`, () => {
  const html = render('instructor', 'instructor', phase, [owned]);
  assert.ok(!html.includes('Synthetic owned class')); assert.ok(!html.includes('000042'));
});
test('account offers existing personal editing and explains device-only access before sign-out', () => {
  const html = render('account', 'personal_student');
  for (const text of ['SyntheticLearner', 'Personal learner', 'Topics:', 'Lessons:', 'Edit learning preferences', 'Sign out of this device', 'no password login or username-based account recovery']) assert.ok(html.includes(text), text);
  const school = render('account', 'school_student'); assert.ok(!school.includes('Edit learning preferences'));
  assert.ok(school.includes('Grade and language come from each class'));
});
test('preference editor renders supported saved choices and no unsupported identity mutations', () => {
  const html = render('preferences', 'personal_student');
  assert.ok(html.includes('Save preferences')); assert.ok(!html.includes('Grade 6'));
  assert.ok(html.includes('Topics I need help with')); assert.ok(html.includes('Lessons I want to work on'));
  assert.ok(html.includes('Tagalog')); assert.ok(html.includes('aria-checked="true"'));
  assert.ok(!html.includes('Change username')); assert.ok(!html.includes('Change role'));
});
test('class details hide old class data when current read fails', () => {
  const html = render('class-details', 'instructor', 'error', [owned]);
  assert.ok(!html.includes('Synthetic owned class')); assert.ok(!html.includes('000042'));
  assert.ok(html.includes('Retry loading')); assert.ok(html.includes('Go back to the previous screen'));
});

test('shared back control uses real history, with a safe entry fallback for direct links', () => {
  const { BackButton } = local(path.join(mobile, 'src/components/BackButton.tsx'));
  routerEvents.length = 0; hasPreviousScreen = true;
  BackButton({}).props.onPress();
  assert.deepEqual(routerEvents, [['back']]);
  routerEvents.length = 0; hasPreviousScreen = false;
  BackButton({}).props.onPress();
  assert.deepEqual(routerEvents, [['replace', '/']]);
  hasPreviousScreen = true;
  for (const name of ['student', 'instructor', 'account', 'preferences', 'class-details'])
    assert.ok(render(name, name === 'instructor' || name === 'class-details' ? 'instructor' : 'personal_student').includes('Go back to the previous screen'), name);
});
