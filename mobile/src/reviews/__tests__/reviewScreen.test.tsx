import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ReviewScreen from '../../../app/(app)/review/[lessonId]';
import { createTestClock } from '../clock';
import { resetDatabaseForTesting } from '../../offline/db';
import { getPendingReviews } from '../../offline/reviewQueue';
import { setInterfaceLanguage } from '../../i18n';
import { loadAuthenticatedAccount } from '../../auth/tokenStore';
import * as queue from '../../offline/reviewQueue';

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
    id: 'lesson-uuid-1',
    language_code: 'en',
    title: 'Reviewable Lesson',
    description: 'Lesson description',
    content_version: 'v0.1',
    sort_order: 1,
    vocabulary_items: [
      {
        id: 'vocab-1',
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
      return { ok: true, status: 200, json: async () => url.includes('/reviews/sessions') ? { id: 'session-uuid-1' } : mockLessonResponse };
    }) as any;
    jest.spyOn(queue, 'enqueuePendingReview').mockRejectedValueOnce(new Error('Disk unavailable'));
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-again-btn')); });
    expect(rendered.getByTestId('unsaved-review-error')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(await getPendingReviews()).toHaveLength(0);
    await act(async () => { fireEvent.press(rendered.getByTestId('retry-save-btn')); });
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual(submitted[0]);
    expect((await getPendingReviews())[0].client_event_id).toBe(submitted[0].client_event_id);
    expect(mockReplace).toHaveBeenCalled();
  });

  it('does not create or queue an answer when the displayed account is no longer authenticated', async () => {
    global.fetch = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => url.includes('/reviews/sessions') ? { id: 'session-uuid-1' } : mockLessonResponse,
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
    global.fetch = jest.fn().mockImplementation((url: string) => {
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
          json: async () => ({
            id: 'session-uuid-1',
            user_id: 'test-user-id',
            client_session_id: 'client-sess-1',
            lesson_id: 'lesson-uuid-1',
            started_at: new Date().toISOString(),
            ended_at: null,
          }),
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
    global.fetch = jest.fn().mockImplementation((url: string) => {
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
          json: async () => ({
            id: 'session-uuid-1',
            user_id: 'test-user-id',
            client_session_id: 'client-sess-1',
            lesson_id: 'lesson-uuid-1',
            started_at: new Date().toISOString(),
            ended_at: null,
          }),
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
          json: async () => ({
            id: 'session-uuid-1',
            user_id: 'test-user-id',
            client_session_id: 'client-sess-1',
            lesson_id: 'lesson-uuid-1',
            started_at: new Date().toISOString(),
            ended_at: null,
          }),
        });
      }
      if (url.includes('/reviews/attempts')) {
        attemptBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            attempt_id: 'attempt-uuid-1',
            client_event_id: attemptBody.client_event_id,
            session_id: attemptBody.session_id,
            vocabulary_item_id: attemptBody.vocabulary_item_id,
            response_time_ms: attemptBody.response_time_ms,
            correct: attemptBody.correct,
            submitted_answer: attemptBody.submitted_answer,
            created_at: new Date().toISOString(),
            schedule: {
              vocabulary_item_id: attemptBody.vocabulary_item_id,
              interval_minutes: 1440,
              due_date: new Date().toISOString(),
              repetition_number: 1,
              scheduler_type: 'development',
              algorithm_version: 'dev-0.1',
            },
          }),
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
  });

  it('enqueues review to SQLite pending queue when network is offline', async () => {
    const testClock = createTestClock([500, 500, 1800]); // 1300 ms elapsed

    global.fetch = jest.fn().mockImplementation((url: string) => {
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

    global.fetch = jest.fn().mockImplementation((url: string) => {
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
    expect(pending[0].payload.session_id).toBeDefined();
    expect((pending[0].payload as any).password).toBeUndefined();
    expect((pending[0].payload as any).access_token).toBeUndefined();
  });
});
