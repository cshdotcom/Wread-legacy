/**
 * WRead Auth Callback Handler
 * Simplified for local JWT-based auth.
 */
import { supabase } from '@/utils/supabase';

interface WReadUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  [key: string]: unknown;
}

interface UseAuthCallbackOptions {
  accessToken?: string | null;
  refreshToken?: string | null;
  login: (accessToken: string, user: WReadUser) => void;
  navigate: (path: string) => void;
  type?: string | null;
  next?: string;
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}

export function handleAuthCallback({
  accessToken,
  refreshToken,
  login,
  navigate,
  type,
  next = '/',
  error,
}: UseAuthCallbackOptions) {
  async function finalizeSession() {
    if (error) {
      navigate('/auth/error');
      return;
    }

    if (!accessToken || !refreshToken) {
      navigate('/library');
      return;
    }

    const { error: err } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (err) {
      console.error('Error setting session:', err);
      navigate('/auth/error');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      login(accessToken, user as WReadUser);
      if (type === 'recovery') {
        navigate('/auth/recovery');
        return;
      }
      navigate(next);
    } else {
      console.error('Error fetching user data');
      navigate('/auth/error');
    }
  }

  finalizeSession();
}
