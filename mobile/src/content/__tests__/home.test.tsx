import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../../../app/(app)/home';
import { setInterfaceLanguage } from '../../i18n';
import { cacheLessons, resetCacheForTesting, initContentDatabase } from '../contentCache';

// Mock router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock useAuth
let mockUser = {
  id: 'usr-1',
  participantCode: 'P001',
  interfaceLanguage: 'en',
  targetLearningLanguage: 'en',
};
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

describe('HomeScreen', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    await initContentDatabase();
    await resetCacheForTesting();
    await setInterfaceLanguage('en');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders learner greeting, target language, and honest lesson count', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/content/lessons')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: '11111111-1111-1111-1111-111111111111',
              language_code: 'en',
              content_release_id: '88888888-8888-4888-8888-888888888888',
              is_active: true,
              title: 'Lesson 1', description: null,
              content_version: 'sample-en-v0.1',
              sort_order: 1,
              item_count: 5,
            },
          ],
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const rendered = await render(<HomeScreen />);

    expect(rendered.getByTestId('home-greeting')).toBeTruthy();
    expect(rendered.getByText(/P001/i)).toBeTruthy();
    expect(rendered.getByText(/Available Lessons: 1/i)).toBeTruthy();
    expect(rendered.getByText(/Browse Lessons/i)).toBeTruthy();
    expect(rendered.getByText(/Settings/i)).toBeTruthy();
  });

  it('shows offline banner when reading from cached content during network failure', async () => {
    await cacheLessons('en', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        languageCode: 'en',
        title: 'Cached Lesson',
        contentVersion: 'sample-en-v0.1',
        sortOrder: 1,
        itemCount: 2,
        isActive: true,
      },
    ]);

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const rendered = await render(<HomeScreen />);

    expect(rendered.getByTestId('home-offline-banner')).toBeTruthy();
    expect(rendered.getByText(/Available Lessons: 1/i)).toBeTruthy();
  });
});
