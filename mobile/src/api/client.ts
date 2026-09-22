import { clearTokens, loadTokens, saveTokens, TokenPair } from '../auth/tokenStore';

export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';
}

export const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: any,
    message?: string
  ) {
    super(message || `API error with status ${status}`);
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(status: number, data: any, message?: string) {
    super(status, data, message || 'Authentication failed');
    this.name = 'AuthenticationError';
  }
}

type AuthCallback = () => void;
type TokenCallback = (tokens: TokenPair) => void;

let onAuthFailureCallback: AuthCallback | null = null;
let onTokenRotatedCallback: TokenCallback | null = null;
let refreshPromise: Promise<TokenPair | null> | null = null;

export function registerAuthFailureHandler(callback: AuthCallback | null): void {
  onAuthFailureCallback = callback;
}

export function registerTokenRotatedHandler(callback: TokenCallback | null): void {
  onTokenRotatedCallback = callback;
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
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
  const { requiresAuth = true, _retry = false, headers, ...rest } = options;

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  let tokens: TokenPair | null = null;
  if (requiresAuth) {
    tokens = await loadTokens();
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
      const newTokens = await refreshTokensOnce();
      if (newTokens) {
        return apiClient<T>(endpoint, {
          ...options,
          _retry: true,
        });
      }
    } catch {
      await clearTokens();
      if (onAuthFailureCallback) {
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

  return response.json();
}

/**
 * Handle concurrent token refresh with a single shared promise to prevent multiple refresh calls.
 */
async function refreshTokensOnce(): Promise<TokenPair | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const currentTokens = await loadTokens();
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

      await saveTokens(rotated);
      if (onTokenRotatedCallback) {
        onTokenRotatedCallback(rotated);
      }
      return rotated;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
