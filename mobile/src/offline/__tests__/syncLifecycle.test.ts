import { startSyncLifecycle, SyncLifecycleSources } from '../syncLifecycle';
import { enqueuePendingReview, getPendingReviews } from '../reviewQueue';
import { resetDatabaseForTesting } from '../db';
import { apiClient } from '../../api/client';
import { clearTokens, saveTokens } from '../../auth/tokenStore';
import { drainReviewQueue, setSyncOnlineStatus } from '../syncWorker';

jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));
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
  session_id: 'session',
  vocabulary_item_id: 'vocab', response_time_ms: 1000, correct: true };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data });
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve)); };

describe('D3 foreground lifecycle', () => {
  let online: (value: boolean) => void;
  let active: (value: boolean) => void;
  let tick: () => void;
  let stop: (() => void) | undefined;
  let sources: SyncLifecycleSources;
  let reachable: boolean;
  let status: number;
  let sent: { owner: string; event: any }[];
  const originalFetch = global.fetch;
  async function login(owner: string, verify = true) {
    await saveTokens({ accessToken: owner, refreshToken: `refresh-${owner}` });
    if (verify) await apiClient('/users/me');
  }
  beforeEach(async () => {
    await clearTokens();
    await resetDatabaseForTesting();
    setSyncOnlineStatus(true);
    reachable = true; status = 200; sent = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.endsWith('/users/me')) return response({ user_id: options.headers.Authorization.slice(7) });
      if (url.endsWith('/health')) return response({}, reachable ? 200 : 503);
      const item = JSON.parse(options.body).events[0];
      sent.push({ owner: options.headers.Authorization.slice(7), event: item });
      return status === 200 ? response({ results: [{ client_event_id: item.client_event_id, status: 'accepted' }] })
        : response({ detail: 'Reauthenticate' }, status);
    }) as any;
    sources = {
      isActive: () => true,
      subscribeActive: (listener) => { active = listener; return jest.fn(); },
      subscribeOnline: (listener) => { online = listener; return jest.fn(); },
      every: (listener) => { tick = listener; return jest.fn(); },
    };
  });
  afterEach(() => { stop?.(); stop = undefined; global.fetch = originalFetch; });

  it('waits for verification after login and drains only the verified owner on startup/login', async () => {
    await enqueuePendingReview(event, A);
    await enqueuePendingReview({ ...event, client_event_id: 'B-event' }, B);
    stop = startSyncLifecycle(sources);
    await login(B, false);
    await flush();
    expect(sent).toEqual([]);
    await apiClient('/users/me');
    await flush();
    expect(sent.map((entry) => entry.owner)).toEqual([B]);
    expect((await getPendingReviews())[0]).toMatchObject({ owner_user_id: A });
    stop();
    await login(A);
    stop = startSyncLifecycle(sources);
    await flush();
    expect(sent.map((entry) => entry.owner)).toEqual([B, A]);
  });

  it('drains on foreground, reconnect and backend recovery while preserving manual single-flight behavior', async () => {
    await login(A);
    stop = startSyncLifecycle(sources);
    await flush();
    active(false);
    await enqueuePendingReview(event, A);
    tick(); await flush();
    expect(sent).toEqual([]);
    active(true); await flush();
    expect(sent).toHaveLength(1);
    online(false);
    await enqueuePendingReview({ ...event, client_event_id: 'reconnect' }, A);
    online(true); await flush();
    expect(sent).toHaveLength(2);
    reachable = false;
    await enqueuePendingReview({ ...event, client_event_id: 'recovery' }, A);
    tick(); await flush();
    expect(sent).toHaveLength(2);
    reachable = true;
    tick(); await flush();
    expect(sent).toHaveLength(3);
    await enqueuePendingReview({ ...event, client_event_id: 'manual' }, A);
    await Promise.all([drainReviewQueue(), Promise.resolve(active(true))]);
    await flush();
    expect(sent).toHaveLength(4);
  });

  it('keeps auth-paused work blocked across resume/reconnect/ticks and resumes after verified reauthentication', async () => {
    await login(A);
    await enqueuePendingReview(event, A);
    status = 403;
    stop = startSyncLifecycle(sources);
    await flush();
    expect(sent).toHaveLength(1);
    active(true); online(true); tick(); await flush();
    expect(sent).toHaveLength(1);
    status = 200;
    await login(A);
    await flush();
    expect(sent).toHaveLength(2);
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it('abandons an old-owner health probe after an account switch and never submits A as B', async () => {
    await login(A);
    await enqueuePendingReview(event, A);
    let release!: (value: any) => void;
    const ordinaryFetch = global.fetch;
    global.fetch = jest.fn((url: string, options: any) => url.endsWith('/health')
      ? new Promise((resolve) => { release = resolve; }) : ordinaryFetch(url, options)) as any;
    stop = startSyncLifecycle(sources);
    await flush();
    await login(B);
    global.fetch = ordinaryFetch;
    release(response({}));
    await flush();
    expect(sent).toEqual([]);
    expect((await getPendingReviews())[0]).toMatchObject({ owner_user_id: A, status: 'pending' });
  });
});
