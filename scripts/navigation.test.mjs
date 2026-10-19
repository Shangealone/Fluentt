import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionController, SessionChangedError } from '../apps/mobile/src/session/controller.ts';
import { destination, routeAllowed } from '../apps/mobile/src/session/routing.ts';
import { PagedList, selectedClass } from '../apps/mobile/src/features/dashboard/paging.ts';
import { identity, ApiError, validLearningFocus } from '../apps/mobile/src/services/api/identity.ts';

const profile = { id: 'synthetic', username: 'Learner', role: 'personal_student', profile_status: 'active', grade: 5, language: 'tagalog' };
function vault(value = 'test-only') { return { value, clears: 0, async read() { return this.value; }, async save(value) { this.value = value; }, async clear() { this.clears++; this.value = null; } }; }
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }

test('route policy permits only authenticated role/completion pathways', () => {
  for (const route of ['account','preferences','student','instructor','class-details','class-edit','first-class','class-code','grade','language'])
    assert.equal(routeAllowed(null, route), false, route);
  assert.equal(routeAllowed(null,'index'), true);
  assert.equal(routeAllowed(null,'index',true), false);
  assert.equal(routeAllowed(null,'username',true), true);
  const roles = ['personal_student','school_student','instructor'];
  for (const role of roles) {
    const current = { ...profile, role };
    assert.equal(routeAllowed(current,'account'), true);
    assert.equal(routeAllowed(current,'index'), false);
    assert.equal(routeAllowed(current,'username'), false);
    assert.equal(routeAllowed(current,'preferences'), role === 'personal_student');
    for (const route of ['instructor','class-details','class-edit','first-class'])
      assert.equal(routeAllowed(current,route), role === 'instructor');
    assert.equal(routeAllowed(current,'class-code'), role === 'school_student');
    assert.equal(routeAllowed(current,'student'), role !== 'instructor');
  }
  const incomplete = { ...profile, grade:null, language:null, profile_status:'onboarding' };
  assert.equal(destination(incomplete), '/learning-focus');
  assert.equal(routeAllowed(incomplete,'preferences'), false);
  assert.equal(routeAllowed(incomplete,'student'), false);
  assert.equal(routeAllowed(incomplete,'grade'), true);
  assert.equal(destination({ ...incomplete, grade:5 }), '/language');
  const focused = { ...incomplete, learning_focus: { topics: ['Vocabulary'], lessons: [] }, language: 'english' };
  assert.equal(destination(focused), '/student');
  assert.equal(routeAllowed(focused, 'learning-focus'), true);
  assert.equal(routeAllowed({ ...focused, role: 'school_student' }, 'learning-focus'), false);
  const school = { ...profile, role:'school_student', profile_status:'onboarding' };
  assert.equal(destination(school), '/class-code');
  assert.equal(routeAllowed(school,'student'), false);
  assert.equal(destination({ ...school, profile_status:'active' }), '/student');
  assert.equal(destination({ ...school, role:'instructor' }), '/first-class');
  assert.equal(routeAllowed({ ...school, role:'instructor' },'instructor'), true); // zero-class empty view
});

test('learning focus validates explicit bounded requests without assigning a grade', () => {
  assert(validLearningFocus({ topics: ['Vocabulary'], lessons: [] }));
  assert(validLearningFocus({ topics: [], lessons: ['Writing a paragraph'] }));
  for (const value of [null, {}, {topics:[],lessons:[]}, {topics:[' '],lessons:[]}, {topics:['same','same'],lessons:[]}, {topics:['x'.repeat(121)],lessons:[]}]) assert(!validLearningFocus(value));
});

test('paged reads publish loading/empty/data/error and clear stale protected rows', async () => {
  const list = new PagedList(); let publications = 0;
  const unsubscribe = list.subscribe(() => publications++);
  assert.equal(list.getSnapshot().phase, 'loading');
  await list.load(async () => []);
  assert.deepEqual(list.getSnapshot().rows, []); assert.equal(list.getSnapshot().phase, 'ready');
  await list.load(async () => [{ id:'class-a' }]);
  assert.equal(list.getSnapshot().rows.length, 1);
  const pending = deferred(); const loading = list.load(() => pending.promise);
  assert.equal(list.getSnapshot().phase, 'loading'); assert.equal(list.getSnapshot().rows.length, 0);
  pending.reject(new ApiError(503,'Backend unavailable')); await loading;
  assert.equal(list.getSnapshot().phase, 'error'); assert.deepEqual(list.getSnapshot().rows, []);
  await list.load(async () => [{ id:'class-b' }]);
  assert.equal(list.getSnapshot().phase, 'ready'); assert.equal(list.getSnapshot().error, null);
  list.cancel(); assert.equal(list.getSnapshot().rows.length, 0);
  assert.ok(publications >= 8); unsubscribe();
});

test('pagination deduplicates, excludes double taps, and ignores superseded/blurred reads', async () => {
  const list = new PagedList(); const first = Array.from({ length:50 }, (_,i) => ({ id:String(i) }));
  await list.load(async offset => { assert.equal(offset,0); return first; });
  assert.equal(list.getSnapshot().hasMore, true);
  await list.load(async offset => { assert.equal(offset,50); return [{ id:'49' },{ id:'50' },{ id:'50' }]; },50);
  assert.equal(list.getSnapshot().rows.length, 51); assert.equal(list.getSnapshot().hasMore, false);
  const old = deferred(); const obsolete = list.load(() => old.promise);
  let duplicates = 0; await list.load(async () => { duplicates++; return []; }); assert.equal(duplicates,0);
  list.cancel();
  await list.load(async () => [{ id:'new-current-class' }]);
  old.resolve([{ id:'old-private-class' }]); await obsolete;
  assert.deepEqual(list.getSnapshot().rows, [{ id:'new-current-class' }]);
});

