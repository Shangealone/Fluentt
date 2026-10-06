import { ReviewAttemptCreate } from '../../reviews/types';
import {
  checkServerReachability,
  drainReviewQueue,
  getServerReachability,
  setSyncOnlineStatus,
} from '../syncWorker';
import {
  enqueuePendingReview,
  getPendingReviews,
  getTotalPendingCount,
} from '../reviewQueue';
import { resetDatabaseForTesting } from '../db';

// Mock tokenStore
jest.mock('../../auth/tokenStore', () => ({
  loadTokens: jest.fn().mockResolvedValue({ accessToken: 'valid-token', refreshToken: 'valid-refresh' }),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  clearTokensIfCurrent: jest.fn().mockResolvedValue(true),
  rotateTokens: jest.fn().mockResolvedValue(true),
  sameTokens: (a: any, b: any) => Boolean(a && b && a.accessToken === b.accessToken && a.refreshToken === b.refreshToken),
  loadAuthenticatedAccount: jest.fn().mockResolvedValue({ userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tokens: { accessToken: 'valid-token', refreshToken: 'valid-refresh' }, generation: 0 }),
  isAccountCurrent: () => true,
}));

describe('Offline Review Sync Worker', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    setSyncOnlineStatus(true);
    await resetDatabaseForTesting();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const event1: ReviewAttemptCreate = {
    client_event_id: '11111111-1111-4111-8111-111111111111',
    client_session_id: '99999999-9999-4999-8999-999999999999',
    client_interaction_at: '2025-01-01T11:22:33.456Z',
    device_platform: 'ios',
    application_version: '1.0.0',
    session_id: 'session-1',
    vocabulary_item_id: 'vocab-1',
    response_time_ms: 1200,
    correct: true,
    submitted_answer: 'correct',
  };

  const event2: ReviewAttemptCreate = {
    client_event_id: '22222222-2222-4222-8222-222222222222',
    client_session_id: '99999999-9999-4999-8999-999999999999',
    client_interaction_at: '2025-01-01T11:22:33.456Z',
    device_platform: 'ios',
    application_version: '1.0.0',
    session_id: 'session-1',
    vocabulary_item_id: 'vocab-1', // same vocabulary item, distinct client_event_id
    response_time_ms: 950,
    correct: true,
    submitted_answer: 'correct',
  };

  it('drains pending reviews to /sync/review-events and deletes them from SQLite queue on success', async () => {
    await enqueuePendingReview(event1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(await getTotalPendingCount()).toBe(1);

    let syncRequestBody: any = null;

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/sync/review-events')) {
        syncRequestBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            processed_count: 1,
            results: [
              {
                client_event_id: event1.client_event_id,
                status: 'accepted',
                attempt_id: 'attempt-1',
                due_date: '2026-09-23T08:00:00Z',
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const result = await drainReviewQueue();

    expect(result.syncedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(syncRequestBody).not.toBeNull();
    expect(syncRequestBody.events).toHaveLength(1);
    expect(syncRequestBody.events[0].client_event_id).toBe(event1.client_event_id);

    // Queue is drained
    expect(await getTotalPendingCount()).toBe(0);
    const remaining = await getPendingReviews();
    expect(remaining).toHaveLength(0);
  });

  it('preserves distinct attempts for same vocabulary item with distinct client_event_id (Clarification 4.B)', async () => {
    await enqueuePendingReview(event1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await enqueuePendingReview(event2, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(await getTotalPendingCount()).toBe(2);

    const syncRequestBodies: any[] = [];

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/sync/review-events')) {
        syncRequestBodies.push(JSON.parse(opts.body));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            processed_count: 2,
            results: [
              {
                client_event_id: event1.client_event_id,
                status: 'accepted',
                attempt_id: 'attempt-1',
                due_date: '2026-09-23T08:00:00Z',
              },
              {
                client_event_id: event2.client_event_id,
                status: 'accepted',
                attempt_id: 'attempt-2',
                due_date: '2026-09-23T08:01:00Z',
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const result = await drainReviewQueue();

    expect(result.syncedCount).toBe(2);
    expect(syncRequestBodies).toHaveLength(2);
    expect(syncRequestBodies.map((body) => body.events)).toEqual([[event1], [event2]]);

    expect(await getTotalPendingCount()).toBe(0);
  });

  it('handles 401/session expiry: queue is NOT deleted, draining pauses for auth handling (Clarification 4.A)', async () => {
    await enqueuePendingReview(event1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(await getTotalPendingCount()).toBe(1);

    // Backend returns 401 Unauthorized
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/sync/review-events') || url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ detail: 'Session expired' }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const result = await drainReviewQueue();

    expect(result.authPaused).toBe(true);
    expect(result.syncedCount).toBe(0);

    // Critical check: Queue is NOT deleted, pending event remains stored
    expect(await getTotalPendingCount()).toBe(1);
    const items = await getPendingReviews();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
    expect(items[0].client_event_id).toBe(event1.client_event_id);
  });

  it('handles network failure: retains pending events in queue, marks last_error and resets status to pending', async () => {
    await enqueuePendingReview(event1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

    const result = await drainReviewQueue();

    expect(result.syncedCount).toBe(0);
    expect(result.error).toBe('Network timeout');

    // Retained in SQLite queue
    expect(await getTotalPendingCount()).toBe(1);
    const items = await getPendingReviews();
    expect(items).toHaveLength(1);
    expect(items[0].last_error).toBe('Network timeout');
    expect(items[0].attempt_count).toBeGreaterThanOrEqual(1);
  });

  it('does not attempt sync when offline', async () => {
    await enqueuePendingReview(event1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    setSyncOnlineStatus(false);

    global.fetch = jest.fn();

    const result = await drainReviewQueue();

    expect(result.skipped).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(await getTotalPendingCount()).toBe(1);
  });

  it('checks server reachability via /health and updates reachability state', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const isReachable = await checkServerReachability();
    expect(isReachable).toBe(true);
    expect(getServerReachability()).toBe(true);

    // When /health fails (e.g. backend down / ECONNREFUSED)
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.reject(new TypeError('Network request failed'));
      }
      return Promise.reject(new Error('Unknown'));
    });

    const isUnreachable = await checkServerReachability();
    expect(isUnreachable).toBe(false);
    expect(getServerReachability()).toBe(false);
  });

  it('ensures failed Sync Now attempts never delete pending items from SQLite', async () => {
    await enqueuePendingReview(event1, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await enqueuePendingReview(event2, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(await getTotalPendingCount()).toBe(2);

    // Backend is down / connection refused
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    // Attempt 1: Failed sync
    const result1 = await drainReviewQueue();
    expect(result1.syncedCount).toBe(0);
    expect(await getTotalPendingCount()).toBe(2);

    // Attempt 2: Another failed sync
    const result2 = await drainReviewQueue();
    expect(result2.syncedCount).toBe(0);
    expect(await getTotalPendingCount()).toBe(2);

    // Verify all payloads remain intact in SQLite
    const remaining = await getPendingReviews();
    expect(remaining).toHaveLength(2);
    expect(remaining[0].client_event_id).toBe(event1.client_event_id);
    expect(remaining[0].payload.vocabulary_item_id).toBe(event1.vocabulary_item_id);
    expect(remaining[0].payload.response_time_ms).toBe(event1.response_time_ms);
    expect(remaining[1].client_event_id).toBe(event2.client_event_id);
  });
});
