import { eligibilityWire, reviewWire } from '../../testUtils/contracts';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ReviewScreen from '../../../app/(app)/review/[lessonId]';
import { createTestClock } from '../clock';
import { resetDatabaseForTesting } from '../../offline/db';
import { getPendingReviews } from '../../offline/reviewQueue';
import { setInterfaceLanguage } from '../../i18n';
import { loadAuthenticatedAccount } from '../../auth/tokenStore';
import * as queue from '../../offline/reviewQueue';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { cacheLessonDetail } from '../../content/contentCache';
import { adaptLessonDetailFromApi } from '../../content/types';

jest.mock('expo-constants', () => {
  const configuration = require('../../../app.json');
  return { __esModule: true, default: { expoConfig: { ...configuration.expo } } };
});

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = { lessonId: 'lesson-uuid-1' };
let mockOwnerUserId = 'test-user-id';
let mockFocused = true;
const mockNavigationListeners = new Map<string, Set<(event?: any) => void>>();
const mockNavigation = {
  isFocused: () => mockFocused,
  addListener: (name: string, listener: (event?: any) => void) => {
    if (!mockNavigationListeners.has(name)) mockNavigationListeners.set(name, new Set());
    mockNavigationListeners.get(name)!.add(listener);
    return () => { mockNavigationListeners.get(name)?.delete(listener); };
  },
};
const appListeners = new Map<string, Set<(state?: any) => void>>();
const initialAppState = AppState.currentState;
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
function flushFrames() {
  const pending = [...frames.values()]; frames.clear();
  for (const callback of pending) callback(0);
}
async function present(rendered: Awaited<ReturnType<typeof render>>) {
  await act(async () => {
    fireEvent(rendered.getByTestId('review-card'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 300 } } });
    flushFrames();
  });
}
async function navigationSignal(name: string, data?: any) {
  await act(async () => {
    if (name === 'focus') mockFocused = true;
    if (name === 'blur') mockFocused = false;
    for (const listener of mockNavigationListeners.get(name) ?? []) listener({ data });
    flushFrames();
  });
}
async function appSignal(name: string, state?: any) {
  await act(async () => {
    if (name === 'change') AppState.currentState = state;
    for (const listener of appListeners.get(name) ?? []) listener(state);
    flushFrames();
  });
}

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => mockNavigation,
}));

