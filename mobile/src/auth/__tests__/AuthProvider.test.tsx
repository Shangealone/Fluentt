import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../tokenStore';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => {
      return store.get(key) ?? null;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    _clearMockStore: () => store.clear(),
  };
});

// Test component to interact with useAuth
const AuthConsumer: React.FC = () => {
  const { status, user, login, changePassword, logout } = useAuth();

  return (
    <>
      <Text testID="auth-status">{status}</Text>
      <Text testID="user-email">{user?.email ?? 'none'}</Text>
      <Text testID="must-change">{String(user?.mustChangePassword ?? false)}</Text>
      <Button
        title="Login Temp"
        testID="login-temp-btn"
        onPress={() => login('learner@example.test', 'TempPass!123')}
      />
      <Button
        title="Login Normal"
        testID="login-normal-btn"
        onPress={() => login('normal@example.test', 'PermanentPass!123')}
      />
      <Button
        title="Change Password"
        testID="change-pwd-btn"
        onPress={() => changePassword('TempPass!123', 'NewPermanentPass!123')}
      />
      <Button title="Logout" testID="logout-btn" onPress={() => logout()} />
    </>
  );
};

describe('AuthProvider & useAuth', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as any)._clearMockStore?.();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('starts with signedOut if SecureStore has no tokens', async () => {
    const screen = await render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status').props.children).toBe('signedOut');
  });

  it('restores valid session from SecureStore on startup', async () => {
    // Pre-populate tokens
    await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, 'existing_access');
    await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, 'existing_refresh');

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: '11111111-1111-1111-1111-111111111111',
            email: 'restored@example.test',
            participant_code: 'P_RESTORED',
            interface_language: 'en',
            target_learning_language: 'fil',
            must_change_password: false,
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const screen = await render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status').props.children).toBe('signedIn');
    expect(screen.getByTestId('user-email').props.children).toBe('restored@example.test');
  });

  it('sets mustChangePassword state on first login with temporary password', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'temp_access',
            refresh_token: 'temp_refresh',
            token_type: 'bearer',
            must_change_password: true,
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const screen = await render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('login-temp-btn'));
    });

    expect(screen.getByTestId('auth-status').props.children).toBe('mustChangePassword');
    expect(screen.getByTestId('must-change').props.children).toBe('true');
  });

  it('unlocks signedIn status after successful password change', async () => {
    // Start with temporary credentials
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'temp_access',
            refresh_token: 'temp_refresh',
            token_type: 'bearer',
            must_change_password: true,
          }),
        });
      }
      if (url.includes('/auth/change-password')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'permanent_access',
            refresh_token: 'permanent_refresh',
            token_type: 'bearer',
            must_change_password: false,
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const screen = await render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('login-temp-btn'));
    });
    expect(screen.getByTestId('auth-status').props.children).toBe('mustChangePassword');

    await act(async () => {
      fireEvent.press(screen.getByTestId('change-pwd-btn'));
    });
    expect(screen.getByTestId('auth-status').props.children).toBe('signedIn');
    expect(screen.getByTestId('must-change').props.children).toBe('false');
  });

  it('clears SecureStore and sets signedOut status on logout', async () => {
    // Start signedIn
    await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, 'acc');
    await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, 'ref');

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: '11111111-1111-1111-1111-111111111111',
            email: 'user@example.test',
            must_change_password: false,
          }),
        });
      }
      if (url.includes('/auth/logout')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const screen = await render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status').props.children).toBe('signedIn');

    await act(async () => {
      fireEvent.press(screen.getByTestId('logout-btn'));
    });

    expect(screen.getByTestId('auth-status').props.children).toBe('signedOut');
    expect(await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(await SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN)).toBeNull();
  });
});
