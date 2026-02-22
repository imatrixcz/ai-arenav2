import { useState } from 'react';
import { Settings, User, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api/client';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPasswordError(msg || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    try {
      await authApi.resendVerification(user.email);
      await refreshUser();
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-primary-400" />
          Settings
        </h1>
        <p className="text-dark-400 mt-1">Manage your account</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Profile Section */}
        <div className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-dark-400" />
            Profile
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-dark-400">Name</span>
              <span className="text-sm text-white">{user?.displayName}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-dark-800">
              <span className="text-sm text-dark-400">Email</span>
              <span className="text-sm text-white">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-dark-800">
              <span className="text-sm text-dark-400">Email Verified</span>
              <div className="flex items-center gap-2">
                {user?.emailVerified ? (
                  <span className="flex items-center gap-1 text-sm text-accent-emerald">
                    <CheckCircle className="w-4 h-4" /> Verified
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm text-amber-400">
                      <AlertCircle className="w-4 h-4" /> Not verified
                    </span>
                    <button
                      onClick={handleResendVerification}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      Resend
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-dark-800">
              <span className="text-sm text-dark-400">Auth Methods</span>
              <div className="flex gap-2">
                {user?.authMethods.map((method) => (
                  <span key={method} className="px-2 py-0.5 bg-dark-800 rounded text-xs text-dark-300 capitalize">
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-dark-900/50 backdrop-blur-sm border border-dark-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-dark-400" />
            Change Password
          </h2>

          {passwordError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="mb-4 bg-accent-emerald/10 border border-accent-emerald/20 rounded-lg p-3 text-sm text-accent-emerald">{passwordSuccess}</div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                placeholder="Min 10 chars, mixed case, number, special"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="py-2.5 px-6 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium rounded-lg hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