// Mock useAuth
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: mockOwnerUserId,
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
    mockOwnerUserId = 'test-user-id';
    mockFocused = true;
    mockNavigationListeners.clear(); appListeners.clear(); frames.clear(); nextFrame = 0;
    AppState.currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((name, listener) => {
      if (!appListeners.has(name)) appListeners.set(name, new Set());
      appListeners.get(name)!.add(listener);
      return { remove: () => { appListeners.get(name)?.delete(listener); } };
    });
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrame, callback); return nextFrame;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => { if (id != null) frames.delete(id); });
    jest.mocked(loadAuthenticatedAccount).mockImplementation(async () => ({ userId: mockOwnerUserId,
      tokens: { accessToken: 'fake-token', refreshToken: 'fake-refresh' }, generation: 0 }));
    await resetDatabaseForTesting();
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  const offlineFetch = (detail = mockLessonResponse) => jest.fn(async (url: string, options: any) => {
    if (url.includes('/reviews/attempts')) throw new TypeError('Offline');
    return { ok: true, status: 200, json: async () => url.includes('/reviews/sessions')
      ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }
      : eligibilityWire(detail) };
  });

  it('does not read the elapsed clock during session/eligibility loading or before layout and a frame', async () => {
    let finishSession!: (value: any) => void;
    const session = new Promise((resolve) => { finishSession = resolve; });
    let finishEligibility!: (value: any) => void;
    const eligibility = new Promise((resolve) => { finishEligibility = resolve; });
    global.fetch = jest.fn(async (url: string, options: any) => url.includes('/reviews/sessions') ? await session : await eligibility) as any;
    const clock = createTestClock([100, 1500]);
    const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    expect(rendered.getByTestId('loading-indicator')).toBeTruthy();
    expect(reads).not.toHaveBeenCalled();
    await act(async () => { finishSession({ ok: true, status: 200, json: async () => ({ id: 'session', client_session_id: JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).client_session_id, created_at: '2025-01-01T00:00:00Z' }) }); });
    expect(reads).not.toHaveBeenCalled();
    await act(async () => { finishEligibility({ ok: true, status: 200, json: async () => eligibilityWire(mockLessonResponse) }); });
    expect(rendered.getByTestId('reveal-answer-btn')).toBeDisabled();
    expect(reads).not.toHaveBeenCalled();
    await act(async () => { fireEvent(rendered.getByTestId('review-card'), 'layout', { nativeEvent: { layout: { width: 320, height: 300 } } }); });
    expect(reads).not.toHaveBeenCalled();
    await act(async () => { flushFrames(); });
    await present(rendered);
    await rendered.rerender(<ReviewScreen customClock={clock} />);
    expect(reads).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    global.fetch = offlineFetch() as any;
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect((await getPendingReviews())[0].payload).toMatchObject({ response_time_ms: 1400,
      timing_evidence: { interruption_count: 0, interruption_reasons: [] } });
  });

  it.each(['inactive', 'background', 'unfocused', 'transition', 'app_blur'])('defers presentation until %s ends', async (blocked) => {
    if (blocked === 'unfocused') mockFocused = false;
    if (blocked === 'inactive' || blocked === 'background') AppState.currentState = blocked;
    global.fetch = offlineFetch() as any;
    const clock = createTestClock([100, 900]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    if (blocked === 'transition') await navigationSignal('transitionStart', { closing: false });
    if (blocked === 'app_blur') await appSignal('blur');
    await present(rendered);
    expect(reads).not.toHaveBeenCalled();
    if (blocked === 'unfocused') await navigationSignal('focus');
    else if (blocked === 'transition') await navigationSignal('transitionEnd', { closing: false });
    else if (blocked === 'app_blur') await appSignal('focus');
    else await appSignal('change', 'active');
    expect(reads).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect((await getPendingReviews())[0].payload).toMatchObject({ response_time_ms: 800,
      timing_evidence: { interruption_count: 0, interruption_reasons: [] } });
  });

  it('records background and focus/navigation interruptions, retains raw elapsed and never restarts on return', async () => {
    global.fetch = offlineFetch() as any;
    const clock = createTestClock([100, 10100]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await present(rendered);
    await appSignal('change', 'inactive'); await appSignal('change', 'background');
    await appSignal('change', 'background'); // Duplicate notification is not a second transition.
    await appSignal('change', 'active');
    await navigationSignal('blur'); await navigationSignal('focus');
    await navigationSignal('transitionStart', { closing: false }); await navigationSignal('transitionEnd', { closing: false });
    await present(rendered);
    expect(reads).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-again-btn')); });
    expect((await getPendingReviews())[0].payload).toMatchObject({ response_time_ms: 10000,
      timing_evidence: { interruption_count: 4,
        interruption_reasons: ['app_inactive', 'app_background', 'screen_blur', 'navigation_transition'] } });
  });

  it('gives the next item a new presentation boundary and excludes pending save time', async () => {
    const detail = { ...mockLessonResponse, vocabulary_items: [...mockLessonResponse.vocabulary_items,
      { ...mockLessonResponse.vocabulary_items[0], id: 'vocab-2', term: 'second' }] };
    global.fetch = offlineFetch(detail) as any;
    const clock = createTestClock([100, 500, 10000, 11200]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await present(rendered);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect(rendered.getByTestId('card-term').props.children).toBe('second');
    expect(reads).toHaveBeenCalledTimes(2);
    expect(rendered.getByTestId('reveal-answer-btn')).toBeDisabled();
    await present(rendered);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect((await getPendingReviews()).map((row) => row.payload.response_time_ms)).toEqual([400, 1200]);
    expect(reads).toHaveBeenCalledTimes(4);
  });

  it('keeps compiled A/B/C presentations independent through reveal, rerenders and commitment', async () => {
    const detail = { ...mockLessonResponse, vocabulary_items: [
      { ...mockLessonResponse.vocabulary_items[0], term: 'hello' },
      { ...mockLessonResponse.vocabulary_items[0], id: 'vocab-2', term: 'welcome' },
      { ...mockLessonResponse.vocabulary_items[0], id: 'vocab-3', term: 'gratitude' },
    ] };
    const submitted: any[] = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/reviews/attempts')) {
        const body = JSON.parse(options.body);
        submitted.push(body);
        return { ok: true, status: 200, json: async () => reviewWire(body.client_event_id) };
      }
      return await offlineFetch(detail)(url, options);
    }) as any;
    const clock = createTestClock([100, 500, 10000, 11200, 20000, 22300]);
    const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term').props.children).toBe('hello'));
    const wallTime = jest.spyOn(Date.prototype, 'toISOString');
    try {
      wallTime.mockReturnValue('2026-10-15T03:30:00.000Z');
      await present(rendered);
      await appSignal('blur'); await appSignal('focus');
      await rendered.rerender(<ReviewScreen customClock={clock} />);
      await present(rendered); // Repeat layout must not restart this item.
      await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
      expect(reads).toHaveBeenCalledTimes(1); // Reveal must not restart either.
      await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
      expect(submitted[0]).toMatchObject({ vocabulary_item_id: 'vocab-1', correct: true,
        response_time_ms: 400, client_interaction_at: '2026-10-15T03:30:00.000Z',
        timing_evidence: { interruption_count: 1, interruption_reasons: ['app_blur'] } });
      const firstEvidence = JSON.stringify(submitted[0]);

      expect(rendered.getByTestId('card-term').props.children).toBe('welcome');
      expect(rendered.getByTestId('reveal-answer-btn')).toBeDisabled();
      expect(rendered.queryByTestId('revealed-section')).toBeNull();
      wallTime.mockReturnValue('2026-10-15T03:30:10.000Z');
      await present(rendered);
      await rendered.rerender(<ReviewScreen customClock={clock} />);
      await present(rendered);
      await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
      await act(async () => { fireEvent.press(rendered.getByTestId('rating-again-btn')); });
      expect(submitted[1]).toMatchObject({ vocabulary_item_id: 'vocab-2', correct: false,
        response_time_ms: 1200, client_interaction_at: '2026-10-15T03:30:10.000Z',
        timing_evidence: { interruption_count: 0, interruption_reasons: [] } });

      expect(rendered.getByTestId('card-term').props.children).toBe('gratitude');
      expect(rendered.getByTestId('reveal-answer-btn')).toBeDisabled();
      wallTime.mockReturnValue('2026-10-15T03:30:20.000Z');
      await present(rendered);
      await navigationSignal('blur'); await navigationSignal('focus');
      await rendered.rerender(<ReviewScreen customClock={clock} />);
      await present(rendered);
      await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
      await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
      expect(submitted[2]).toMatchObject({ vocabulary_item_id: 'vocab-3', correct: true,
        response_time_ms: 2300, client_interaction_at: '2026-10-15T03:30:20.000Z',
        timing_evidence: { interruption_count: 1, interruption_reasons: ['screen_blur'] } });
      expect(reads).toHaveBeenCalledTimes(6);
      expect(new Set(submitted.map((body) => body.client_event_id)).size).toBe(3);
      expect(JSON.stringify(submitted[0])).toBe(firstEvidence);
      expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
        params: expect.objectContaining({ totalCount: '3', syncedCount: '3' }),
      }));
      expect(await getPendingReviews()).toHaveLength(0);
    } finally { wallTime.mockRestore(); }
  });

  it('cancels the pre-start frame when the app backgrounds and cannot answer before presentation', async () => {
    global.fetch = offlineFetch() as any;
    const clock = createTestClock([100, 900]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    expect(rendered.queryByTestId('rating-section')).toBeNull();
    await act(async () => { fireEvent(rendered.getByTestId('review-card'), 'layout', { nativeEvent: { layout: { width: 320, height: 300 } } }); });
    await appSignal('change', 'background');
    expect(reads).not.toHaveBeenCalled();
    await appSignal('change', 'active');
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it.each(['app_blur', 'navigation_away'])('records supported %s after start and can return without resetting', async (reason) => {
    global.fetch = offlineFetch() as any;
    const clock = createTestClock([100, 2100]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await present(rendered);
    if (reason === 'app_blur') { await appSignal('blur'); await appSignal('focus'); }
    else await navigationSignal('beforeRemove'); // Removal canceled by another route handler.
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect((await getPendingReviews())[0].payload).toMatchObject({ response_time_ms: 2000,
      timing_evidence: { interruption_count: 1, interruption_reasons: [reason] } });
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('freezes timing before a delayed online acknowledgement and ignores post-commit interruptions', async () => {
    let acknowledge!: (value: any) => void;
    const acknowledgement = new Promise((resolve) => { acknowledge = resolve; });
    let body: any;
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/reviews/attempts')) { body = JSON.parse(options.body); return await acknowledgement; }
      return await offlineFetch()(url, options);
    }) as any;
    const clock = createTestClock([100, 1400, 999999]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await present(rendered);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect(body).toMatchObject({ response_time_ms: 1300, timing_evidence: { interruption_count: 0, interruption_reasons: [] } });
    await appSignal('change', 'background'); await appSignal('change', 'active');
    expect(reads).toHaveBeenCalledTimes(2);
    await act(async () => { acknowledge({ ok: true, status: 200, json: async () => ({ ...reviewWire(body.client_event_id),
      response_time_ms: body.response_time_ms, timing_evidence: body.timing_evidence }) }); });
    expect(reads).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ syncedCount: '1' }) }));
  });

  it('retries the same frozen interaction after account verification pauses without starting timing again', async () => {
    global.fetch = offlineFetch() as any;
    const clock = createTestClock([100, 1700, 999999]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await present(rendered);
    jest.mocked(loadAuthenticatedAccount).mockResolvedValueOnce(null);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect(rendered.getByTestId('retry-save-btn')).toBeTruthy();
    expect(await getPendingReviews()).toHaveLength(0);
    await appSignal('change', 'background'); await appSignal('change', 'active');
    await act(async () => { fireEvent.press(rendered.getByTestId('retry-save-btn')); });
    expect((await getPendingReviews())[0].payload).toMatchObject({ correct: true, response_time_ms: 1600,
      timing_evidence: { interruption_count: 0, interruption_reasons: [] } });
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('uses an explicit empty server eligibility result instead of every active cached/content word', async () => {
    global.fetch = jest.fn(async (url: string, options: any) => ({ ok: true, status: 200,
      json: async () => url.includes('/reviews/eligible-items')
        ? { lesson_id: mockLessonResponse.id, content_release_id: mockLessonResponse.content_release_id,
          evaluated_at: '2025-01-01T00:00:00Z', items: [] }
        : url.includes('/reviews/sessions')
          ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }
          : eligibilityWire(mockLessonResponse) })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('empty-review-container')).toBeTruthy());
    expect(rendered.queryByTestId('card-term')).toBeNull();
    expect(rendered.queryByTestId('error-container')).toBeNull();
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it('cannot start new review offline even when a complete published lesson is cached', async () => {
    await cacheLessonDetail(adaptLessonDetailFromApi(mockLessonResponse));
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('error-container')).toBeTruthy());
    expect(rendered.getByText('Review availability could not be checked. Connect and try again.')).toBeTruthy();
    expect(rendered.queryByTestId('card-term')).toBeNull();
    expect(await getPendingReviews()).toHaveLength(0);
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url.includes('/reviews/eligible-items'))).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url.includes('/content/lessons'))).toBe(false);
  });

  it('hides the previous account eligibility while the next account availability is unresolved', async () => {
    let releaseNext!: (value: unknown) => void;
    const next = new Promise((resolve) => { releaseNext = resolve; });
    global.fetch = jest.fn(async (url: string, options: any) => ({ ok: true, status: 200,
      json: async () => url.includes('/reviews/sessions')
        ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }
        : mockOwnerUserId === 'test-user-id' ? eligibilityWire(mockLessonResponse) : await next })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    mockOwnerUserId = 'account-B';
    await rendered.rerender(<ReviewScreen />);
    expect(rendered.queryByTestId('card-term')).toBeNull();
    expect(rendered.getByTestId('loading-indicator')).toBeTruthy();
    await act(async () => { releaseNext({ ...eligibilityWire(mockLessonResponse), items: [] }); });
    await waitFor(() => expect(rendered.getByTestId('empty-review-container')).toBeTruthy());
    expect(await getPendingReviews()).toHaveLength(0);
  });

  it.each(['1900-01-01T00:00:00Z', '2200-01-01T00:00:00Z'])('displays server-approved due work independently of device time %s', async (deviceTime) => {
    const approved = { ...eligibilityWire(mockLessonResponse), evaluated_at: '2100-01-01T00:00:00Z',
      items: [{ vocabulary_item: mockLessonResponse.vocabulary_items[0], eligibility: 'due',
        current_schedule: { id: 'schedule-id', scheduler_type: 'development', algorithm_version: 'dev-0.1',
          next_interval_seconds: 600, next_due_at: '2099-01-01T00:00:00Z', scheduler_state: null } }] };
    global.fetch = jest.fn(async (url: string, options: any) => ({ ok: true, status: 200,
      json: async () => url.includes('/reviews/sessions')
        ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' }
        : approved })) as any;
    jest.useFakeTimers().setSystemTime(new Date(deviceTime));
    try {
      const rendered = await render(<ReviewScreen />);
      await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
      expect(rendered.getByTestId('card-term').props.children).toBe('ephemeral');
    } finally { jest.useRealTimers(); }
  });

  it('preserves the pinned eligible revision/release through display and online answer', async () => {
    const pinned = '66666666-6666-4666-8666-666666666666';
    mockParams.contentReleaseId = pinned;
    const detail = { ...mockLessonResponse, content_release_id: pinned,
      vocabulary_items: mockLessonResponse.vocabulary_items.map((item) => ({ ...item, term: 'Pinned word', content_release_id: pinned })) };
    let submitted: Record<string, unknown> | undefined;
    global.fetch = jest.fn(async (url: string, options: any) => {
      const body = options.body ? JSON.parse(options.body) : undefined;
      if (url.includes('/reviews/attempts')) submitted = body;
      return { ok: true, status: 200, json: async () => url.includes('/reviews/eligible-items') ? eligibilityWire(detail)
        : url.includes('/reviews/sessions') ? { id: 'server-session', client_session_id: body.client_session_id, created_at: '2025-01-01T00:00:00Z' }
          : { ...reviewWire(body.client_event_id), session_id: body.session_id, vocabulary_item_id: body.vocabulary_item_id,
            content_revision_id: body.content_revision_id, content_release_id: body.content_release_id } };
    }) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term').props.children).toBe('Pinned word'));
    await present(rendered);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-good-btn')); });
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url.includes(`content_release_id=${pinned}`))).toBe(true);
    expect(submitted).toMatchObject({ vocabulary_item_id: detail.vocabulary_items[0].id,
      content_revision_id: detail.vocabulary_items[0].content_revision_id, content_release_id: pinned });
    expect(await getPendingReviews()).toHaveLength(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    AppState.currentState = initialAppState;
    global.fetch = originalFetch;
  });

  it('shows an unsaved review when SQLite fails and retries the same UUID and original facts', async () => {
    const submitted: any[] = [];
    global.fetch = jest.fn(async (url: string, options: any) => {
      if (url.includes('/reviews/attempts')) {
        submitted.push(JSON.parse(options.body));
        throw new Error('Lost acknowledgement');
      }
      return { ok: true, status: 200, json: async () => url.includes('/reviews/sessions') ? { id: 'session-uuid-1', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : eligibilityWire(mockLessonResponse) };
    }) as any;
    jest.spyOn(queue, 'enqueuePendingReview').mockRejectedValueOnce(new Error('Disk unavailable'));
    const clock = createTestClock([100, 1700, 999999]); const reads = jest.spyOn(clock, 'now');
    const rendered = await render(<ReviewScreen customClock={clock} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    await present(rendered);
    await act(async () => { fireEvent.press(rendered.getByTestId('reveal-answer-btn')); });
    await act(async () => { fireEvent.press(rendered.getByTestId('rating-again-btn')); });
    expect(rendered.getByTestId('unsaved-review-error')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(await getPendingReviews()).toHaveLength(0);
    jest.replaceProperty(Constants.expoConfig!, 'version', '2.0.0');
    await act(async () => { fireEvent.press(rendered.getByTestId('retry-save-btn')); });
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual(submitted[0]);
    expect(submitted[1]).toMatchObject({ response_time_ms: 1600,
      timing_evidence: { interruption_count: 0, interruption_reasons: [] } });
    expect(reads).toHaveBeenCalledTimes(2);
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
        ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : eligibilityWire(mockLessonResponse) };
    }) as any;
    const rendered = await render(<ReviewScreen customClock={createTestClock([100, 1500])} />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T11:22:33.456Z'));
    try {
      jest.mocked(loadAuthenticatedAccount).mockImplementationOnce(async () => {
        await Promise.resolve();
        jest.setSystemTime(new Date('2025-01-01T12:22:33.456Z'));
        return { userId: 'test-user-id', tokens: { accessToken: 'fake-token', refreshToken: 'fake-refresh' }, generation: 0 };
      });
      await present(rendered);
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
      if (url.includes('/reviews/eligible-items')) {
        if (++contentCalls === 1) throw new TypeError('Content unavailable');
        return { ok: true, status: 200, json: async () => eligibilityWire({ ...mockLessonResponse,
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
      await present(rendered);
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
      json: async () => url.includes('/reviews/sessions') ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : eligibilityWire(mockLessonResponse) })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    jest.replaceProperty(Constants.expoConfig!, 'version', undefined);
    await present(rendered);
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
      json: async () => url.includes('/reviews/sessions') ? { id: 'server-session', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : eligibilityWire(legacy) })) as any;
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
      json: async () => url.includes('/reviews/sessions') ? { id: 'session-uuid-1', client_session_id: JSON.parse(options.body).client_session_id, created_at: '2025-01-01T00:00:00Z' } : eligibilityWire(mockLessonResponse),
    })) as any;
    const rendered = await render(<ReviewScreen />);
    await waitFor(() => expect(rendered.getByTestId('card-term')).toBeTruthy());
    jest.mocked(loadAuthenticatedAccount).mockResolvedValueOnce(null);
    await present(rendered);
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
      if (url.includes('/reviews/eligible-items')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => eligibilityWire(mockLessonResponse),
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
      if (url.includes('/reviews/eligible-items')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => eligibilityWire(mockLessonResponse),
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

    await present(rendered);
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
    const testClock = createTestClock([1000, 3250]); // 2250 ms elapsed
    let attemptBody: any = null;
    let originalClientSession: string | undefined;
    jest.replaceProperty(Platform, 'OS', 'ios');

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/reviews/eligible-items')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => eligibilityWire(mockLessonResponse),
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

    await present(rendered);
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
    const testClock = createTestClock([500, 1800]); // 1300 ms elapsed

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/reviews/eligible-items')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => eligibilityWire(mockLessonResponse),
        });
      }
      // Review session or attempt fails (network offline)
      return Promise.reject(new Error('Network offline'));
    });

    const rendered = await render(<ReviewScreen customClock={testClock} />);

    await waitFor(() => {
      expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    });

    await present(rendered);
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
    const testClock = createTestClock([100, 1500]); // 1400 ms elapsed

    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (url.includes('/reviews/eligible-items')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => eligibilityWire(mockLessonResponse),
        });
      }
      // Exact React Native fetch failure when TCP connection refused on stopped FastAPI
      return Promise.reject(new TypeError('Network request failed'));
    });

    const rendered = await render(<ReviewScreen customClock={testClock} />);

    await waitFor(() => {
      expect(rendered.getByTestId('reveal-answer-btn')).toBeTruthy();
    });

    await present(rendered);
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
