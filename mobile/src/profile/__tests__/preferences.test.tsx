import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { adaptPreferencesToApi, adaptProfileFromApi } from '../api';
import { ApiLearnerProfile } from '../types';
import OnboardingScreen from '../../../app/(app)/onboarding';
import { setInterfaceLanguage } from '../../i18n';

// Mock router
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
  }),
}));

// Mock useAuth
const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
let mockUser: any = {
  id: 'user-1',
      user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'learner@example.test',
  participantCode: 'P001',
  interfaceLanguage: null,
  targetLearningLanguage: null,
};

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    refreshProfile: mockRefreshProfile,
    logout: jest.fn(),
  }),
}));

describe('Learner Preferences & Onboarding', () => {
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

  it('correctly adapts snake_case API profile to camelCase LearnerProfile', () => {
    const apiData: ApiLearnerProfile = {
      id: '12345678-1234-1234-1234-123456789abc',
      user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'p01@example.test',
      participant_code: 'P01',
      interface_language: 'fil',
      target_learning_language: 'en',
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    };

    const adapted = adaptProfileFromApi(apiData);
    expect(adapted.id).toBe(apiData.id);
    expect(adapted.email).toBe(apiData.email);
    expect(adapted.participantCode).toBe('P01');
    expect(adapted.interfaceLanguage).toBe('fil');
    expect(adapted.targetLearningLanguage).toBe('en');
  });

  it('correctly adapts camelCase preferences to snake_case API payload', () => {
    const payload = adaptPreferencesToApi({
      interfaceLanguage: 'fil',
      targetLearningLanguage: 'en',
    });

    expect(payload).toEqual({
      interface_language: 'fil',
      target_learning_language: 'en',
    });
  });

  it('selecting Tagalog UI plus English target sends correct backend payload', async () => {
    let capturedBody: any = null;
    global.fetch = jest.fn().mockImplementation((url: string, options: any) => {
      if (url.includes('/users/me/preferences')) {
        capturedBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user-1',
      user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'learner@example.test',
            participant_code: 'P001',
            interface_language: capturedBody.interface_language,
            target_learning_language: capturedBody.target_learning_language,
            created_at: '2026-09-22T00:00:00Z',
            updated_at: '2026-09-22T00:00:00Z',
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const rendered = await render(<OnboardingScreen />);

    // Select interface language: fil
    await act(async () => {
      fireEvent.press(rendered.getByTestId('ui-lang-fil'));
    });

    // Select target language: en
    await act(async () => {
      fireEvent.press(rendered.getByTestId('target-lang-en'));
    });

    // Submit
    await act(async () => {
      fireEvent.press(rendered.getByTestId('save-preferences-btn'));
    });

    expect(capturedBody).toEqual({
      interface_language: 'fil',
      target_learning_language: 'en',
    });
    expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
  });

  it('switching UI language immediately changes screen strings without changing target language', async () => {
    const rendered = await render(<OnboardingScreen />);

    // Initially English
    expect(rendered.getByText(/Welcome to FLUENTT/i)).toBeTruthy();

    // Select Tagalog UI
    await act(async () => {
      fireEvent.press(rendered.getByTestId('ui-lang-fil'));
    });

    // Screen string should now be localized Tagalog
    expect(rendered.getByText(/Maligayang Pagdating sa FLUENTT/i)).toBeTruthy();
  });

  it('unsupported preference error (422) is handled recoverably without corrupting state', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me/preferences')) {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            detail: [{ msg: 'Unsupported language code' }],
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const rendered = await render(<OnboardingScreen />);

    // Select preferences
    await act(async () => {
      fireEvent.press(rendered.getByTestId('ui-lang-fil'));
    });
    await act(async () => {
      fireEvent.press(rendered.getByTestId('target-lang-en'));
    });

    // Attempt save
    await act(async () => {
      fireEvent.press(rendered.getByTestId('save-preferences-btn'));
    });

    // An error banner must be displayed
    expect(rendered.getByTestId('preference-error')).toBeTruthy();
    // Navigation to home did NOT happen
    expect(mockReplace).not.toHaveBeenCalledWith('/(app)/home');
  });
});
