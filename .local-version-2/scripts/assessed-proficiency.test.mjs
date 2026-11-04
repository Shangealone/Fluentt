import test from 'node:test';
import assert from 'node:assert/strict';
import { assessedProficiencyAccess } from '../apps/mobile/src/services/api/assessedProficiency.ts';

test('assessment requests preserve original identity, expected event, and language scope', async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://synthetic.test';
  const calls = [];
  let response = { student_id: 'student', username: 'Synthetic student', language: 'english', current: null, history: [], offset: 0, has_more: false };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify(response), { status: 200 });
  };
  try {
    const api = assessedProficiencyAccess(operation => operation('synthetic-only'));
    const body = { level: 'beginner', assessed_on: '2026-01-10', expected_event_id: 'previous-event' };
    await api.record('class', 'student', body, 'original-key');
    await api.record('class', 'student', body, 'original-key');
    assert.equal(calls[0].url, 'http://synthetic.test/api/v1/classes/class/students/student/assessed-proficiency');
    assert.deepEqual(JSON.parse(calls[0].body), body);
    assert.equal(calls[0].headers['Idempotency-Key'], 'original-key');
    assert.equal(calls[1].body, calls[0].body);
    assert.equal(calls[1].headers['Idempotency-Key'], calls[0].headers['Idempotency-Key']);
    await api.mine('tagalog', 20);
    assert.equal(calls[2].url, 'http://synthetic.test/api/v1/me/assessed-proficiency?language=tagalog&offset=20');
    assert.equal(calls[2].body, undefined);
    response = { ...response, current: { id: 'event', level: 'unsupported', assessed_on: null, recorded_at: '2026-01-10', recorded_by: 'Teacher' } };
    await assert.rejects(api.read('class', 'student'), /confirm this assessment record/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalBase;
  }
});
