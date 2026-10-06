import { renderHook, act } from '@testing-library/react-native';
import { useSyncStatus } from '../useSyncStatus';
import { resetDatabaseForTesting } from '../db';
import { enqueuePendingReview } from '../reviewQueue';
import { setSyncOnlineStatus } from '../syncWorker';

// Mock tokenStore
jest.mock('../../auth/tokenStore', () => ({
  loadTokens: jest.fn().mockResolvedValue({ accessToken: 'test-token', refreshToken: 'test-refresh' }),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  clearTokensIfCurrent: jest.fn().mockResolvedValue(true),
  rotateTokens: jest.fn().mockResolvedValue(true),
  sameTokens: (a: any, b: any) => Boolean(a && b && a.accessToken === b.accessToken && a.refreshToken === b.refreshToken),
  loadAuthenticatedAccount: jest.fn().mockResolvedValue({ userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' }, generation: 0 }),
  isAccountCurrent: () => true,
  getVerifiedAccountId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  subscribeToAuthenticatedAccount: () => () => {},
}));

// @ts-ignore
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('useSyncStatus hook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setSyncOnlineStatus(true);
    await resetDatabaseForTesting();
  });

  it('provides pending count, online status, and syncNow execution', async () => {
    await enqueuePendingReview({
      client_event_id: '11111111-1111-4111-8111-111111111111',
      client_session_id: '99999999-9999-4999-8999-999999999999',
      client_interaction_at: '2025-01-01T11:22:33.456Z',
      device_platform: 'ios',
      application_version: '1.0.0',
      session_id: 'session-1',
      vocabulary_item_id: 'vocab-1',
      response_time_ms: 1000,
      correct: true,
      submitted_answer: 'correct',
    }, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/sync/review-events')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            processed_count: 1,
            results: [
              {
                client_event_id: '11111111-1111-4111-8111-111111111111',
                status: 'accepted',
                attempt_id: 'att-1',
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = await renderHook(() => useSyncStatus());

    await act(async () => {
      await result.current.refreshCount();
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.isOnline).toBe(true);

    // Run syncNow
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.isSyncing).toBe(false);
  });
});
