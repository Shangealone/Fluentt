import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import LessonsScreen from '../../../app/(app)/lessons/index';
import LessonDetailScreen from '../../../app/(app)/lessons/[lessonId]';
import { setInterfaceLanguage } from '../../i18n';
import { cacheLessonDetail, cacheLessons, resetCacheForTesting, initContentDatabase } from '../contentCache';

// Mock router
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = { lessonId: '11111111-1111-1111-1111-111111111111' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

// Mock useAuth
let mockTargetLang: 'en' | 'fil' = 'en';
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      targetLearningLanguage: mockTargetLang,
      interfaceLanguage: 'en',
    },
  }),
}));

describe('Lesson and Vocabulary Study Flow', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    mockTargetLang = 'en';
    await initContentDatabase();
    await resetCacheForTesting();
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('active lessons render in server sort order', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/content/lessons')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: '11111111-1111-1111-1111-111111111111',
              language_code: 'en',
              title: 'Lesson Alpha (Order 1)',
              description: 'Alpha description',
              content_version: 'sample-en-v0.1',
              sort_order: 1,
              item_count: 5,
            },
            {
              id: '11111111-1111-1111-1111-111111111112',
              language_code: 'en',
              title: 'Lesson Beta (Order 2)',
              description: 'Beta description',
              content_version: 'sample-en-v0.1',
              sort_order: 2,
              item_count: 3,
            },
          ],
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const rendered = await render(<LessonsScreen />);

    expect(rendered.getByText(/Lesson Alpha/i)).toBeTruthy();
    expect(rendered.getByText(/Lesson Beta/i)).toBeTruthy();
  });

  it('empty feed shows localized empty state with retry option', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/content/lessons')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const rendered = await render(<LessonsScreen />);

    expect(rendered.getByText(/No lessons are available yet/i)).toBeTruthy();
    expect(rendered.getByTestId('retry-btn')).toBeTruthy();
  });

  it('network/API error shows localized retry state', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    const rendered = await render(<LessonsScreen />);

    expect(rendered.getByText(/Failed to load content/i)).toBeTruthy();
    expect(rendered.getByTestId('retry-btn')).toBeTruthy();
  });

  it('offline cached lessons can be read when API is temporarily unavailable', async () => {
    // Pre-cache lessons
    await cacheLessons('en', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Cached Offline Lesson',
        description: 'Previously downloaded',
        contentVersion: 'sample-en-v0.1',
        sortOrder: 1,
        itemCount: 2,
        isActive: true,
      },
    ]);

    // Network is down
    global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

    const rendered = await render(<LessonsScreen />);

    expect(rendered.getByText(/Cached Offline Lesson/i)).toBeTruthy();
    expect(rendered.getByTestId('offline-banner')).toBeTruthy();
  });

  it('vocabulary term, definition, example, and version render correctly in lesson detail', async () => {
    mockParams = { lessonId: '11111111-1111-1111-1111-111111111111' };

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/content/lessons/11111111-1111-1111-1111-111111111111')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: '11111111-1111-1111-1111-111111111111',
            language_code: 'en',
            title: 'Detailed Lesson Title',
            description: 'Detailed description',
            content_version: 'sample-en-v0.1',
            sort_order: 1,
            vocabulary_items: [
              {
                id: '22222222-2222-2222-2222-222222222221',
                lesson_id: '11111111-1111-1111-1111-111111111111',
                term: 'resilience',
                definition: 'the capacity to recover quickly from difficulties',
                example_sentence: 'She demonstrated great resilience under pressure.',
                difficulty: 'intermediate',
                category: 'character',
                translation: 'tatag',
                content_version: 'sample-en-v0.1',
                sort_order: 1,
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const rendered = await render(<LessonDetailScreen />);

    expect(rendered.getByText('resilience')).toBeTruthy();
    expect(rendered.getByText(/the capacity to recover quickly/i)).toBeTruthy();
    expect(rendered.getByText(/She demonstrated great resilience/i)).toBeTruthy();
    expect(rendered.getByText(/tatag/i)).toBeTruthy();
  });

  it('authentication failure (401) does not fall back to cached content', async () => {
    // Pre-cache lessons
    await cacheLessons('en', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Cached Secret Lesson',
        description: 'Should not show on 401',
        contentVersion: 'sample-en-v0.1',
        sortOrder: 1,
        itemCount: 2,
        isActive: true,
      },
    ]);

    // API returns 401 Unauthorized
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });
    });

    const rendered = await render(<LessonsScreen />);

    // Should NOT show cached secret content
    expect(rendered.queryByText(/Cached Secret Lesson/i)).toBeNull();
    // Should show error state
    expect(rendered.getByText(/Failed to load content/i)).toBeTruthy();
  });
});
