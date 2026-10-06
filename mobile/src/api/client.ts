import {
  bindAuthenticatedAccount, clearTokensIfCurrent, isAccountCurrent,
  loadAuthenticatedAccount, loadTokens, rotateTokens, sameTokens, TokenPair,
} from '../auth/tokenStore';

export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';
}

export const API_BASE_URL = getApiBaseUrl();

export function normalizeApiErrorMessage(data: any, status?: number): string {
  if (!data) {
    return status ? `Request failed with status ${status}` : 'An unexpected error occurred';
  }

  // Case 1: detail is a string
  if (typeof data.detail === 'string' && data.detail.trim().length > 0) {
    return data.detail.trim();
  }

  // Case 2: detail is an array of Pydantic validation errors
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    const messages = data.detail
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.msg === 'string') {
          return item.msg;
        }
        return null;
      })
      .filter((msg: string | null): msg is string => Boolean(msg && msg.trim().length > 0));

    if (messages.length > 0) {
      return messages.join('. ');
    }
  }

  // Case 3: data itself is directly an array of errors
  if (Array.isArray(data) && data.length > 0) {
    const messages = data
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.msg === 'string') {
          return item.msg;
        }
        return null;
      })
      .filter((msg: string | null): msg is string => Boolean(msg && msg.trim().length > 0));

    if (messages.length > 0) {
      return messages.join('. ');
    }
  }

  // Case 4: data.message is a string
  if (typeof data.message === 'string' && data.message.trim().length > 0) {
    return data.message.trim();
  }

  // Case 5: data itself is a string
  if (typeof data === 'string' && data.trim().length > 0) {
    return data.trim();
  }

  return status ? `Request failed with status ${status}` : 'An unexpected error occurred';
}

export function getApiErrorMessage(err: unknown, fallbackMessage?: string): string {
  if (err instanceof ApiError) {
    return err.normalizedMessage || err.message || fallbackMessage || 'An unexpected error occurred';
  }
  if (err && typeof err === 'object') {
    const anyErr = err as any;
    if (typeof anyErr.normalizedMessage === 'string' && anyErr.normalizedMessage.trim().length > 0) {
      return anyErr.normalizedMessage.trim();
    }
    if (anyErr.data) {
      const normalized = normalizeApiErrorMessage(anyErr.data, anyErr.status);
      if (normalized && normalized.trim().length > 0) return normalized;
    }
    if (typeof anyErr.message === 'string' && anyErr.message.trim().length > 0) {
      return anyErr.message.trim();
    }
  }
  return fallbackMessage || 'An unexpected error occurred';
}

export class ApiError extends Error {
  public normalizedMessage: string;

  constructor(
    public status: number,
    public data: any,
    message?: string
  ) {
    const resolvedMessage = message || normalizeApiErrorMessage(data, status);
    super(resolvedMessage);
    this.name = 'ApiError';
    this.normalizedMessage = resolvedMessage;
  }
}

export class AuthenticationError extends ApiError {
  constructor(status: number, data: any, message?: string) {
    super(status, data, message || normalizeApiErrorMessage(data, status) || 'Authentication failed');
    this.name = 'AuthenticationError';
  }
}

type AuthCallback = () => void;
type TokenCallback = (tokens: TokenPair) => void;

let onAuthFailureCallback: AuthCallback | null = null;
let onTokenRotatedCallback: TokenCallback | null = null;
let refreshPromise: Promise<TokenPair | null> | null = null;
let refreshingTokens: TokenPair | null = null;

export function registerAuthFailureHandler(callback: AuthCallback | null): void {
  onAuthFailureCallback = callback;
}

export function registerTokenRotatedHandler(callback: TokenCallback | null): void {
  onTokenRotatedCallback = callback;
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  expectedUserId?: string;
  _retry?: boolean;
}

/**
 * Single authenticated API client.
 * Automatically adds Bearer token, handles single 401 token refresh with rotation,
 * retries the request once, and avoids infinite loops.
 */
export async function apiClient<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, expectedUserId, _retry = false, headers, ...rest } = options;

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  let tokens: TokenPair | null = null;
  const account = expectedUserId ? await loadAuthenticatedAccount() : null;
  if (expectedUserId && (!requiresAuth || !account || account.userId !== expectedUserId || !isAccountCurrent(account))) {
    throw new AuthenticationError(401, null, 'Review account changed or is not verified.');
  }
  if (requiresAuth) {
    tokens = account ? account.tokens : await loadTokens();
    if (tokens?.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${tokens.accessToken}`;
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
  });

  if (response.status === 401 && requiresAuth && !_retry) {
    // Avoid refresh loops on auth endpoints themselves
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh')) {
      const errorData = await response.json().catch(() => ({}));
      throw new AuthenticationError(401, errorData, 'Authentication failed');
    }

    // Refresh tokens once
    try {
      if (!tokens) throw new Error('No authenticated session');
      const newTokens = await refreshTokensOnce(tokens);
      if (newTokens) {
        return apiClient<T>(endpoint, {
          ...options,
          _retry: true,
        });
      }
    } catch {
      const cleared = tokens ? await clearTokensIfCurrent(tokens) : false;
      if (cleared && onAuthFailureCallback) {
        onAuthFailureCallback();
      }
      throw new AuthenticationError(401, null, 'Session expired. Please log in again.');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new AuthenticationError(response.status, errorData);
    }
    throw new ApiError(response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  if (endpoint === '/users/me' && requiresAuth && tokens && typeof data.user_id === 'string') {
    await bindAuthenticatedAccount(data.user_id, tokens);
  }
  return data;
}

/**
 * Handle concurrent token refresh with a single shared promise to prevent multiple refresh calls.
 */
async function refreshTokensOnce(originalTokens: TokenPair): Promise<TokenPair | null> {
  if (!sameTokens(await loadTokens(), originalTokens)) {
    throw new AuthenticationError(401, null, 'Authenticated account changed.');
  }
  if (refreshPromise) {
    if (!sameTokens(refreshingTokens, originalTokens)) {
      throw new AuthenticationError(401, null, 'Authenticated account changed.');
    }
    return refreshPromise;
  }

  refreshingTokens = originalTokens;
  refreshPromise = (async () => {
    try {
      const currentTokens = originalTokens;
      if (!currentTokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentTokens.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Refresh token rejected');
      }

      const data = await response.json();
      const rotated: TokenPair = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };

      if (!await rotateTokens(currentTokens, rotated)) {
        throw new AuthenticationError(401, null, 'Authenticated account changed.');
      }
      if (onTokenRotatedCallback) {
        onTokenRotatedCallback(rotated);
      }
      return rotated;
    } finally {
      refreshPromise = null;
      refreshingTokens = null;
    }
  })();

  return refreshPromise;
}
