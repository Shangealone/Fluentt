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

  it('renders factual learner aggregates (studied, completed, correct, accuracy)', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/analytics/progress')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            vocabulary_items_studied: 8,
            review_attempts_completed: 12,
            correct_attempts: 9,
            accuracy_rate: 0.75,
          }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const rendered = await render(<ProgressScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('total-reviews-stat').props.children).toBe(12);
    });

    expect(rendered.getByTestId('vocab-studied-stat').props.children).toBe(8);
    expect(rendered.getByTestId('correct-attempts-stat').props.children).toBe(9);
    expect(rendered.getByTestId('accuracy-rate-stat').props.children).toBe('75.0%');
  });

  it('renders zero-attempt progress with 0.0% accuracy', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/analytics/progress')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            vocabulary_items_studied: 0,
            review_attempts_completed: 0,
            correct_attempts: 0,
            accuracy_rate: 0.0,
          }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const rendered = await render(<ProgressScreen />);

    await waitFor(() => {
      expect(rendered.getByTestId('total-reviews-stat').props.children).toBe(0);
    });

    expect(rendered.getByTestId('vocab-studied-stat').props.children).toBe(0);
    expect(rendered.getByTestId('correct-attempts-stat').props.children).toBe(0);
    expect(rendered.getByTestId('accuracy-rate-stat').props.children).toBe('0.0%');
  });
});
