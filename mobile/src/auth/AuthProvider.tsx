import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { clearTokens, loadTokens, saveTokens } from './tokenStore';
import { apiClient, registerAuthFailureHandler } from '../api/client';
import { setInterfaceLanguage } from '../i18n';
import { getLearnerProfile } from '../profile/api';
import { LearnerProfile } from '../profile/types';

interface ApiTokenResponse { access_token: string; refresh_token: string; token_type: string; must_change_password: boolean; }

export type AuthStatus = 'loading' | 'signedOut' | 'mustChangePassword' | 'signedIn';

export interface AuthUser {
  /** Backend users.id from /users/me.user_id, never the learner profile UUID. */
  id?: string;
  profileId?: string;
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

function authUserFromProfile(profile: LearnerProfile): AuthUser {
  // /users/me is a normal protected route; temporary-password accounts cannot access it.
  return { id: profile.userId, profileId: profile.id, email: profile.email, participantCode: profile.participantCode,
    interfaceLanguage: profile.interfaceLanguage, targetLearningLanguage: profile.targetLearningLanguage, mustChangePassword: false };
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const sessionActions = useRef(0);

  // Restore session from SecureStore on application startup
  useEffect(() => {
    let isMounted = true;
    const restorationAction = sessionActions.current;
    const isRestorationCurrent = () => isMounted && sessionActions.current === restorationAction;

    async function restoreSession() {
      try {
        const tokens = await loadTokens();
        if (!tokens) {
          if (isRestorationCurrent()) {
            setStatus('signedOut');
          }
          return;
        }

        // Fetch authenticated user profile
        const data = await getLearnerProfile();
        if (isRestorationCurrent()) {
          const authUser = authUserFromProfile(data);
          setUser(authUser);

          if (authUser.interfaceLanguage) {
            await setInterfaceLanguage(authUser.interfaceLanguage);
          }
          if (!isRestorationCurrent()) return;

          if (authUser.mustChangePassword) {
            setStatus('mustChangePassword');
          } else {
            setStatus('signedIn');
          }
        }
      } catch {
        // A transport/service failure does not reject credentials. The API client
        // owns guarded invalidation after genuine refresh rejection. Leave identity
        // unverified until a later online restoration/login succeeds.
        if (isRestorationCurrent()) {
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
    const data = await apiClient<ApiTokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      requiresAuth: false,
    });

    await saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });
    sessionActions.current++;

    const mustChange = data.must_change_password;
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
        const profile = await getLearnerProfile();
        setUser(authUserFromProfile(profile));
        if (profile.interfaceLanguage) {
          await setInterfaceLanguage(profile.interfaceLanguage);
        }
      } catch {
        // ignore background fetch error
      }
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const data = await apiClient<ApiTokenResponse>('/auth/change-password', {
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
    sessionActions.current++;

    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    setStatus('signedIn');

    // Fetch refreshed profile
    try {
      const profile = await getLearnerProfile();
      setUser(authUserFromProfile(profile));
      if (profile.interfaceLanguage) {
        await setInterfaceLanguage(profile.interfaceLanguage);
      }
    } catch {
      // ignore
    }
  };

  const logout = async (): Promise<void> => {
    sessionActions.current++;
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
      const profile = await getLearnerProfile();
      setUser(authUserFromProfile(profile));
      if (profile.interfaceLanguage) {
        await setInterfaceLanguage(profile.interfaceLanguage);
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
