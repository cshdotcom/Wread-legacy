'use client';

import {
  createContext,
  useState,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
} from 'react';
import { supabase } from '@/utils/supabase';

// WRead: User type compatible with Supabase User but from local JWT
interface WReadUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  aud?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  token: string | null;
  user: WReadUser | null;
  login: (token: string, user: WReadUser) => void;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  });
  const [user, setUser] = useState<WReadUser | null>(() => {
    if (typeof window !== 'undefined') {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    }
    return null;
  });

  useEffect(() => {
    const syncSession = (
      session: { access_token: string; refresh_token: string; user: WReadUser } | null,
    ) => {
      if (session) {
        console.log('Syncing session');
        const { access_token, refresh_token, user } = session;
        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        setToken(access_token);
        setUser(user);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    };

    const refreshSession = async () => {
      try {
        await supabase.auth.refreshSession();
      } catch {
        syncSession(null);
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_, session) => {
      syncSession(session as { access_token: string; refresh_token: string; user: WReadUser } | null);
    });

    refreshSession();
    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback((newToken: string, newUser: WReadUser) => {
    console.log('Logging in');
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    console.log('Logging out');
    try {
      await supabase.auth.refreshSession();
    } catch {
    } finally {
      await supabase.auth.signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      await supabase.auth.refreshSession();
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ token, user, login, logout, refresh }),
    [token, user, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
