'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase } from '@/utils/supabase';

export default function ResetPasswordPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { user: _user } = useAuth();
  const { isDarkMode } = useThemeStore();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { oldPassword },
      });

      if (updateError) {
        setError(updateError.message || _('Password update failed'));
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/library');
      }, 2000);
    } catch {
      setError(_('An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold mb-6 text-center">{_('Update Password')}</h1>

        {success ? (
          <div className="alert alert-success">
            <span>{_('Your password has been updated')}</span>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {error && (
              <div className="alert alert-error text-sm py-2">
                <span>{error}</span>
              </div>
            )}

            <div className="form-control">
              <label className="label">
                <span className="label-text">{_('Current Password')}</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">{_('New Password')}</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className={`btn btn-primary w-full ${loading ? 'btn-disabled' : ''}`}
              disabled={loading}
            >
              {loading ? _('Updating password ...') : _('Update password')}
            </button>
          </form>
        )}

        <button
          onClick={() => router.back()}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors ${
            isDarkMode
              ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {_('Back')}
        </button>
      </div>
    </div>
  );
}
