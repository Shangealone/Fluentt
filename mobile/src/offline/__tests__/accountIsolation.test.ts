import { apiClient, AuthenticationError } from '../../api/client';
import { saveTokens, clearTokens, loadTokens } from '../../auth/tokenStore';
import { closeDatabaseForTesting, getDatabase, resetDatabaseForTesting } from '../db';
import { enqueuePendingReview, getPendingReviews } from '../reviewQueue';
import { drainReviewQueue, setSyncOnlineStatus } from '../syncWorker';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: async (key: string, value: string) => { store.set(key, value); },
    getItemAsync: async (key: string) => store.get(key) ?? null,
    deleteItemAsync: async (key: string) => { store.delete(key); },
  };
});

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const event = {
  client_event_id: '11111111-1111-4111-8111-111111111111',
  session_id: '22222222-2222-4222-8222-222222222222',
  vocabulary_item_id: '33333333-3333-4333-8333-333333333333',
  response_time_ms: 1000, correct: true, created_at: '2026-10-06T00:00:00Z',
};
const second = { ...event, client_event_id: '44444444-4444-4444-8444-444444444444' };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data });

// Exercise the real auth client and queue; replace only network/native SecureStore.
async function login(account: string) {
  await saveTokens({ accessToken: `access-${account}`, refreshToken: `refresh-${account}` });
  global.fetch = jest.fn().mockResolvedValue(response({ id: 'profile-id', user_id: account }));
  await apiClient('/users/me');
}

describe('D2 account isolation', () => {
  const originalFetch = global.fetch;
  beforeEach(async () => {
    await clearTokens();
    await resetDatabaseForTesting();
    setSyncOnlineStatus(true);
    await login(A);
  });
  afterEach(() => { global.fetch = originalFetch; });

  it('captures the creator, preserves UUID idempotency and never reassigns a duplicate', async () => {
    await enqueuePendingReview(event, A);
    await enqueuePendingReview(event, B);
    const rows = await getPendingReviews();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ owner_user_id: A, payload: event });
  });

  it('preserves A through logout and B login, syncs B alone, then syncs A after switching back', async () => {
    await enqueuePendingReview(event, A);
    await clearTokens();
    global.fetch = jest.fn();
    expect((await drainReviewQueue()).authPaused).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect((await getPendingReviews())[0]).toMatchObject({ owner_user_id: A });

    await login(B);
    await enqueuePendingReview(second, B);
    const sent: { token: string; ids: string[]; body: string }[] = [];
    global.fetch = jest.fn(async (_url: string, options: any) => {
      const events = JSON.parse(options.body).events;
      sent.push({ token: options.headers.Authorization, ids: events.map((e: any) => e.client_event_id), body: options.body });
      return response({ results: events.map((e: any) => ({ client_event_id: e.client_event_id, status: 'accepted' })) });
    }) as any;
    expect((await drainReviewQueue()).syncedCount).toBe(1);
    expect(sent[0].ids).toEqual([second.client_event_id]);
    expect(sent[0].token).toBe(`Bearer access-${B}`);
    expect(sent[0].body).not.toContain('owner_user_id');
    expect((await getPendingReviews())[0]).toMatchObject({ owner_user_id: A, client_event_id: event.client_event_id });

    await login(A);
    global.fetch = jest.fn().mockResolvedValue(response({ results: [{ client_event_id: event.client_event_id, status: 'accepted' }] }));
    expect((await drainReviewQueue()).syncedCount).toBe(1);
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it('blocks legacy ownerless rows and tokens that have not had account identity verified', async () => {
    const db = await getDatabase();
    await db.runAsync(`INSERT INTO pending_review_events
      (client_event_id, payload_json, status, attempt_count, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [event.client_event_id, JSON.stringify(event), 'pending', 0, null, event.created_at, event.created_at]);
    global.fetch = jest.fn();
    expect((await drainReviewQueue()).syncedCount).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
    expect((await getPendingReviews())[0]).toMatchObject({ owner_user_id: null });
    await saveTokens({ accessToken: `access-${B}`, refreshToken: `refresh-${B}` });
    expect((await drainReviewQueue()).authPaused).toBe(true);
  });

  it('keeps owner through payload serialization and in-memory reopen (not process termination)', async () => {
    const leakedPayload = { ...event, password: 'PASSWORD', access_token: 'ACCESS', refresh_token: 'REFRESH', jwt: 'JWT', email: 'private@example.test' };
    await enqueuePendingReview(leakedPayload, A);
    await closeDatabaseForTesting();
    const rows = await getPendingReviews();
    expect(rows[0]).toMatchObject({ owner_user_id: A, payload: event });
    const raw = await (await getDatabase()).getAllAsync('SELECT * FROM pending_review_events');
    for (const secret of ['PASSWORD', 'ACCESS', 'REFRESH', 'JWT', 'private@example.test']) {
      expect(JSON.stringify(raw)).not.toContain(secret);
    }
  });

  it('refuses an A request when B is current, before sending any payload', async () => {
    await login(B);
    global.fetch = jest.fn().mockResolvedValue(response({}));
    await expect(apiClient('/sync/review-events', { method: 'POST', body: JSON.stringify({ events: [event] }), expectedUserId: A }))
      .rejects.toBeInstanceOf(AuthenticationError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not refresh or retry A payload with B tokens after switching during the request', async () => {
    const sentTokens: string[] = [];
    global.fetch = jest.fn(async (_url: string, options: any) => {
      sentTokens.push(options.headers.Authorization);
      await login(B);
      return response({}, 401);
    }) as any;
    await expect(apiClient('/sync/review-events', { method: 'POST', body: JSON.stringify({ events: [event] }), expectedUserId: A }))
      .rejects.toBeInstanceOf(AuthenticationError);
    expect(sentTokens).toEqual([`Bearer access-${A}`]);
    expect((await loadTokens())?.accessToken).toBe(`access-${B}`);
  });

  it('keeps A ownership through a successful token rotation and sends the same event UUID', async () => {
    await enqueuePendingReview(event, A);
    const requests: { token: string; body: any }[] = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/auth/refresh')) {
        return response({ access_token: 'rotated-A', refresh_token: 'rotated-refresh-A' });
      }
      requests.push({ token: options.headers.Authorization, body: JSON.parse(options.body) });
      return requests.length === 1 ? response({}, 401) : response({
        results: [{ client_event_id: event.client_event_id, status: 'accepted' }],
      });
    }) as any;
    expect((await drainReviewQueue()).syncedCount).toBe(1);
    expect(requests.map((request) => request.token)).toEqual([`Bearer access-${A}`, 'Bearer rotated-A']);
    expect(requests.map((request) => request.body.events[0].client_event_id)).toEqual([event.client_event_id, event.client_event_id]);
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it('retains A and preserves the new B session if account switching happens during refresh', async () => {
    await enqueuePendingReview(event, A);
    const submitted: string[] = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/auth/refresh')) {
        await login(B);
        return response({ access_token: 'late-rotated-A', refresh_token: 'late-refresh-A' });
      }
      submitted.push(options.headers.Authorization);
      return response({}, 401);
    }) as any;
    expect((await drainReviewQueue()).authPaused).toBe(true);
    expect(submitted).toEqual([`Bearer access-${A}`]);
    expect((await loadTokens())?.accessToken).toBe(`access-${B}`);
    expect((await getPendingReviews())[0]).toMatchObject({ owner_user_id: A, status: 'pending' });
  });
});
