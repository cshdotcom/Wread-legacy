/**
 * WRead: Supabase compatibility shim
 * Replaces the real Supabase client with a local JWT+SQLite based stub.
 * The frontend AuthContext still calls supabase.auth methods,
 * but they are now backed by local WRead auth.
 */
import { getRuntimeConfig } from '@/services/runtimeConfig';

// --- Stub Supabase Auth Client ---
// This provides the same interface as supabase.auth that the frontend uses

const WREAD_AUTH_KEY = 'wread-auth';

function getStoredAuth(): { token: string | null; user: Record<string, unknown> | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const raw = localStorage.getItem(WREAD_AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { token: null, user: null };
}

function setStoredAuth(token: string | null, user: Record<string, unknown> | null): void {
  if (typeof window === 'undefined') return;
  if (token && user) {
    localStorage.setItem(WREAD_AUTH_KEY, JSON.stringify({ token, user }));
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem(WREAD_AUTH_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
  }
}

type AuthStateCallback = (event: string, session: Record<string, unknown> | null) => void;

const authListeners: AuthStateCallback[] = [];

function notifyAuthListeners(event: string, session: Record<string, unknown> | null): void {
  for (const cb of authListeners) {
    try { cb(event, session); } catch {}
  }
}

const supabaseAuth = {
  getSession: async () => {
    const { token, user } = getStoredAuth();
    if (token && user) {
      return { data: { session: { access_token: token, refresh_token: 'local', user } } };
    }
    return { data: { session: null } };
  },

  getUser: async (token?: string) => {
    const auth = getStoredAuth();
    const useToken = token || auth.token;
    if (!useToken) return { data: { user: null }, error: new Error('No token') };

    try {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${useToken}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        return { data: { user: data.user }, error: null };
      }
    } catch {}
    return { data: { user: null }, error: new Error('Invalid token') };
  },

  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { data: { user: null, session: null }, error: new Error(data.error || 'Login failed') };
    }
    setStoredAuth(data.token, data.user);
    notifyAuthListeners('SIGNED_IN', { access_token: data.token, refresh_token: 'local', user: data.user });
    return { data: { user: data.user, session: { access_token: data.token, refresh_token: 'local', user: data.user } }, error: null };
  },

  signInWithOAuth: async () => {
    // OAuth is disabled in WRead
    return { data: { provider: '', url: '' }, error: new Error('OAuth not available in WRead') };
  },

  signInWithIdToken: async () => {
    return { data: { user: null, session: null }, error: new Error('ID token auth not available in WRead') };
  },

  signOut: async () => {
    setStoredAuth(null, null);
    notifyAuthListeners('SIGNED_OUT', null);
    return { error: null };
  },

  setSession: async ({ access_token }: { access_token: string; refresh_token: string }) => {
    // Validate token with backend
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setStoredAuth(access_token, data.user);
        notifyAuthListeners('SIGNED_IN', { access_token, refresh_token: 'local', user: data.user });
        return { data: { user: data.user }, error: null };
      }
    } catch {}
    return { data: { user: null }, error: new Error('Invalid session') };
  },

  refreshSession: async () => {
    const { token } = getStoredAuth();
    if (!token) {
      notifyAuthListeners('SIGNED_OUT', null);
      return { data: { user: null, session: null }, error: null };
    }
    // Try to refresh by validating existing token
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setStoredAuth(token, data.user);
        return { data: { user: data.user, session: { access_token: token, refresh_token: 'local', user: data.user } }, error: null };
      }
    } catch {}
    setStoredAuth(null, null);
    notifyAuthListeners('SIGNED_OUT', null);
    return { data: { user: null, session: null }, error: null };
  },

  updateUser: async (attrs: { password?: string; data?: Record<string, unknown> }) => {
    const { token } = getStoredAuth();
    if (!token) return { data: { user: null }, error: new Error('Not authenticated') };

    const resp = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(attrs),
    });
    const data = await resp.json();
    if (!resp.ok) return { data: { user: null }, error: new Error(data.error || 'Update failed') };

    setStoredAuth(token, data.user);
    return { data: { user: data.user }, error: null };
  },

  onAuthStateChange: (callback: AuthStateCallback) => {
    authListeners.push(callback);
    // Return subscription-like object
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const idx = authListeners.indexOf(callback);
            if (idx >= 0) authListeners.splice(idx, 1);
          },
        },
      },
    };
  },
};

// --- Stub Supabase from() client for direct table queries ---
// Only used by the sync API routes which we've rewritten to use wread-db directly
const supabaseFrom = (_table: string) => ({
  select: (..._cols: string[]) => ({
    eq: (..._args: unknown[]) => ({
      or: (..._args: unknown[]) => ({
        range: (..._args: unknown[]) => ({
          order: (..._args: unknown[]) => Promise.resolve({ data: [], error: null }),
        }),
      }),
      range: (..._args: unknown[]) => ({
        order: (..._args: unknown[]) => Promise.resolve({ data: [], error: null }),
      }),
      order: (..._args: unknown[]) => Promise.resolve({ data: [], error: null }),
    }),
    or: (..._args: unknown[]) => ({
      range: (..._args: unknown[]) => ({
        order: (..._args: unknown[]) => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
  insert: (_rows: unknown[]) => Promise.resolve({ data: [], error: null }),
  update: (_data: unknown) => ({
    eq: (..._args: unknown[]) => ({
      lt: (..._args: unknown[]) => Promise.resolve({ data: [], error: null }),
    }),
  }),
  upsert: (_rows: unknown[], _opts?: unknown) => ({
    select: () => Promise.resolve({ data: [], error: null }),
  }),
  delete: () => ({
    eq: (..._args: unknown[]) => Promise.resolve({ data: [], error: null }),
  }),
});

// --- Exported supabase stub ---
export const supabase = {
  auth: supabaseAuth,
  from: supabaseFrom,
};

export const createSupabaseClient = (_accessToken?: string) => {
  // In WRead, all API routes use wread-db directly, so this is just a stub
  return supabase;
};

export const createSupabaseAdminClient = () => {
  return supabase;
};
