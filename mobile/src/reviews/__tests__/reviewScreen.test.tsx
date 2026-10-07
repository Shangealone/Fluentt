import { reviewWire } from '../../testUtils/contracts';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ReviewScreen from '../../../app/(app)/review/[lessonId]';
import { createTestClock } from '../clock';
import { resetDatabaseForTesting } from '../../offline/db';
import { getPendingReviews } from '../../offline/reviewQueue';
import { setInterfaceLanguage } from '../../i18n';
import { loadAuthenticatedAccount } from '../../auth/tokenStore';
import * as queue from '../../offline/reviewQueue';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

jest.mock('expo-constants', () => {
  const configuration = require('../../../app.json');
  return { __esModule: true, default: { expoConfig: { ...configuration.expo } } };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = { lessonId: 'lesson-uuid-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => mockParams,
}));

// Mock useAuth
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      targetLearningLanguage: 'en',
      interfaceLanguage: 'en',
    },
  }),
}));

// Mock tokenStore
jest.mock('../../auth/tokenStore', () => ({
  loadTokens: jest.fn().mockResolvedValue({ accessToken: 'fake-token', refreshToken: 'fake-refresh' }),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  clearTokensIfCurrent: jest.fn().mockResolvedValue(true),
  rotateTokens: jest.fn().mockResolvedValue(true),
  sameTokens: (a: any, b: any) => Boolean(a && b && a.accessToken === b.accessToken && a.refreshToken === b.refreshToken),
  loadAuthenticatedAccount: jest.fn().mockResolvedValue({ userId: 'test-user-id', tokens: { accessToken: 'fake-token', refreshToken: 'fake-refresh' }, generation: 0 }),
  isAccountCurrent: () => true,
}));

