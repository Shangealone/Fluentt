import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SyncStatusScreen from '../../../app/(app)/sync-status';
import { resetDatabaseForTesting } from '../db';
import { enqueuePendingReview } from '../reviewQueue';
import { setSyncOnlineStatus, setServerReachability } from '../syncWorker';
import { setInterfaceLanguage } from '../../i18n';

// @ts-ignore
global.IS_REACT_ACT_ENVIRONMENT = true;

let mockFocusCallback: (() => void) | null = null;
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useRouter: () => ({
      back: mockBack,
    }),
    useFocusEffect: (cb: any) => {
      mockFocusCallback = cb;
      React.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

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
    setServerReachability(true);
    await resetDatabaseForTesting();
    await act(async () => {
      await setInterfaceLanguage('en');
    });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders all-synced state when queue is empty and server is reachable', async () => {
    const rendered = await render(<SyncStatusScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('connection-status-badge')).toBeTruthy();
    });

    expect(rendered.getByText('Online — Connected to server')).toBeTruthy();
    expect(rendered.getByTestId('pending-count-badge').props.children).toBe(0);
    expect(rendered.getByTestId('all-synced-banner')).toBeTruthy();
  });

  it('displays Network connected — Server unreachable when FastAPI is unreachable', async () => {
    // NetInfo says device is connected, but FastAPI is down (e.g. ECONNREFUSED)
    setSyncOnlineStatus(true);
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.reject(new TypeError('Network request failed'));
      }
      return Promise.reject(new Error('Unknown: ' + url));
    });

    const rendered = await render(<SyncStatusScreen />);

    await waitFor(() => {
      expect(rendered.getByText('Network connected — Server unreachable')).toBeTruthy();
    });

    // Sync Now button must be disabled when server is unreachable
    const syncBtn = rendered.getByTestId('sync-now-btn');
    expect(syncBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('displays Offline — No network connection when NetInfo is offline', async () => {
    setSyncOnlineStatus(false);

    const rendered = await render(<SyncStatusScreen />);

    await waitFor(() => {
      expect(rendered.getByText('Offline — No network connection')).toBeTruthy();
    });

    const syncBtn = rendered.getByTestId('sync-now-btn');
    expect(syncBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('renders pending count and triggers syncNow when pressed', async () => {
    await enqueuePendingReview({
      client_event_id: '11111111-1111-4111-8111-111111111111',
      session_id: 'sess-1',
      vocabulary_item_id: 'vocab-1',
      response_time_ms: 1000,
      correct: true,
      submitted_answer: 'correct',
    });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        });
      }
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

  it('refreshes pending count and server reachability when screen receives focus', async () => {
    const rendered = await render(<SyncStatusScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('pending-count-badge').props.children).toBe(0);
    });

    // Simulate an offline review being saved while this screen was backgrounded
    await enqueuePendingReview({
      client_event_id: '22222222-2222-4222-8222-222222222222',
      session_id: 'sess-2',
      vocabulary_item_id: 'vocab-2',
      response_time_ms: 800,
      correct: true,
      submitted_answer: 'correct',
    });

    // Simulate returning to the screen (focus event)
    expect(mockFocusCallback).not.toBeNull();
    await act(async () => {
      if (mockFocusCallback) {
        mockFocusCallback();
      }
    });

    await waitFor(() => {
      expect(rendered.getByTestId('pending-count-badge').props.children).toBe(1);
    });
  });
});