test('class selection stays within fresh authorized memberships and drops removed selections', () => {
  const current = { phase:'ready', rows:[{ id:'one' },{ id:'two' }] };
  assert.equal(selectedClass(current,'two').id, 'two');
  assert.equal(selectedClass(current,'other-student-class').id, 'one');
  assert.equal(selectedClass({ ...current, rows:[{ id:'one' }] },'two').id, 'one');
  assert.equal(selectedClass({ ...current, phase:'loading' },'one'), null);
  assert.equal(selectedClass({ ...current, phase:'error' },'one'), null);
  assert.equal(selectedClass({ ...current, rows:[] },'one'), null);
});

test('logout waits for server revocation, blocks further reads, and rejects late results', async () => {
  const store = vault(); const controller = new SessionController(store);
  await controller.restore(async () => profile);
  const pendingRead = deferred(); const oldRead = controller.run(() => pendingRead.promise);
  const rejectedRead = assert.rejects(oldRead, SessionChangedError);
  const server = deferred(); const leaving = controller.logout(secret => { assert.equal(secret,'test-only'); return server.promise; });
  assert.equal(store.value, 'test-only'); assert.equal(store.clears,0); assert.equal(controller.blocked,true);
  await assert.rejects(controller.run(async () => 'private'), SessionChangedError);
  pendingRead.resolve('obsolete private data'); await rejectedRead;
  server.resolve(); await leaving;
  assert.equal(store.value,null); assert.equal(controller.credential,null); assert.equal(controller.blocked,false);
});

test('interrupted logout retains secure credential but blocks dashboard; retry accepts already-revoked 401', async () => {
  const store = vault(); const controller = new SessionController(store); await controller.restore(async () => profile);
  await assert.rejects(controller.logout(async () => { throw new ApiError(0,'lost response'); }));
  assert.equal(store.value,'test-only'); assert.equal(controller.blocked,true);
  await assert.rejects(controller.restore(async () => profile), /Finish signing out/);
  await assert.rejects(controller.create(async () => ({ user:profile, session:{ credential:'new' } })));
  await controller.logout(async secret => { assert.equal(secret,'test-only'); throw new ApiError(401,'already revoked'); });
  assert.equal(store.value,null); assert.equal(controller.credential,null);
});

test('failed secure cleanup retries without repeating confirmed revocation', async () => {
  const store = vault(); let clears = 0; store.clear = async () => { if (++clears === 1) throw new Error('SecureStore unavailable'); store.value = null; };
  const controller = new SessionController(store); await controller.restore(async () => profile); let revokes = 0;
  await assert.rejects(controller.logout(async () => { revokes++; }));
  assert.equal(controller.credential,null); assert.equal(controller.blocked,true);
  await controller.logout(async () => { revokes++; });
  assert.equal(revokes,1); assert.equal(store.value,null);
});

test('invalid session clears memory before slow/failed storage cleanup; restore retries cleanup only', async () => {
  const store = vault(); const controller = new SessionController(store); await controller.restore(async () => profile);
  store.clear = async () => { throw Error('storage failure'); };
  await assert.rejects(controller.invalidate());
  assert.equal(controller.credential,null); assert.equal(controller.blocked,true);
  await assert.rejects(controller.run(async () => 'private'), SessionChangedError);
  store.clear = async () => { store.value = null; };
  assert.equal(await controller.restore(async () => { throw Error('must not revalidate invalid credential'); }),null);
  assert.equal(store.value,null); assert.equal(controller.blocked,false);
});

test('overlapping restoration cannot restore an old user or erase a newer session', async () => {
  const store = vault(); const controller = new SessionController(store);
  const old = deferred(); const first = controller.restore(() => old.promise);
  const rejected = assert.rejects(first, SessionChangedError);
  await new Promise(resolve => setImmediate(resolve));
  const newer = { ...profile, username:'CurrentUser' };
  assert.equal(await controller.restore(async () => newer),newer);
  old.reject(new ApiError(401,'old request')); await rejected;
  assert.equal(store.value,'test-only'); assert.equal(store.clears,0);
  assert.equal(await controller.run(async () => newer),newer);
  store.value = null;
  assert.equal(await controller.restore(async () => { throw Error('must not fetch without credential'); }),null);
  assert.equal(controller.credential,null);
});

test('current network and forbidden errors retain credentials without inventing a new profile', async () => {
  const store = vault(); const controller = new SessionController(store); await controller.restore(async () => profile);
  await assert.rejects(controller.run(async () => { throw new ApiError(403,'forbidden'); }));
  assert.equal(store.value,'test-only'); assert.equal(controller.blocked,false);
  await assert.rejects(controller.restore(async () => { throw new ApiError(503,'offline'); }));
  assert.equal(store.value,'test-only'); assert.equal(controller.blocked,true);
  assert.equal(await controller.restore(async () => profile),profile);
});

test('logout client uses existing bearer endpoint and never sends the secret in URL/body', async () => {
  const previous = process.env.EXPO_PUBLIC_API_URL; const original = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000';
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url,'http://localhost:8000/api/v1/sessions/revoke');
      assert.equal(options.method,'POST'); assert.equal(options.headers.Authorization,'Bearer test-only');
      assert.equal(options.body,undefined); return new Response(null,{ status:204 });
    };
    assert.equal(await identity.revoke('test-only'),undefined);
    globalThis.fetch = async () => new Response(null,{ status:401 });
    await assert.rejects(identity.revoke('test-only'), error => error.status === 401);
  } finally { globalThis.fetch = original; if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previous; }
});