// @ts-ignore
global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Vocabulary Review Flow', () => {
  let originalFetch: typeof global.fetch;

  const mockLessonResponse = {
    content_release_id: '88888888-8888-4888-8888-888888888888',
    id: 'lesson-uuid-1',
    language_code: 'en',
              is_active: true,
    title: 'Reviewable Lesson',
    description: 'Lesson description',
    content_version: 'v0.1',
    sort_order: 1,
    vocabulary_items: [
      {
        id: 'vocab-1',
        content_revision_id: '77777777-7777-4777-8777-777777777777',
        content_release_id: '88888888-8888-4888-8888-888888888888',
        lesson_id: 'lesson-uuid-1',
        term: 'ephemeral',
        definition: 'lasting for a very short time',
        example_sentence: 'Fashions are ephemeral.',
        difficulty: 'advanced',
        category: 'adjective',
        translation: 'panandalian',
        content_version: 'v0.1',
        sort_order: 1,
        is_active: true,
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    mockParams = { lessonId: 'lesson-uuid-1' };
    await resetDatabaseForTesting();
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('shows an unsaved review when SQLite fails and retries the same UUID and original facts', async () => {
    const submitted: any[] = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/reviews/attempts')) {
        submitted.push(JSON.parse(options.body));
        throw new Error('Lost acknowledgement');
      }
      return { ok: true, status: 200, json: async () => url.includes('/reviews/sessions') ? { id: 'session-uuid-1', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : mockLessonResponse };
    }) as any;
    jest.spyOn(queue, 'enqueuePendingReview').mockRejectedValueOnce(new Error('Disk unavailable'));
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-again-btn')); });
    expect(rendered.getByTestId('unsaved-review-error')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(await getPendingReviews()).toHaveLength(0);
    jest.replaceProperty(Constants.expoConfig!, 'version', '2.0.0');
    await act(async () => { fireEvent.press(rendered.getByTestId('retry-save-btn')); });
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual(submitted[0]);
    expect(submitted[1].application_version).toBe('1.0.0');
    expect((await getPendingReviews())[0].client_event_id).toBe(submitted[0].client_event_id);
    expect(mockReplace).toHaveBeenCalled();
  });

  it('captures interaction time before delayed account verification and preserves it in the online and queued payloads', async () => {
    let online: any;
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/reviews/attempts')) {
        online = JSON.parse(options.body);
        throw new Error('Acknowledgement lost');
      }
      return { ok: true, status: 200, json: async () => url.includes('/reviews/sessions')
        ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : mockLessonResponse };
    }) as any;
    const rendered = await render(<ReviewScreen customClock={createTestClock([100, 100, 1500])} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T11:22:33.456Z'));
    try {
      jest.mocked(loadAuthenticatedAccount).mockImplementationOnce(async () => {
        await Promise.resolve();
        jest.setSystemTime(new Date('2025-01-01T12:22:33.456Z'));
        return { userId: 'test-user-id', tokens: { accessToken: 'fake-token', refreshToken: 'fake-refresh' }, generation: 0 };
      });
      await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
      await act(async () => { fireEvent.press(rendered.getByTestId('rating-again-btn')); });
      expect(online.client_interaction_at).toBe('2025-01-01T11:22:33.456Z');
      expect(online.response_time_ms).toBe(1400);
      const retained = (await getPendingReviews())[0];
      expect(retained.payload).toEqual(online);
      expect(retained.created_at).toBe('2025-01-01T12:22:33.456Z');
      expect(retained.payload.created_at).toBeUndefined();
    } finally { jest.useRealTimers(); }
  });

  it('keeps one original client session across offline load retry and multiple cards', async () => {
    const sessions: string[] = [];
    let contentCalls = 0;
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/reviews/sessions')) {
        sessions.push(JSON.parse(options.body).client_session_id);
        throw new TypeError('Offline');
      }
      if (url.includes('/content/lessons')) {
        if (++contentCalls === 1) throw new TypeError('Content unavailable');
        return { ok: true, status: 200, json: async () => ({ ...mockLessonResponse,
          vocabulary_items: [...mockLessonResponse.vocabulary_items,
            { ...mockLessonResponse.vocabulary_items[0], id: 'vocab-2' }] }) };
      }
      throw new TypeError('Offline');
    }) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('retry-btn')).toBeTruthy());
    await act(async () => { fireEvent.press(rendered.getByTestId('retry-btn')); });
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    for (let i = 0; i < 2; i++) {
      await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
      await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    }
    expect(sessions).toHaveLength(2);
    expect(sessions[1]).toBe(sessions[0]);
    const retained = await getPendingReviews();
    expect(retained).toHaveLength(2);
    expect(retained[0].payload.client_event_id).not.toBe(retained[1].payload.client_event_id);
    for (const row of retained) {
      expect(row.payload.client_session_id).toBe(sessions[0]);
      expect(row.payload.session_id).toBeUndefined();
    }
  });

  it('shows an explicit save failure and sends no answer when app version is unavailable', async () => {
    global.fetch = jest.fn(async (url: string, options: any) => ({ ok: true, status: 200,
      json: async () => url.includes('/reviews/sessions') ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : mockLessonResponse })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    jest.replaceProperty(Constants.expoConfig!, 'version', undefined);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect(rendered.getByTestId('error-container')).toBeTruthy();
    expect(await getPendingReviews()).toHaveLength(0);
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url.includes('/reviews/attempts'))).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each(['content_revision_id', 'content_release_id'])('blocks unversioned content without guessing %s', async (missing) => {
    const legacy = JSON.parse(JSON.stringify(mockLessonResponse));
    delete legacy.vocabulary_items[0][missing];
    global.fetch = jest.fn(async (url: string, options: any) => ({ ok: true, status: 200,
      json: async () => url.includes('/reviews/sessions') ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : legacy })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('error-container')).toBeTruthy());
    expect(rendered.queryByTestId('card-term')).toBeNull();
    expect(await getPendingReviews()).toHaveLength(0);
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url.includes('/reviews/attempts'))).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not create or queue an answer when the displayed account is no longer authenticated', async () => {
    global.fetch = jest.fn(async (url: string, options: any) => ({
      ok: true,
      status: 200,
      json: async () => url.includes('/reviews/sessions') ? { id: 'session-uuid-1', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : mockLessonResponse,
    })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    jest.mocked(loadAuthenticatedAccount).mockResolvedValueOnce(null);
    await act(async () => {
      fireEvent.press(rendered.getByTestId('reveal-answer-btn'));
    });
    await act(async () => {
      fireEvent.press(rendered.getByTestId('rating-again-btn'));
    });
    expect(await getPendingReviews()).toHaveLength(0);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders flashcard with term, progress, and reveal button', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/content/lessons/lesson-uuid-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockLessonResponse,
        });
      }
      if (url.includes('/reviews/sessions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 'session-uuid-1', client_session_id: JSON.parse(opts.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const rendered = await render(<ReviewScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('card-term')).toBeTruthy();
    });

    expect(rendered.getByText('ephemeral')).toBeTruthy();
    expect(rendered.getByText(/Card 1 of 1/i)).toBeTruthy();
    expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    // Definition not revealed yet
    expect(rendered.queryByTestId('card-definition')).toBeNull();
  });

  it('reveals definition and rating buttons when reveal clicked', async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/content/lessons/lesson-uuid-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockLessonResponse,
        });
      }
      if (url.includes('/reviews/sessions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 'session-uuid-1', client_session_id: JSON.parse(opts.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const rendered = await render(<ReviewScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('reveal-answer-btn'));
    });

    await waitFor(() => {
      expect(rendered.getByTestId('card-definition')).toBeTruthy();
    });

    expect(rendered.getByText('lasting for a very short time')).toBeTruthy();
    expect(rendered.getByTestId('rating-again-btn')).toBeTruthy();
    expect(rendered.getByTestId('rating-good-btn')).toBeTruthy();
  });

  it('submits review interaction online and records measured monotonic response time', async () => {
    const testClock = createTestClock([1000, 1000, 3250]); // 2250 ms elapsed
    let attemptBody: any = null;
    let originalClientSession: string | undefined;
    jest.replaceProperty(Platform, 'OS', 'ios');

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/content/lessons/lesson-uuid-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockLessonResponse,
        });
      }
      if (url.includes('/reviews/sessions')) {
        originalClientSession = JSON.parse(opts.body).client_session_id;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 'session-uuid-1', client_session_id: JSON.parse(opts.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }),
        });
      }
      if (url.includes('/reviews/attempts')) {
        attemptBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...reviewWire(attemptBody.client_event_id), session_id: attemptBody.session_id, vocabulary_item_id: attemptBody.vocabulary_item_id, correct: attemptBody.correct, response_time_ms: attemptBody.response_time_ms, next_interval_seconds: 86400, next_due_at: '2099-01-01T00:00:00Z' }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const rendered = await render(<ReviewScreen customClock={testClock} />);

    await waitFor(() => {
      expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('reveal-answer-btn'));
    });

    await waitFor(() => {
      expect(rendered.getByTestId('rating-good-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('rating-good-btn'));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(app)/review/result',
          params: expect.objectContaining({
            totalCount: '1',
            syncedCount: '1',
            queuedCount: '0',
          }),
        })
      );
    });

    expect(attemptBody).not.toBeNull();
    expect(attemptBody.response_time_ms).toBe(2250);
    expect(attemptBody.correct).toBe(true);
    expect(attemptBody.submitted_answer).toBe('correct');
    expect(attemptBody.client_event_id).toBeDefined();
    expect(attemptBody.client_session_id).toBe(originalClientSession);
    expect(attemptBody.session_id).toBe('session-uuid-1');
    expect(attemptBody.client_session_id).not.toBe(attemptBody.session_id);
    expect(attemptBody.device_platform).toBe('ios');
    expect(attemptBody.application_version).toBe(Constants.expoConfig?.version);
  });

  it('enqueues review to SQLite pending queue when network is offline', async () => {
    const testClock = createTestClock([500, 500, 1800]); // 1300 ms elapsed

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/content/lessons/lesson-uuid-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockLessonResponse,
        });
      }
      // Review session or attempt fails (network offline)
      return Promise.reject(new Error('Network offline'));
    });

    const rendered = await render(<ReviewScreen customClock={testClock} />);

    await waitFor(() => {
      expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('reveal-answer-btn'));
    });

    await waitFor(() => {
      expect(rendered.getByTestId('rating-again-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('rating-again-btn'));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(app)/review/result',
          params: expect.objectContaining({
            totalCount: '1',
            syncedCount: '0',
            queuedCount: '1',
          }),
        })
      );
    });

    // Check that item is in SQLite pending queue
    const pending = await getPendingReviews();
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.response_time_ms).toBe(1300);
    expect(pending[0].owner_user_id).toBe('test-user-id');
    expect(pending[0].payload.correct).toBe(false);
    expect(pending[0].payload.submitted_answer).toBe('incorrect');
    expect(pending[0].status).toBe('pending');
  });

  it('reproduces exact offline network failure (TypeError: Network request failed) and creates exactly one SQLite pending event', async () => {
    const testClock = createTestClock([100, 100, 1500]); // 1400 ms elapsed

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/content/lessons/lesson-uuid-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockLessonResponse,
        });
      }
      // Exact React Native fetch failure when TCP connection refused on stopped FastAPI
      return Promise.reject(new TypeError('Network request failed'));
    });

    const rendered = await render(<ReviewScreen customClock={testClock} />);

    await waitFor(() => {
      expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('reveal-answer-btn'));
    });

    await waitFor(() => {
      expect(rendered.getByTestId('rating-again-btn')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(rendered.getByTestId('rating-again-btn'));
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(app)/review/result',
          params: expect.objectContaining({
            totalCount: '1',
            syncedCount: '0',
            queuedCount: '1',
          }),
        })
      );
    });

    const pending = await getPendingReviews();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].payload.vocabulary_item_id).toBe('vocab-1');
    expect(pending[0].payload.correct).toBe(false);
    expect(pending[0].payload.submitted_answer).toBe('incorrect');
    expect(pending[0].payload.response_time_ms).toBe(1400);
    expect(pending[0].payload.client_event_id).toBeDefined();
    expect(pending[0].payload.session_id).toBeUndefined();
    expect(pending[0].payload.client_session_id).toBeDefined();
    expect((pending[0].payload as any).password).toBeUndefined();
    expect((pending[0].payload as any).access_token).toBeUndefined();
  });
});
