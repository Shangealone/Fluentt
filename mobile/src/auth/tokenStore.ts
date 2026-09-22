import * as SecureStore from 'expo-secure-store';

export const SECURE_KEYS = {
  ACCESS_TOKEN: 'fluentt.access_token',
  REFRESH_TOKEN: 'fluentt.refresh_token',
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Persist sensitive JWT authentication tokens exclusively to Expo SecureStore.
 * Never writes to SQLite, AsyncStorage, or logs.
 */
export async function saveTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
}

/**
 * Retrieve persisted JWT authentication tokens from Expo SecureStore.
 */
export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

/**
 * Remove sensitive JWT authentication tokens from Expo SecureStore.
 */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN),
  ]);
}
