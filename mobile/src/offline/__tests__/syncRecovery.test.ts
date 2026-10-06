import { DatabaseSync } from 'node:sqlite';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Constants from 'expo-constants';
import { submitReviewAttempt } from '../../reviews/api';
import * as storage from '../db';
import { runMigrations } from '../migrations';
import { enqueuePendingReview, getPendingReviews, markReviewStatus } from '../reviewQueue';
import { drainReviewQueue, setSyncOnlineStatus } from '../syncWorker';
import { apiClient } from '../../api/client';
import { clearTokens, loadTokens, saveTokens } from '../../auth/tokenStore';
import { acknowledgeReview, claimReview, finishReview, recoverStaleReviews, renewReviewLease, resumeAuthPausedReviews, SYNC_LEASE_MS } from '../queueTransitions';

jest.mock('expo-constants', () => {
  const configuration = require('../../../app.json');
  return { __esModule: true, default: { expoConfig: { ...configuration.expo } } };
});

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { values.set(key, value); },
    deleteItemAsync: async (key: string) => { values.delete(key); },
  };
});

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const event = {
  client_event_id: '11111111-1111-4111-8111-111111111111',
  client_session_id: '99999999-9999-4999-8999-999999999999',
  client_interaction_at: '2025-01-01T11:22:33.456Z',
  device_platform: 'ios',
  application_version: '1.0.0',
  session_id: '22222222-2222-4222-8222-222222222222',
  vocabulary_item_id: '33333333-3333-4333-8333-333333333333',
  response_time_ms: 1234, correct: true, submitted_answer: 'correct',
};
const second = { ...event, client_event_id: '44444444-4444-4444-8444-444444444444' };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data });
const accepted = (id: string) => response({ results: [{ client_event_id: id, status: 'accepted' }] });

