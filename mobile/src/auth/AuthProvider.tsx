import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { clearTokens, loadTokens, saveTokens } from './tokenStore';
import { apiClient, registerAuthFailureHandler } from '../api/client';
import { setInterfaceLanguage } from '../i18n';

export type AuthStatus = 'loading' | 'signedOut' | 'mustChangePassword' | 'signedIn';

export interface AuthUser {
  /** Backend users.id from /users/me.user_id, never the learner profile UUID. */
  id?: string;
  email?: string;
  participantCode?: string;
  mustChangePassword?: boolean;
  interfaceLanguage?: 'en' | 'fil' | null;
  targetLearningLanguage?: 'en' | 'fil' | null;
}

export interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restore session from SecureStore on application startup
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const tokens = await loadTokens();
        if (!tokens) {
          if (isMounted) {
            setStatus('signedOut');
          }
          return;
        }

        // Fetch authenticated user profile
        const data = await apiClient('/users/me', { requiresAuth: true });
        if (isMounted) {
          const authUser: AuthUser = {
            id: data.user_id,
            email: data.email,
            participantCode: data.participant_code,
            mustChangePassword: data.must_change_password ?? false,
            interfaceLanguage: data.interface_language ?? null,
            targetLearningLanguage: data.target_learning_language ?? null,
          };
          setUser(authUser);

          if (authUser.interfaceLanguage) {
            await setInterfaceLanguage(authUser.interfaceLanguage);
          }

          if (authUser.mustChangePassword) {
            setStatus('mustChangePassword');
          } else {
            setStatus('signedIn');
          }
        }
      } catch {
        // If profile fetch fails due to invalid/revoked tokens
        await clearTokens();
        if (isMounted) {
          setUser(null);
          setStatus('signedOut');
        }
      }
    }

    registerAuthFailureHandler(() => {
      if (isMounted) {
        setUser(null);
        setStatus('signedOut');
      }
    });

    restoreSession();

    return () => {
      isMounted = false;
      registerAuthFailureHandler(null);
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const data = await apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      requiresAuth: false,
    });

    await saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });

    const mustChange = Boolean(data.must_change_password);
    const authUser: AuthUser = {
      email,
      mustChangePassword: mustChange,
    };
    setUser(authUser);

    if (mustChange) {
      setStatus('mustChangePassword');
    } else {
      setStatus('signedIn');
      // Fetch full profile in background
      try {
        const profile = await apiClient('/users/me');
        setUser({
          id: profile.user_id,
          email: profile.email,
          participantCode: profile.participant_code,
          mustChangePassword: false,
          interfaceLanguage: profile.interface_language ?? null,
          targetLearningLanguage: profile.target_learning_language ?? null,
        });
        if (profile.interface_language) {
          await setInterfaceLanguage(profile.interface_language);
        }
      } catch {
        // ignore background fetch error
      }
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const data = await apiClient('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
      requiresAuth: true,
    });

    await saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });

    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    setStatus('signedIn');

    // Fetch refreshed profile
    try {
      const profile = await apiClient('/users/me');
      setUser({
        id: profile.user_id,
        email: profile.email,
        participantCode: profile.participant_code,
        mustChangePassword: false,
        interfaceLanguage: profile.interface_language ?? null,
        targetLearningLanguage: profile.target_learning_language ?? null,
      });
      if (profile.interface_language) {
        await setInterfaceLanguage(profile.interface_language);
      }
    } catch {
      // ignore
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const tokens = await loadTokens();
      if (tokens?.refreshToken) {
        await apiClient('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: tokens.refreshToken }),
          requiresAuth: true,
        }).catch(() => {});
      }
    } finally {
      await clearTokens();
      setUser(null);
      setStatus('signedOut');
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const profile = await apiClient('/users/me');
      setUser((prev) => ({
        ...prev,
        id: profile.user_id,
        email: profile.email,
        participantCode: profile.participant_code,
        mustChangePassword: profile.must_change_password ?? false,
        interfaceLanguage: profile.interface_language ?? null,
        targetLearningLanguage: profile.target_learning_language ?? null,
      }));
      if (profile.interface_language) {
        await setInterfaceLanguage(profile.interface_language);
      }
    } catch {
      // handled by apiClient
    }
  };

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      changePassword,
      logout,
      refreshProfile,
    }),
    [status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
