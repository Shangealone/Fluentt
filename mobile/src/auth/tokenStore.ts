import * as SecureStore from 'expo-secure-store';

export const SECURE_KEYS = {
  ACCESS_TOKEN: 'fluentt.access_token',
  REFRESH_TOKEN: 'fluentt.refresh_token',
} as const;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedAccount {
  userId: string;
  tokens: TokenPair;
  generation: number;
}

let generation = 0;
let verifiedAccount: AuthenticatedAccount | null = null;
let mutations: Promise<unknown> = Promise.resolve();
const accountListeners = new Set<() => void>();

function notifyAccountListeners(): void {
  for (const listener of accountListeners) {
    try { listener(); } catch { /* Status listeners must not interrupt authentication. */ }
  }
}

export function subscribeToAuthenticatedAccount(listener: () => void): () => void {
  accountListeners.add(listener);
  return () => { accountListeners.delete(listener); };
}

// Safe synchronous snapshot for participant-facing UI. Every token mutation
// invalidates this binding before notifying subscribers.
export function getVerifiedAccountId(): string | null {
  return verifiedAccount?.generation === generation ? verifiedAccount.userId : null;
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutations.then(operation);
  mutations = result.catch(() => {});
  return result;
}

export function sameTokens(a: TokenPair | null, b: TokenPair | null): boolean {
  return Boolean(a && b && a.accessToken === b.accessToken && a.refreshToken === b.refreshToken);
}

async function readTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(SECURE_KEYS.REFRESH_TOKEN),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

async function writeTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
}

// Identity is established only by an authenticated /users/me response for these
// exact tokens. A process restart must verify the account again before syncing.
export async function bindAuthenticatedAccount(userId: string, tokens: TokenPair): Promise<void> {
  const bindingGeneration = generation;
  if (userId && sameTokens(await loadTokens(), tokens) && bindingGeneration === generation) {
    verifiedAccount = { userId, tokens, generation };
    notifyAccountListeners();
  }
}

export async function loadAuthenticatedAccount(): Promise<AuthenticatedAccount | null> {
  const tokens = await loadTokens();
  return verifiedAccount && sameTokens(tokens, verifiedAccount.tokens) &&
    verifiedAccount.generation === generation ? verifiedAccount : null;
}

export function isAccountCurrent(account: AuthenticatedAccount): boolean {
  return generation === account.generation && verifiedAccount?.userId === account.userId &&
    sameTokens(verifiedAccount.tokens, account.tokens);
}

// Compare-and-replace prevents an in-flight refresh from overwriting a later login.
export async function rotateTokens(expected: TokenPair, rotated: TokenPair): Promise<boolean> {
  const expectedGeneration = generation;
  return serialize(async () => {
    if (!sameTokens(await readTokens(), expected) || generation !== expectedGeneration) return false;
    const owner = verifiedAccount?.userId;
    generation++;
    verifiedAccount = null;
    notifyAccountListeners();
    const rotatedGeneration = generation;
    await writeTokens(rotated);
    if (owner && generation === rotatedGeneration) {
      verifiedAccount = { userId: owner, tokens: rotated, generation };
      notifyAccountListeners();
    }
    return true;
  });
}

/**
 * Persist sensitive JWT authentication tokens exclusively to Expo SecureStore.
 * Never writes to SQLite, AsyncStorage, or logs.
 */
export async function saveTokens(tokens: TokenPair): Promise<void> {
  generation++;
  verifiedAccount = null;
  notifyAccountListeners();
  await serialize(() => writeTokens(tokens));
}

/**
 * Retrieve persisted JWT authentication tokens from Expo SecureStore.
 */
export async function loadTokens(): Promise<TokenPair | null> {
  for (;;) {
    const currentGeneration = generation;
    await mutations;
    const tokens = await readTokens();
    if (currentGeneration === generation) return tokens;
  }
}

/**
 * Remove sensitive JWT authentication tokens from Expo SecureStore.
 */
export async function clearTokens(): Promise<void> {
  generation++;
  verifiedAccount = null;
  notifyAccountListeners();
  await serialize(removeTokens);
}

async function removeTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN),
  ]);
}

export async function clearTokensIfCurrent(expected: TokenPair): Promise<boolean> {
  const expectedGeneration = generation;
  return serialize(async () => {
    if (!sameTokens(await readTokens(), expected) || generation !== expectedGeneration) return false;
    generation++;
    verifiedAccount = null;
    notifyAccountListeners();
    await removeTokens();
    return true;
  });
}
