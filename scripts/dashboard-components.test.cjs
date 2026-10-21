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
let currentPath = '/student';
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === 'react-native') return local('react-native-web');
  if (name === 'react-native-safe-area-context') return { SafeAreaView: local('react-native-web').View };
  if (name === 'expo-clipboard') return { setStringAsync: async () => false };
  if (name === 'expo-router') return { router: { push() {}, navigate(path) { routerEvents.push(['navigate', path]); }, replace(path) { routerEvents.push(['replace', path]); }, canGoBack() { return hasPreviousScreen; }, back() { routerEvents.push(['back']); } }, usePathname: () => currentPath, useLocalSearchParams: () => ({ id: 'synthetic' }), useFocusEffect() {} };
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
    grade: role === 'personal_student' ? 6 : null, language: role === 'personal_student' ? 'tagalog' : null, experience: role === 'personal_student' ? 'some_words' : null },
    classes: {}, enrollment: {}, refreshProfile: async () => currentSession.profile, logout() {}, save: async () => {} };
  currentState = { phase, rows, error: phase === 'error' ? 'Backend unavailable' : null, hasMore: false };
  return renderToStaticMarkup(React.createElement(screens[name]));
}

test('personal dashboard has exactly the three learning activities and essential account access', () => {
  const html = render('student', 'personal_student');
  for (const text of ['SyntheticLearner', 'Conversation simulator', 'Learn pronunciation', 'Questions &amp; activities', 'My account', 'difficulty']) assert.ok(html.includes(text), text);
  for (const text of ['Research', 'Learning history', 'Your learning focus', 'not yet available']) assert.ok(!html.includes(text), text);
  assert.equal((html.match(/aria-label="Notifications"/g) ?? []).length, 1);
  assert.ok(html.indexOf('aria-label="Notifications"') < html.indexOf('aria-label="My account · Personal learner"'));
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

test('classroom dashboard uses the learning studio design and retains classroom destinations', () => {
  const html = render('student', 'school_student', 'ready', [membership]);
  for (const label of ['Class learning', 'Ready for your next chapter?', 'View assignments', 'Class messages', 'View Research Studies']) assert.ok(html.includes(label), label);
  for (const label of ['Open my classes', 'Practise pronunciation', 'Start a conversation', 'Progress and learning history', 'Learning history']) assert.ok(!html.includes(`aria-label="${label}"`), label);
  assert.equal((html.match(/aria-label="Class messages"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-label="Notifications"/g) ?? []).length, 1);
  assert.ok(html.indexOf('aria-label="Notifications"') < html.indexOf('aria-label="My account · Student"'));
  assert.ok(!html.includes('Edit learning preferences'));
  assert.ok(!html.includes('Verified School Member'));
});

test('classroom tabs select only the current destination and stay out of forms and other roles', () => {
  const { ClassroomBottomNavigation } = local(path.join(mobile, 'src/components/ClassroomBottomNavigation.tsx'));
  render('student', 'school_student', 'ready', [membership]);
  currentPath = '/my-classes';
  const html = renderToStaticMarkup(React.createElement(ClassroomBottomNavigation));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 5);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  const tabs = ClassroomBottomNavigation().props.children.props.children;
  routerEvents.length = 0;
  tabs[1].props.onPress(); assert.deepEqual(routerEvents, []);
  tabs[0].props.onPress(); assert.deepEqual(routerEvents, [['navigate', '/student']]);
  for (const route of ['/assignment-attempt', '/class-code', '/preferences']) {
    currentPath = route; assert.equal(ClassroomBottomNavigation(), null);
  }
  currentPath = '/student';
  const previous = currentSession;
  for (const patch of [{loading:true}, {error:'Session lost'}, {profile:null}, {profile:{...previous.profile,role:'personal_student'}}, {profile:{...previous.profile,role:'instructor'}}, {profile:{...previous.profile,profile_status:'incomplete'}}]) {
    currentSession = {...previous,...patch}; assert.equal(ClassroomBottomNavigation(), null);
  }
  currentSession = previous;
});

test('my-classes is restricted to an onboarded school student by the shared route policy', () => {
  const { routeAllowed } = local(path.join(mobile, 'src/session/routing.ts'));
  for (const role of ['school_student','personal_student','instructor'])
    assert.equal(routeAllowed({role,profile_status:'active',language:'tagalog',experience:'some_words'},'my-classes'), role === 'school_student');
  assert.equal(routeAllowed({role:'school_student',profile_status:'incomplete'},'my-classes'),false);
  assert.equal(routeAllowed(null,'my-classes'),false);
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
  assert.ok(html.includes('Tagalog')); assert.ok(html.includes('Change language or starting level'));
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

test('personal bottom tabs expose every activity, select the current page, and avoid duplicate navigation', () => {
  const { PersonalBottomNavigation } = local(path.join(mobile, 'src/components/PersonalBottomNavigation.tsx'));
  render('student', 'personal_student');
  currentPath = '/question-practice';
  const html = renderToStaticMarkup(React.createElement(PersonalBottomNavigation));
  for (const name of ['Home', 'Conversation simulator', 'Pronunciation practice', 'Questions and activities', 'Personal learning statistics']) assert.ok(html.includes(`aria-label="${name}"`), name);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 5);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  const tabElements = PersonalBottomNavigation().props.children.props.children;
  routerEvents.length = 0;
  tabElements[1].props.onPress(); assert.deepEqual(routerEvents, []);
  tabElements[3].props.onPress(); assert.deepEqual(routerEvents, [['navigate', '/conversation']]);
  tabElements[4].props.onPress(); assert.deepEqual(routerEvents.at(-1), ['navigate', '/personal-stats']);
  for (const state of [{loading:true},{error:'Session unavailable'},{profile:null}]) {
    const previous = currentSession; currentSession = {...previous,...state};
    assert.equal(PersonalBottomNavigation(), null); currentSession = previous;
  }
  for (const route of ['/username','/learning-focus','/preferences']) {
    currentPath = route; assert.equal(PersonalBottomNavigation(), null);
  }
  currentPath = '/student'; render('student', 'school_student'); assert.equal(PersonalBottomNavigation(), null);
});

test('reference-style Stats honestly withholds unsupported personal measurements', () => {
  render('student', 'personal_student');
  const Stats = local(path.join(mobile, 'src/app/personal-stats.tsx')).default;
  const html = renderToStaticMarkup(React.createElement(Stats));
    assert.ok(html.includes('Ability metrics unavailable'));
  assert.equal((html.match(/Not measured/g) ?? []).length, 4);
  for (const claim of ['84%', '88%', '14 days', 'ESR v4.2', 'Native 94%', 'Mastered']) assert.ok(!html.includes(claim), claim);
  const {routeAllowed} = local(path.join(mobile,'src/session/routing.ts'));
  assert.equal(routeAllowed(currentSession.profile, 'personal-stats'), true);
  assert.equal(routeAllowed({...currentSession.profile,role:'school_student'}, 'personal-stats'), false);
});