describe('D3 worker with real SQLite', () => {
  let sqlite: DatabaseSync;
  const originalFetch = global.fetch;
  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    const db: storage.DatabaseInterface = {
      execAsync: async (sql) => { sqlite.exec(sql); },
      runAsync: async (sql, ...params) => {
        const result = sqlite.prepare(sql).run(...params.flat());
        return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
      },
      getAllAsync: async <T,>(sql: string, ...params: any[]) => sqlite.prepare(sql).all(...params.flat()) as T[],
      getFirstAsync: async <T,>(sql: string, ...params: any[]) => (sqlite.prepare(sql).get(...params.flat()) ?? null) as T | null,
    };
    await runMigrations(db);
    jest.spyOn(storage, 'getDatabase').mockResolvedValue(db);
    await clearTokens();
    await saveTokens({ accessToken: 'access-A', refreshToken: 'refresh-A' });
    global.fetch = jest.fn().mockResolvedValue(response({ user_id: A }));
    await apiClient('/users/me');
    setSyncOnlineStatus(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
    global.fetch = originalFetch;
  });

  it('sends identical canonical facts online, from SQLite, after app update, backoff, auth resume and lost acknowledgement', async () => {
    const canonical = { ...event, correct: false, submitted_answer: 'incorrect' };
    const accidentalExtras = { ...canonical, access_token: 'SECRET_ACCESS', refresh_token: 'SECRET_REFRESH',
      jwt: 'SECRET_JWT', password: 'SECRET_PASSWORD', email: 'private@example.test',
      owner_user_id: B, lease_id: 'SECRET_LEASE', failure_kind: 'permanent', next_retry_at: 42, attempt_count: 99,
      created_at: 'operational-only', updated_at: 'operational-only' };
    const sent: any[] = [];
    const captureBody = (options: any) => {
      const body = JSON.parse(options.body);
      sent.push(body.events ? body.events[0] : body);
    };
    global.fetch = jest.fn(async (_url: string, options: any) => {
      captureBody(options);
      throw new TypeError('Online acknowledgement lost');
    }) as any;
    await expect(submitReviewAttempt(accidentalExtras, A)).rejects.toThrow('Online acknowledgement lost');
    await enqueuePendingReview(accidentalExtras, A);
    const bytes = () => sqlite.prepare('SELECT payload_json FROM pending_review_events').get()?.payload_json;
    const originalBytes = bytes();
    expect(JSON.parse(originalBytes as string)).toEqual(canonical);
    jest.replaceProperty(Constants.expoConfig!, 'version', '2.0.0');
    global.fetch = jest.fn(async (_url: string, options: any) => {
      captureBody(options);
      return response({ detail: 'Unavailable' }, 503);
    }) as any;
    await drainReviewQueue();
    expect(bytes()).toBe(originalBytes);
    // Use the existing persisted eligibility field, without changing D3 backoff rules.
    sqlite.exec('UPDATE pending_review_events SET next_retry_at = 0');
    global.fetch = jest.fn(async (_url: string, options: any) => {
      captureBody(options);
      return response({ detail: 'Reauthenticate' }, 403);
    }) as any;
    expect((await drainReviewQueue()).authPaused).toBe(true);
    expect(bytes()).toBe(originalBytes);
    await saveTokens({ accessToken: 'new-access-A', refreshToken: 'new-refresh-A' });
    global.fetch = jest.fn().mockResolvedValue(response({ user_id: A }));
    await apiClient('/users/me');
    await resumeAuthPausedReviews(A);
    global.fetch = jest.fn(async (_url: string, options: any) => {
      captureBody(options);
      throw new TypeError('Sync acknowledgement lost');
    }) as any;
    await drainReviewQueue();
    expect(bytes()).toBe(originalBytes);
    sqlite.exec('UPDATE pending_review_events SET next_retry_at = 0');
    global.fetch = jest.fn(async (_url: string, options: any) => {
      captureBody(options);
      return accepted(event.client_event_id);
    }) as any;
    expect((await drainReviewQueue()).syncedCount).toBe(1);
    expect(sent).toHaveLength(5);
    for (const body of sent) expect(body).toEqual(canonical);
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it('preserves incomplete legacy bytes without fabricated metadata and parks only the rejected row', async () => {
    const legacy = { client_event_id: event.client_event_id, session_id: event.session_id,
      vocabulary_item_id: event.vocabulary_item_id, correct: false, response_time_ms: 1234,
      created_at: '2020-01-01T00:00:00Z' };
    const originalBytes = JSON.stringify(legacy);
    sqlite.prepare(`INSERT INTO pending_review_events
      (client_event_id, payload_json, owner_user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', '2020-01-01', '2020-01-01')`).run(event.client_event_id, originalBytes, A);
    await enqueuePendingReview(second, A);
    const sent: any[] = [];
    global.fetch = jest.fn(async (_url: string, options: any) => {
      const payload = JSON.parse(options.body).events[0];
      sent.push(payload);
      return payload.client_event_id === event.client_event_id
        ? response({ detail: 'Required captured metadata missing' }, 422) : accepted(second.client_event_id);
    }) as any;
    expect(await drainReviewQueue()).toMatchObject({ syncedCount: 1, failedCount: 1 });
    expect(sent).toEqual([legacy, second]);
    const retained = (await getPendingReviews())[0];
    expect(retained).toMatchObject({ payload: legacy, status: 'failed', failure_kind: 'permanent', owner_user_id: A });
    expect(sqlite.prepare('SELECT payload_json FROM pending_review_events').get()?.payload_json).toBe(originalBytes);
    for (const field of ['client_session_id', 'client_interaction_at', 'application_version', 'device_platform']) {
      expect(retained.payload).not.toHaveProperty(field);
    }
    (global.fetch as jest.Mock).mockClear();
    await drainReviewQueue();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('recovers stale syncing for A without changing UUID, owner, payload, B or ownerless work', async () => {
    await enqueuePendingReview(event, A);
    await enqueuePendingReview(second, B);
    await markReviewStatus(event.client_event_id, 'syncing', undefined, A);
    await markReviewStatus(second.client_event_id, 'syncing', undefined, B);
    sqlite.exec("UPDATE pending_review_events SET updated_at = '2020-01-01T00:00:00.000Z'");
    sqlite.prepare(`INSERT INTO pending_review_events
      (client_event_id, payload_json, status, created_at, updated_at)
      VALUES ('legacy', '{}', 'syncing', '2020-01-01', '2020-01-01')`).run();
    const before = sqlite.prepare('SELECT * FROM pending_review_events').all();
    global.fetch = jest.fn().mockRejectedValue(new Error('lost acknowledgement'));
    await drainReviewQueue();
    const rows = await getPendingReviews();
    expect(rows.find((row) => row.owner_user_id === A)).toMatchObject({
      client_event_id: event.client_event_id, owner_user_id: A, payload: event,
      status: 'pending', attempt_count: 2, last_error: 'lost acknowledgement',
    });
    for (const untouched of before.filter((row) => row.owner_user_id !== A)) {
      expect(sqlite.prepare('SELECT * FROM pending_review_events WHERE client_event_id = ?').get(untouched.client_event_id!)).toEqual(untouched);
    }
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).events).toEqual([event]);
  });

  it('does not recover a non-stale active sync', async () => {
    await enqueuePendingReview(event, A);
    await markReviewStatus(event.client_event_id, 'syncing', undefined, A);
    global.fetch = jest.fn();
    await drainReviewQueue();
    expect(global.fetch).not.toHaveBeenCalled();
    expect((await getPendingReviews())[0]).toMatchObject({ status: 'syncing', attempt_count: 1 });
  });

  it('isolates permanent invalid events, drains later valid work, and never automatically retries invalid work', async () => {
    await enqueuePendingReview(event, A);
    await enqueuePendingReview(second, A);
    global.fetch = jest.fn(async (_url: string, options: any) => {
      const events = JSON.parse(options.body).events;
      expect(events).toHaveLength(1);
      return events[0].client_event_id === event.client_event_id
        ? response({ detail: 'Vocabulary item not found' }, 400) : accepted(second.client_event_id);
    }) as any;
    expect(await drainReviewQueue()).toMatchObject({ syncedCount: 1, failedCount: 1 });
    expect((await getPendingReviews())[0]).toMatchObject({ payload: event, owner_user_id: A,
      status: 'failed', attempt_count: 1, last_error: 'Vocabulary item not found' });
    (global.fetch as jest.Mock).mockClear();
    await drainReviewQueue();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('records a transient attempt once and respects retry backoff', async () => {
    await enqueuePendingReview(event, A);
    global.fetch = jest.fn().mockResolvedValue(response({ detail: 'Unavailable' }, 503));
    await drainReviewQueue();
    await drainReviewQueue();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await getPendingReviews())[0]).toMatchObject({ payload: event, status: 'pending', attempt_count: 1 });
  });

  it('preserves a 403 and pauses all work for reauthentication', async () => {
    await enqueuePendingReview(event, A);
    await enqueuePendingReview(second, A);
    global.fetch = jest.fn().mockResolvedValue(response({ detail: 'Reauthenticate' }, 403));
    expect((await drainReviewQueue()).authPaused).toBe(true);
    expect((await drainReviewQueue()).authPaused).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await getPendingReviews()).toHaveLength(2);
    expect((await getPendingReviews())[0].payload).toEqual(event);
  });

  it('retains missing acknowledgements for retry instead of stranding syncing work', async () => {
    await enqueuePendingReview(event, A);
    global.fetch = jest.fn().mockResolvedValue(response({ results: [] }));
    await drainReviewQueue();
    expect((await getPendingReviews())[0]).toMatchObject({ payload: event, status: 'pending', attempt_count: 1 });
  });

  it.each(['transport', 'server'])('keeps a %s failure during token refresh transient instead of deleting credentials', async (failure) => {
    await enqueuePendingReview(event, A);
    global.fetch = jest.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        if (failure === 'transport') throw new TypeError('Refresh connection lost');
        return response({ detail: 'Refresh service unavailable' }, 503);
      }
      return response({}, 401);
    }) as any;
    expect((await drainReviewQueue()).authPaused).not.toBe(true);
    expect(await loadTokens()).toEqual({ accessToken: 'access-A', refreshToken: 'refresh-A' });
    expect((await getPendingReviews())[0]).toMatchObject({ status: 'pending', failure_kind: 'transient', attempt_count: 1, payload: event });
  });

  it('does not recover a lease renewed between the recovery read and conditional update', async () => {
    await enqueuePendingReview(event, A);
    const item = (await getPendingReviews())[0];
    await claimReview(item, A, 'live', Date.now() - SYNC_LEASE_MS);
    const db = await storage.getDatabase();
    const read = db.getAllAsync.bind(db);
    jest.spyOn(db, 'getAllAsync').mockImplementationOnce(async (sql, ...params) => {
      const rows = await read(sql, ...params);
      await renewReviewLease(event.client_event_id, A, 'live');
      return rows;
    });
    await recoverStaleReviews(A);
    expect((await getPendingReviews())[0]).toMatchObject({ status: 'syncing', lease_id: 'live', attempt_count: 1 });
  });

  it('times out a stuck shared refresh and allows subsequent synchronization', async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn(async (url: string) => url.endsWith('/auth/refresh')
        ? new Promise(() => {}) : response({}, 401)) as any;
      const request = apiClient('/sync/review-events', { method: 'POST', body: JSON.stringify({ events: [event] }), expectedUserId: A });
      const rejection = expect(request).rejects.toThrow('Token refresh timed out.');
      await jest.advanceTimersByTimeAsync(30_000);
      await rejection;
      expect(await loadTokens()).toEqual({ accessToken: 'access-A', refreshToken: 'refresh-A' });
      await enqueuePendingReview(event, A);
      global.fetch = jest.fn().mockResolvedValue(accepted(event.client_event_id));
      expect((await drainReviewQueue()).syncedCount).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs only one worker when manual and lifecycle drains overlap', async () => {
    await enqueuePendingReview(event, A);
    let release!: (value: any) => void;
    global.fetch = jest.fn(() => new Promise((resolve) => { release = resolve; })) as any;
    const first = drainReviewQueue();
    while (!release) await new Promise((resolve) => setImmediate(resolve));
    expect((await drainReviewQueue()).skipped).toBe(true);
    release(accepted(event.client_event_id));
    expect((await first).syncedCount).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('recovers at the exact lease boundary and fences old acknowledgements, errors and heartbeats', async () => {
    await enqueuePendingReview(event, A);
    const original = (await getPendingReviews())[0];
    const now = Date.now();
    expect(await claimReview(original, B, 'wrong', now)).toBe(false);
    expect(await claimReview(original, A, 'old', now)).toBe(true);
    expect(await claimReview(original, A, 'duplicate', now)).toBe(false);
    await recoverStaleReviews(A, now + SYNC_LEASE_MS - 1);
    expect((await getPendingReviews())[0].status).toBe('syncing');
    await recoverStaleReviews(A, now + SYNC_LEASE_MS);
    const recovered = (await getPendingReviews())[0];
    expect(recovered).toMatchObject({ status: 'pending', payload: event, owner_user_id: A, attempt_count: 1 });
    expect(await claimReview(recovered, A, 'new', now + SYNC_LEASE_MS)).toBe(true);
    const live = await getPendingReviews();
    expect(await acknowledgeReview(event.client_event_id, B, 'new')).toBe(false);
    expect(await acknowledgeReview(event.client_event_id, A, 'old')).toBe(false);
    await finishReview(original, A, 'old', 'permanent', 'late error');
    await renewReviewLease(event.client_event_id, A, 'old');
    expect(await getPendingReviews()).toEqual(live);
    expect(await acknowledgeReview(event.client_event_id, A, 'new')).toBe(true);
  });

  it('increments only a new syncing transition, not reads, failure recording or repeated syncing', async () => {
    await enqueuePendingReview(event, A);
    await getPendingReviews(); await getPendingReviews();
    expect((await getPendingReviews())[0].attempt_count).toBe(0);
    await markReviewStatus(event.client_event_id, 'syncing', undefined, A);
    await markReviewStatus(event.client_event_id, 'syncing', undefined, A);
    await markReviewStatus(event.client_event_id, 'failed', 'Invalid', A);
    expect((await getPendingReviews())[0]).toMatchObject({ attempt_count: 1, payload: event });
  });

  it('retries after persisted backoff with identical facts and removes only a matching acknowledgement', async () => {
    await enqueuePendingReview(event, A);
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await drainReviewQueue();
    const retained = (await getPendingReviews())[0];
    expect(retained.next_retry_at).toBeGreaterThan(Date.now());
    sqlite.exec('UPDATE pending_review_events SET next_retry_at = 0');
    global.fetch = jest.fn().mockResolvedValue(accepted(event.client_event_id));
    expect((await drainReviewQueue()).syncedCount).toBe(1);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).events).toEqual([event]);
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it('persists an interrupted claim across a real file close/reopen and safely replays its original bytes', async () => {
    // This proves SQLite file persistence; it does not simulate native Expo termination.
    const file = join(tmpdir(), `fluentt-d3-${randomUUID()}.sqlite`);
    sqlite.close();
    sqlite = new DatabaseSync(file);
    try {
      await runMigrations({ ...await storage.getDatabase() });
      await enqueuePendingReview(event, A);
      const item = (await getPendingReviews())[0];
      await claimReview(item, A, 'interrupted', Date.now() - SYNC_LEASE_MS);
      const payloadBytes = sqlite.prepare('SELECT payload_json FROM pending_review_events').get()?.payload_json;
      sqlite.close();
      sqlite = new DatabaseSync(file);
      expect((await getPendingReviews())[0]).toMatchObject({ status: 'syncing', lease_id: 'interrupted', owner_user_id: A });
      global.fetch = jest.fn().mockRejectedValue(new Error('Transport retry'));
      await drainReviewQueue();
      expect((await getPendingReviews())[0]).toMatchObject({ status: 'pending', payload: event, attempt_count: 2 });
      expect(sqlite.prepare('SELECT payload_json FROM pending_review_events').get()?.payload_json).toBe(payloadBytes);
    } finally {
      sqlite.close();
      unlinkSync(file);
      sqlite = new DatabaseSync(':memory:');
    }
  });

  it('releases single-flight after a timed-out request even if the transport ignores cancellation', async () => {
    await enqueuePendingReview(event, A);
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn(() => new Promise(() => {})) as any;
      const drain = drainReviewQueue();
      await jest.advanceTimersByTimeAsync(30_000);
      expect(await drain).toMatchObject({ error: 'Synchronization request timed out.' });
      expect((await getPendingReviews())[0]).toMatchObject({ status: 'pending', attempt_count: 1, payload: event });
      expect((await drainReviewQueue()).skipped).not.toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
