import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import ProgressScreen from '../../../app/(app)/progress';
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

describe('ProgressScreen', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    await act(async () => {
      await setInterfaceLanguage('en');
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders learner metrics, breakdown, and recent activity', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/analytics/progress')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            total_reviews: 12,
            unique_vocabulary_reviewed: 8,
            streak_days: 3,
            performance_breakdown: {
              again: 1,
              hard: 2,
              good: 5,
              easy: 4,
            },
            recent_activity: [
              {
                attempt_id: 'att-1',
                vocabulary_item_id: 'voc-1',
                term: 'resilience',
                correct: true,
                performance_rating: 'good',
                created_at: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const rendered = await render(<ProgressScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('total-reviews-stat').props.children).toBe(12);
    });

    expect(rendered.getByTestId('unique-words-stat').props.children).toBe(8);
    expect(rendered.getByTestId('streak-days-stat')).toBeTruthy();
    expect(rendered.getByText('resilience')).toBeTruthy();
    expect(rendered.getByText('good')).toBeTruthy();
  });

  it('renders empty notice when recent activity is empty', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/analytics/progress')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            total_reviews: 0,
            unique_vocabulary_reviewed: 0,
            streak_days: 0,
            performance_breakdown: { again: 0, hard: 0, good: 0, easy: 0 },
            recent_activity: [],
          }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const rendered = await render(<ProgressScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('empty-activity-notice')).toBeTruthy();
    });
  });
});
