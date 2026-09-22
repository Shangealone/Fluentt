import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SyncStatusScreen from '../../../app/(app)/sync-status';
import { resetDatabaseForTesting } from '../db';
import { enqueuePendingReview } from '../reviewQueue';
import { setSyncOnlineStatus } from '../syncWorker';
import { setInterfaceLanguage } from '../../i18n';

// @ts-ignore
global.IS_REACT_ACT_ENVIRONMENT = true;

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock tokenStore
jest.mock('../../auth/tokenStore', () => ({
  loadTokens: jest.fn().mockResolvedValue({ accessToken: 'valid-token', refreshToken: 'valid-refresh' }),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));

describe('SyncStatusScreen', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    setSyncOnlineStatus(true);
    await resetDatabaseForTesting();
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders all-synced state when queue is empty', async () => {
    const rendered = await render(<SyncStatusScreen />);

    expect(rendered.getByTestId('connection-status-badge')).toBeTruthy();
    expect(rendered.getByTestId('pending-count-badge').props.children).toBe(0);
    expect(rendered.getByTestId('all-synced-banner')).toBeTruthy();
  });

  it('renders pending count and triggers syncNow when pressed', async () => {
    await enqueuePendingReview({
      client_event_id: '11111111-1111-4111-8111-111111111111',
      session_id: 'sess-1',
      vocabulary_item_id: 'vocab-1',
      response_time_ms: 1000,
      performance_rating: 'good',
    });

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

    const rendered = await render(<SyncStatusScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('pending-count-badge').props.children).toBe(1);
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('sync-now-btn'));
    });

    await waitFor(() => {
      expect(rendered.getByTestId('pending-count-badge').props.children).toBe(0);
    });
  });
});
