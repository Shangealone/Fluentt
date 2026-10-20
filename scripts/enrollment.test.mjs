import test from 'node:test';
import assert from 'node:assert/strict';
import { EnrollmentFlow } from '../apps/mobile/src/features/enrollment/state.ts';
import { enrollmentApi } from '../apps/mobile/src/services/api/enrollment.ts';
import { ApiError } from '../apps/mobile/src/services/api/client.ts';
import { SessionController } from '../apps/mobile/src/session/controller.ts';
import { destination } from '../apps/mobile/src/session/routing.ts';

const preview = { class_name: 'Synthetic class', grade_level: 5, language: 'tagalog',
  instructor_display_name: null, class_version: 'a'.repeat(64) };
const membership = { ...preview, id: 'b8098185-daf9-4f56-a13f-54b7ec3b037a',
  class_id: '104326fd-63b3-4831-bb78-6b69920be2a0', joined_at: '2026-10-17T00:00:00Z', status: 'active' };

test('verification requires six ASCII digits, does not enroll, and cancel clears preview', async () => {
  const flow = new EnrollmentFlow(); let calls = 0;
  for (const code of ['', '12345', '1234567', '１２３４５６', '12 345', 'abcdef'])
    await assert.rejects(flow.verify(code, async () => { calls++; return preview; }));
  assert.equal(calls, 0);
  await assert.rejects(flow.join(async () => membership), /Verify/);
  await flow.verify('000001', async code => { assert.equal(code, '000001'); return preview; });
  assert.equal(flow.confirmed, null); assert.equal(flow.pending, null);
  assert.equal(flow.cancel(), true); assert.equal(flow.preview, null);
  await assert.rejects(flow.join(async () => membership), /Verify/);
});

test('single-flight verification/join, safe interrupted retry, and confirmed-only success', async () => {
  const flow = new EnrollmentFlow(); let finish;
  const running = flow.verify('000001', () => new Promise(resolve => { finish = resolve; }));
  await assert.rejects(flow.verify('000001', async () => preview), /wait/);
  assert.equal(flow.cancel(), false); finish(preview); await running;
  const requests = [];
  await assert.rejects(flow.join(async body => { requests.push(body); throw new ApiError(0, 'network'); }));
  assert.equal(flow.confirmed, null); assert.equal(flow.pending.code, '000001');
  await assert.rejects(flow.verify('000002', async () => preview), /saved classes/);
  let complete;
  const joining = flow.join(body => { requests.push(body); return new Promise(resolve => { complete = resolve; }); });
  await assert.rejects(flow.join(async () => membership), /wait/);
  assert.equal(flow.cancel(), false); complete(membership); await joining;
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(flow.pending, null); assert.equal(flow.confirmed.id, membership.id);
});

test('changed/unavailable previews require review; throttling retains retry state', async () => {
  for (const status of [404, 409, 401, 422, 429, 503]) {
    const flow = new EnrollmentFlow(); await flow.verify('000001', async () => preview);
    await assert.rejects(flow.join(async () => { throw new ApiError(status, 'safe failure'); }));
    assert.equal(flow.confirmed, null);
    assert.equal(flow.pending !== null, status === 429 || status === 503);
    assert.equal(flow.preview !== null, status === 429 || status === 503);
  }
});

test('enrollment clients use authenticated POST bodies, bounded list requests, and safe errors', async () => {
  const original = globalThis.fetch; const previous = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000'; const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return Response.json(url.includes('previews') ? preview : url.includes('/mine') ? [membership] : membership);
    };
    assert.deepEqual(await enrollmentApi.preview('test-only', '000001'), preview);
    assert.deepEqual(JSON.parse(calls[0].options.body), { code: '000001' });
    assert.ok(!calls[0].url.includes('000001'));
    await enrollmentApi.confirm('test-only', { code: '000001', class_version: preview.class_version });
    assert.equal(calls[1].options.method, 'POST');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer test-only');
    assert.equal((await enrollmentApi.mine('test-only', 50)).length, 1);
    assert.match(calls[2].url, /limit=50&offset=50/);
    for (const [status, code, expected] of [[404,'invitation_unavailable',/invalid or unavailable/],
      [409,'preview_changed',/review again/], [403,'school_student_required',/school students/]]) {
      globalThis.fetch = async () => Response.json({ error: { code, message: 'private server message' } }, { status });
      await assert.rejects(enrollmentApi.preview('test-only','000001'), error => error.status === status && expected.test(error.message));
    }
    globalThis.fetch = async () => { throw new Error('private transport detail'); };
    await assert.rejects(enrollmentApi.preview('test-only','000001'), error => error.status === 0 && !error.message.includes('private'));
    for (const value of [null, {}, { ...preview, language: 'filipino' }, { ...preview, class_version: 'bad' }]) {
      globalThis.fetch = async () => Response.json(value);
      await assert.rejects(enrollmentApi.preview('test-only','000001'));
    }
    globalThis.fetch = async () => Response.json([{ ...membership, class_id: 'bad' }]);
    await assert.rejects(enrollmentApi.mine('test-only'));
    globalThis.fetch = async () => Response.json({ ...membership, status: 'removed' });
    await assert.rejects(enrollmentApi.confirm('test-only', { code: '000001', class_version: preview.class_version }));
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previous;
  }
});

test('restored backend membership completion routes school students without changing personal/instructor paths', async () => {
  const vault = { value: 'test-only', async read() { return this.value; }, async save(value) { this.value = value; }, async clear() { this.value = null; } };
  const controller = new SessionController(vault);
  for (const [status, expected] of [['onboarding','/class-code'],['active','/student']]) {
    const profile = await controller.restore(async () => ({ role:'school_student', profile_status: status }));
    assert.equal(destination(profile), expected);
  }
  await assert.rejects(controller.restore(async () => { throw new ApiError(503,'offline'); }));
  assert.equal(vault.value, 'test-only');
  assert.equal(await controller.restore(async () => { throw new ApiError(401,'revoked'); }), null);
  assert.equal(vault.value, null);
  assert.equal(destination({ role:'personal_student', grade:null, language:null }), '/learning-focus');
  assert.equal(destination({ role:'personal_student', grade:5, language:'english' }), '/student');
  assert.equal(destination({ role:'instructor', profile_status:'onboarding' }), '/first-class');
  assert.equal(destination({ role:'instructor', profile_status:'active' }), '/instructor');
});
