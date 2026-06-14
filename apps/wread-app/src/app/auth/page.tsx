'use client';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { IoArrowBack } from 'react-icons/io5';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabase';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { isTauriAppPlatform } from '@/services/environment';
import WindowButtons from '@/components/WindowButtons';

export default function AuthPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const { envConfig, appService } = useEnv();
  const { isDarkMode: _isDarkMode, safeAreaInsets, isRoundedWindow } = useThemeStore();
  const { isTrafficLightVisible } = useTrafficLightStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: false });

  const handleGoBack = () => {
    settings.keepLogin = false;
    setSettings(settings);
    saveSettings(envConfig, settings);
    const redirectTo = new URLSearchParams(window.location.search).get('redirect');
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.back();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || _('Login failed'));
        return;
      }

      if (data?.user && data?.session?.access_token) {
        login(data.session.access_token, data.user);
        const redirectTo = new URLSearchParams(window.location.search).get('redirect');
        router.push(redirectTo ?? '/library');
      }
    } catch (err) {
      setError(_('An error occurred during login'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const loginForm = (
    <form onSubmit={handleLogin} className="w-full max-w-sm mx-auto space-y-4 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-base-content">WRead</h1>
        <p className="text-base-content/60 mt-2 text-sm">{_('Sign in to your account')}</p>
      </div>

      {error && (
        <div className="alert alert-error text-sm py-2">
          <span>{error}</span>
        </div>
      )}

      <div className="form-control">
        <label className="label">
          <span className="label-text text-base-content/75">{_('Email address')}</span>
        </label>
        <input
          type="email"
          placeholder={_('Your email address')}
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text text-base-content/75">{_('Password')}</span>
        </label>
        <input
          type="password"
          placeholder={_('Your password')}
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button
        type="submit"
        className={clsx('btn btn-primary w-full', loading && 'btn-disabled')}
        disabled={loading}
      >
        {loading ? _('Signing in...') : _('Sign in')}
      </button>

      <p className="text-center text-xs text-base-content/50 mt-4">
        {_('Self-hosted personal reading platform')}
      </p>
    </form>
  );

  // For Tauri app platform, wrap in the original layout
  if (isTauriAppPlatform()) {
    return (
      <div
        className={clsx(
          'bg-base-100 full-height inset-0 flex select-none flex-col items-center overflow-hidden',
          appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
        )}
      >
        <div
          className={clsx('flex h-full w-full flex-col items-center overflow-y-auto')}
          style={{
            paddingTop: `${safeAreaInsets?.top || 0}px`,
          }}
        >
          <div
            ref={headerRef}
            className={clsx(
              'fixed z-10 flex w-full items-center justify-between py-2 pe-6 ps-4',
              appService?.hasTrafficLight && 'pt-11',
            )}
          >
            <button
              aria-label={_('Go Back')}
              onClick={handleGoBack}
              className={clsx('btn btn-ghost h-12 min-h-12 w-12 p-0 sm:h-8 sm:min-h-8 sm:w-8')}
            >
              <IoArrowBack className="text-base-content" />
            </button>

            {appService?.hasWindowBar && (
              <WindowButtons
                headerRef={headerRef}
                showMinimize={!isTrafficLightVisible}
                showMaximize={!isTrafficLightVisible}
                showClose={!isTrafficLightVisible}
                onClose={handleGoBack}
              />
            )}
          </div>
          <div
            className={clsx(
              'z-20 flex flex-col items-center pb-8',
              appService?.hasTrafficLight ? 'mt-24' : 'mt-12',
            )}
            style={{ maxWidth: '420px', width: '100%' }}
          >
            {loginForm}
          </div>
        </div>
      </div>
    );
  }

  // For web app
  return (
    <div style={{ maxWidth: '420px', margin: 'auto', padding: '2rem', paddingTop: '4rem' }}>
      <button
        onClick={handleGoBack}
        className="btn btn-ghost fixed left-6 top-6 h-8 min-h-8 w-8 p-0"
      >
        <IoArrowBack className="text-base-content" />
      </button>
      {loginForm}
    </div>
  );
}
