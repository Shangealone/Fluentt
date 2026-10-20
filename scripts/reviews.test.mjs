import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDueBatch,
  reviewsApi,
  reviewsAccess,
} from '../apps/mobile/src/services/api/reviews.ts';

const stamp = '2026-10-19T12:00:00Z';

const mockDueBatch = {
  items: [
    {
      review_state_id: 'state-1',
      vocabulary_item_id: 'voc-1',
      term: 'bathala',
      meaning: 'diyos o dakilang lumikha',
      language: 'tagalog',
      due_at: stamp,
      last_reviewed_at: null,
      overdue_seconds: 0.0,
    },
  ],
  total_due: 1,
  algorithm: 'sm2',
  as_of: stamp,
};

test('validateDueBatch accepts well-formed response', () => {
  const result = validateDueBatch(mockDueBatch);
  assert.equal(result.total_due, 1);
  assert.equal(result.algorithm, 'sm2');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].term, 'bathala');
});

test('validateDueBatch rejects missing fields', () => {
  assert.throws(
    () => validateDueBatch({ items: [], total_due: 0 }),
    /Malformed due review batch response/
  );
  assert.throws(
    () =>
      validateDueBatch({
        items: [{ review_state_id: 's1' }],
        total_due: 1,
        algorithm: 'sm2',
        as_of: stamp,
      }),
    /Malformed due review item/
  );
});

test('reviewsAccess wraps runner correctly', async () => {
  const prevUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000';
  const calls = [];
  const fakeRunner = async op => {
    calls.push('invoked');
    return op('test-secret');
  };

  // Mock global fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url.includes('/me/reviews/algorithms')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          available_algorithms: ['fifakt', 'fsrs6', 'sm2'],
          policy: 'spaced-repetition-foundation-v1',
        }),
      };
    }
    if (url.includes('/me/reviews/due')) {
      const algo = url.includes('algorithm=fifakt')
        ? 'fifakt'
        : url.includes('algorithm=fsrs6')
        ? 'fsrs6'
        : 'sm2';
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          ...mockDueBatch,
          algorithm: algo,
        }),
      };
    }
    if (url.includes('/me/reviews/events')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          status: 'committed',
          event_key: 'event-1',
          state_revision: 2,
          due_at: stamp,
          interval_seconds: 86400,
        }),
      };
    }
    throw new Error(`Unexpected url ${url}`);
  };

  try {
    const access = reviewsAccess(fakeRunner);

    const algos = await access.algorithms();
    assert.deepEqual(algos.available_algorithms, ['fifakt', 'fsrs6', 'sm2']);

    const dueSm2 = await access.dueReviews('sm2', 'self_study');
    assert.equal(dueSm2.total_due, 1);
    assert.equal(dueSm2.algorithm, 'sm2');

    const dueFsrs = await access.dueReviews('fsrs6', 'self_study');
    assert.equal(dueFsrs.total_due, 1);
    assert.equal(dueFsrs.algorithm, 'fsrs6');

    const dueFifakt = await access.dueReviews('fifakt', 'self_study');
    assert.equal(dueFifakt.total_due, 1);
    assert.equal(dueFifakt.algorithm, 'fifakt');

    const result = await access.submitReview(
      {
        event_key: 'event-1',
        vocabulary_item_id: 'voc-1',
        recall_rating: 'good',
        response_duration_ms: 1200,
        reviewed_at: stamp,
      },
      'fifakt'
    );
    assert.equal(result.status, 'committed');
    assert.equal(result.state_revision, 2);

    assert.equal(calls.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevUrl;
  }
});
