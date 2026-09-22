/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NavigationGuard } from '../../../app/_layout';
import AuthLayout from '../../../app/(auth)/_layout';

// Mock expo-router
const mockReplace = jest.fn();
let mockSegments: string[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useRouter: () => ({
      replace: mockReplace,
    }),
    useSegments: () => mockSegments,
    Stack: Object.assign(
      ({ children }: { children: React.ReactNode }) => <View testID="mock-stack">{children}</View>,
      {
        Screen: ({ name }: { name: string }) => <View testID={`mock-screen-${name}`} />,
      }
    ),
  };
});

// Mock AuthProvider / useAuth
let mockAuthState: {
  status: 'loading' | 'signedOut' | 'mustChangePassword' | 'signedIn';
  user: any;
} = {
  status: 'signedOut',
  user: null,
};

jest.mock('../../../src/auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

describe('NavigationGuard & AuthLayout Route Configuration', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSegments = [];
    mockAuthState = {
      status: 'signedOut',
      user: null,
    };
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('AuthLayout', () => {
    it('renders auth layout stack with login and change-password screens', async () => {
      const screen = await render(<AuthLayout />);
      expect(screen.getByTestId('mock-stack')).toBeTruthy();
      expect(screen.getByTestId('mock-screen-login')).toBeTruthy();
      expect(screen.getByTestId('mock-screen-change-password')).toBeTruthy();
    });

    it('does not produce any Layout children warnings', async () => {
      await render(<AuthLayout />);
      const layoutWarnings = warnSpy.mock.calls.filter((call) =>
        call.some((arg: unknown) => typeof arg === 'string' && arg.includes('[Layout children]'))
      );
      expect(layoutWarnings).toHaveLength(0);
    });
  });

  describe('NavigationGuard State Routing', () => {
    it('does not redirect when auth is in loading state', async () => {
      mockAuthState = { status: 'loading', user: null };
      mockSegments = ['index'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects signedOut users to /(auth)/login when not on login route', async () => {
      mockAuthState = { status: 'signedOut', user: null };
      mockSegments = ['index'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });

    it('does not redirect signedOut users if already on login route', async () => {
      mockAuthState = { status: 'signedOut', user: null };
      mockSegments = ['(auth)', 'login'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects mustChangePassword users exclusively to /(auth)/change-password', async () => {
      mockAuthState = {
        status: 'mustChangePassword',
        user: { email: 'temp@example.test', mustChangePassword: true },
      };
      mockSegments = ['(auth)', 'login'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).toHaveBeenCalledWith('/(auth)/change-password');
    });

    it('does not redirect mustChangePassword users if already on change-password route', async () => {
      mockAuthState = {
        status: 'mustChangePassword',
        user: { email: 'temp@example.test', mustChangePassword: true },
      };
      mockSegments = ['(auth)', 'change-password'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects signedIn users without preferences to /(app)/onboarding from auth group', async () => {
      mockAuthState = {
        status: 'signedIn',
        user: {
          id: 'user-1',
          email: 'new@example.test',
          interfaceLanguage: null,
          targetLearningLanguage: null,
        },
      };
      mockSegments = ['(auth)', 'login'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).toHaveBeenCalledWith('/(app)/onboarding');
    });

    it('redirects signedIn users with preferences to /(app)/home from root index', async () => {
      mockAuthState = {
        status: 'signedIn',
        user: {
          id: 'user-1',
          email: 'learner@example.test',
          interfaceLanguage: 'en',
          targetLearningLanguage: 'fil',
        },
      };
      mockSegments = ['index'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });

    it('does not redirect signedIn users when already in app routes', async () => {
      mockAuthState = {
        status: 'signedIn',
        user: {
          id: 'user-1',
          email: 'learner@example.test',
          interfaceLanguage: 'en',
          targetLearningLanguage: 'fil',
        },
      };
      mockSegments = ['(app)', 'lessons'];

      await render(
        <NavigationGuard>
          <Text>Child</Text>
        </NavigationGuard>
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
