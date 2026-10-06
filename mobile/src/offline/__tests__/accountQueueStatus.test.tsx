import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import SyncStatusScreen from '../../../app/(app)/sync-status';
import { apiClient } from '../../api/client';
import { setInterfaceLanguage } from '../../i18n';
import { clearTokens, saveTokens } from '../../auth/tokenStore';
import * as database from '../db';
import {
  deletePendingReview, enqueuePendingReview, getPendingCount,
  getPendingReviews, getTotalPendingCount, markReviewStatus,
} from '../reviewQueue';
import { useSyncStatus } from '../useSyncStatus';
import { setServerReachability, setSyncOnlineStatus } from '../syncWorker';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: async (key: string, value: string) => { store.set(key, value); },
    getItemAsync: async (key: string) => store.get(key) ?? null,
    deleteItemAsync: async (key: string) => { store.delete(key); },
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: () => {},
}));

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
  response_time_ms: 1000, correct: true,
};
const second = { ...event, client_event_id: '44444444-4444-4444-8444-444444444444' };
const legacy = { ...event, client_event_id: '55555555-5555-4555-8555-555555555555' };

async function login(account: string) {
  await saveTokens({ accessToken: `access-${account}`, refreshToken: `refresh-${account}` });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'profile', user_id: account }) });
  await apiClient('/users/me');
}

async function insertLegacy() {
  await (await database.getDatabase()).runAsync(`INSERT INTO pending_review_events
    (client_event_id, payload_json, status, attempt_count, last_error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [legacy.client_event_id, JSON.stringify(legacy), 'pending', 0, null, '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z']);
}

describe('D2 participant queue status', () => {
  const originalFetch = global.fetch;
  beforeEach(async () => {
    await clearTokens();
    await database.resetDatabaseForTesting();
    setSyncOnlineStatus(true);
    setServerReachability(true);
    await login(A);
    await setInterfaceLanguage('en');
  });
  afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; });

  it('counts only the verified current account through A/B switching, preserving hidden rows', async () => {
    await enqueuePendingReview(event, A);
    await insertLegacy();
    expect(await getPendingCount()).toBe(1);
    await login(B);
    expect(await getPendingCount()).toBe(0);
    await enqueuePendingReview(second, B);
    expect(await getPendingCount()).toBe(1);
    await login(A);
    expect(await getPendingCount()).toBe(1);
    await markReviewStatus(event.client_event_id, 'failed', 'timeout', A);
    expect(await getPendingCount()).toBe(1);
    await markReviewStatus(event.client_event_id, 'syncing', undefined, A);
    expect(await getPendingCount()).toBe(1);
    await clearTokens();
    expect(await getPendingCount()).toBe(0);
    await saveTokens({ accessToken: 'unverified', refreshToken: 'unverified-refresh' });
    expect(await getPendingCount()).toBe(0);
    expect(await getTotalPendingCount()).toBe(3);
    expect((await getPendingReviews()).map((row) => row.owner_user_id)).toEqual([null, A, B]);
  });

  it('refreshes an already-mounted hook when the verified account changes', async () => {
    await enqueuePendingReview(event, A);
    await insertLegacy();
    const { result } = await renderHook(() => useSyncStatus());
    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    await act(async () => { await login(B); });
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    await act(async () => { await enqueuePendingReview(second, B); });
    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    await act(async () => { await login(A); });
    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    await act(async () => { await clearTokens(); });
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(await getTotalPendingCount()).toBe(3);
  });

  it('shows B zero pending with A and legacy rows preserved, and disables sync when unverified', async () => {
    await enqueuePendingReview(event, A);
    await insertLegacy();
    const screen = await render(<SyncStatusScreen />);
    await waitFor(() => expect(screen.getByTestId('pending-count-badge').props.children).toBe(1));
    await act(async () => { await login(B); });
    await waitFor(() => expect(screen.getByTestId('pending-count-badge').props.children).toBe(0));
    await act(async () => { await enqueuePendingReview(second, B); });
    await waitFor(() => expect(screen.getByTestId('pending-count-badge').props.children).toBe(1));
    await act(async () => { await clearTokens(); });
    expect(screen.getByTestId('pending-count-badge').props.children).toBe(0);
    expect(screen.getByTestId('sync-now-btn').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId('all-synced-banner')).toBeNull();
    expect(await getTotalPendingCount()).toBe(3);
  });

  it('does not expose a stale count after account switching during the SQLite read', async () => {
    await enqueuePendingReview(event, A);
    const db = await database.getDatabase();
    const original = db.getFirstAsync.bind(db);
    jest.spyOn(db, 'getFirstAsync').mockImplementationOnce(async (sql, ...params) => {
      const row = await original(sql, ...params);
      await login(B);
      return row;
    });
    expect(await getPendingCount()).toBe(0);
    expect(await getTotalPendingCount()).toBe(1);
  });

  it.each(['pending', 'syncing', 'failed'] as const)('does not change any row field when marking %s with the wrong owner', async (status) => {
    await enqueuePendingReview(event, A);
    const before = await getPendingReviews();
    await markReviewStatus(event.client_event_id, status, 'wrong-owner', B);
    expect(await getPendingReviews()).toEqual(before);
  });

  it('cannot delete another owner or mutate legacy rows', async () => {
    await enqueuePendingReview(event, A);
    await insertLegacy();
    const before = await getPendingReviews();
    await deletePendingReview(event.client_event_id, B);
    await markReviewStatus(legacy.client_event_id, 'failed', undefined, A);
    await deletePendingReview(legacy.client_event_id, A);
    expect(await getPendingReviews()).toEqual(before);
  });

  it.each([undefined, null, ''])('rejects missing/empty mutation owner %s instead of falling back to device-wide SQL', async (owner) => {
    await enqueuePendingReview(event, A);
    const before = await getPendingReviews();
    await expect(markReviewStatus(event.client_event_id, 'failed', undefined, owner as any)).rejects.toThrow();
    await expect(deletePendingReview(event.client_event_id, owner as any)).rejects.toThrow();
    expect(await getPendingReviews()).toEqual(before);
  });
});
