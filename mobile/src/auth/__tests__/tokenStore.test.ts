import * as SecureStore from 'expo-secure-store';
import { saveTokens, loadTokens, clearTokens, SECURE_KEYS } from '../tokenStore';

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

describe('TokenStore (SecureStore isolation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as any)._clearMockStore?.();
  });

  it('saves tokens exclusively to SecureStore with fluentt. prefix', async () => {
    await saveTokens({
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_KEYS.ACCESS_TOKEN,
      'test_access_token'
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_KEYS.REFRESH_TOKEN,
      'test_refresh_token'
    );

    expect(SECURE_KEYS.ACCESS_TOKEN).toMatch(/^fluentt\./);
    expect(SECURE_KEYS.REFRESH_TOKEN).toMatch(/^fluentt\./);
  });

  it('loads tokens from SecureStore', async () => {
    await saveTokens({
      accessToken: 'acc_123',
      refreshToken: 'ref_456',
    });

    const tokens = await loadTokens();
    expect(tokens).toEqual({
      accessToken: 'acc_123',
      refreshToken: 'ref_456',
    });
  });

  it('clears tokens from SecureStore on logout or revocation', async () => {
    await saveTokens({
      accessToken: 'acc_123',
      refreshToken: 'ref_456',
    });

    await clearTokens();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.ACCESS_TOKEN);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.REFRESH_TOKEN);

    const tokens = await loadTokens();
    expect(tokens).toBeNull();
  });
});
