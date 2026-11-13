import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bell,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Save,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  User,
} from 'lucide-react';

import { PageHero } from '../../components/ui/kit-core';
import { apiClient } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Analyst profile & settings (`/app/analyst-settings`).
 *
 * Every control here writes to a real endpoint: name and avatar to the user
 * record, password to `/auth/password`, and the alert/threshold preferences to
 * `/auth/security-settings`. Controls the product does not implement (themes,
 * push notifications, account deletion) are not shown at all.
 */

interface AnalystProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  authProvider: string;
  profilePicture: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  lastPasswordChange: string | null;
  securitySettings?: {
    emailNotifications: boolean;
    loginAlerts: boolean;
    sessionTimeout: number;
  };
}

const getProfile = async (): Promise<AnalystProfile> => {
  const { data } = await apiClient.get<{ data: AnalystProfile }>('/auth/profile');
  return data.data;
};

const updateName = async (payload: { firstName: string; lastName: string }) => {
  const { data } = await apiClient.patch<{ data: unknown }>('/users/me', payload);
  return data.data;
};

const uploadAvatar = async (file: File): Promise<{ avatarUrl: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await apiClient.post<{ data: { avatarUrl: string } }>('/auth/avatar', formData, {
    headers: { 'Content-Type': undefined as unknown as string },
  });
  return data.data;
};

const deleteAvatar = async (): Promise<void> => {
  await apiClient.delete('/auth/avatar');
};

const changePassword = async (payload: { currentPassword: string; newPassword: string }) => {
  await apiClient.put('/auth/password', payload);
};

const saveSecuritySettings = async (settings: {
  emailNotifications: boolean;
  loginAlerts: boolean;
  sessionTimeout: number;
}) => {
  const { data } = await apiClient.put<{ data: typeof settings }>('/auth/security-settings', settings);
  return data.data;
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

type TabId = 'profile' | 'security' | 'alerts';

export default function AnalystSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user, setUser } = useAuth();

  const [nameForm, setNameForm] = useState({ firstName: '', lastName: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [security, setSecurity] = useState({
    emailNotifications: true,
    loginAlerts: true,
    sessionTimeout: 30,
  });

  const profileQuery = useQuery({ queryKey: ['analyst-profile'], queryFn: getProfile });
  const profile = profileQuery.data;

  useEffect(() => {
    if (!profile) return;
    setNameForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
    });
    if (profile.securitySettings) setSecurity(profile.securitySettings);
  }, [profile]);

  const flash = (kind: 'success' | 'error', text: string) => {
    setBanner({ kind, text });
    window.setTimeout(() => setBanner(null), 4000);
  };

  const nameMutation = useMutation({
    mutationFn: () => updateName({ firstName: nameForm.firstName.trim(), lastName: nameForm.lastName.trim() }),
    onSuccess: () => {
      if (user) {
        setUser({
          ...user,
          firstName: nameForm.firstName.trim(),
          lastName: nameForm.lastName.trim(),
          name: [nameForm.firstName.trim(), nameForm.lastName.trim()].filter(Boolean).join(' ') || user.email,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['analyst-profile'] });
      flash('success', 'Profile updated.');
    },
    onError: (error: any) =>
      flash('error', error?.response?.data?.message || 'Could not update your profile.'),
  });

  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (data) => {
      if (user) setUser({ ...user, avatar: data.avatarUrl });
      void queryClient.invalidateQueries({ queryKey: ['analyst-profile'] });
      flash('success', 'Avatar updated.');
    },
    onError: (error: any) =>
      flash('error', error?.response?.data?.message || 'Could not upload that image.'),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      if (user) setUser({ ...user, avatar: undefined });
      void queryClient.invalidateQueries({ queryKey: ['analyst-profile'] });
      flash('success', 'Avatar removed.');
    },
    onError: () => flash('error', 'Could not remove the avatar.'),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      void queryClient.invalidateQueries({ queryKey: ['analyst-profile'] });
      flash('success', 'Password changed.');
    },
    onError: (error: any) =>
      flash('error', error?.response?.data?.message || 'Could not change the password.'),
  });

  const securityMutation = useMutation({
    mutationFn: () => saveSecuritySettings(security),
    onSuccess: (saved) => {
      if (user) setUser({ ...user, sessionTimeout: saved.sessionTimeout });
      void queryClient.invalidateQueries({ queryKey: ['analyst-profile'] });
      flash('success', 'Preferences saved.');
    },
    onError: (error: any) =>
      flash('error', error?.response?.data?.message || 'Could not save the preferences.'),
  });

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      flash('error', 'The new password must be at least 8 characters.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(passwordForm.newPassword)) {
      flash('error', 'Use upper and lower case letters, a number and a symbol.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      flash('error', 'The new password and its confirmation do not match.');
      return;
    }
    passwordMutation.mutate();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash('error', 'Choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash('error', 'Avatars must be 5MB or smaller.');
      return;
    }
    avatarMutation.mutate(file);
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'alerts', label: 'Preferences', icon: <Bell className="w-4 h-4" /> },
  ];

  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.email || 'Analyst';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageHero
        icon={SettingsIcon}
        title="Profile & Settings"
        description="Your analyst account, password and session preferences"
        accent="slate"
      />

      <div className="p-6">
        {banner && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 ${
              banner.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            {banner.kind === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <p className="font-semibold">{banner.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-xl">
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border border-white/10 bg-slate-700/50 text-white'
                        : 'text-gray-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {profileQuery.isLoading && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-gray-400">
                Loading your account…
              </div>
            )}

            {profileQuery.isError && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
                Could not load your profile. Reload the page to try again.
              </div>
            )}

            {profile && activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                  <h3 className="mb-6 text-lg font-semibold text-white">Profile Information</h3>

                  <div className="mb-8 flex flex-wrap items-center gap-6">
                    <div className="relative">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 text-3xl font-semibold text-white">
                        {profile.profilePicture ? (
                          <img
                            src={profile.profilePicture}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 rounded-full bg-slate-700 p-2 transition-colors hover:bg-slate-600"
                        aria-label="Change profile picture"
                      >
                        <Camera className="h-4 w-4 text-white" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <h4 className="mb-1 font-medium text-white">Profile picture</h4>
                      <p className="text-sm text-gray-400">JPG or PNG, up to 5MB.</p>
                      <div className="mt-2 flex gap-3 text-sm">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarMutation.isPending}
                          className="font-semibold text-sky-300 hover:text-sky-200 disabled:opacity-50"
                        >
                          {avatarMutation.isPending ? 'Uploading…' : 'Upload image'}
                        </button>
                        {profile.profilePicture && (
                          <button
                            onClick={() => removeAvatarMutation.mutate()}
                            disabled={removeAvatarMutation.isPending}
                            className="inline-flex items-center gap-1 font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <form
                    className="space-y-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      nameMutation.mutate();
                    }}
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">First name</label>
                        <input
                          value={nameForm.firstName}
                          onChange={(event) => setNameForm({ ...nameForm, firstName: event.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Last name</label>
                        <input
                          value={nameForm.lastName}
                          onChange={(event) => setNameForm({ ...nameForm, lastName: event.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-slate-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Email</label>
                        <input
                          value={profile.email}
                          readOnly
                          className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-slate-800/20 px-4 py-2 text-gray-400"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Email changes are handled by an administrator.
                        </p>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Role</label>
                        <input
                          value={profile.role.toLowerCase().replace('_', ' ')}
                          readOnly
                          className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-slate-800/20 px-4 py-2 capitalize text-gray-400"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Sign-in method: {profile.authProvider === 'google' ? 'Google' : 'email & password'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={nameMutation.isPending}
                        className="flex items-center gap-2 rounded-xl bg-slate-600/20 px-5 py-2.5 font-semibold text-slate-200 transition-colors hover:bg-slate-600/30 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {nameMutation.isPending ? 'Saving…' : 'Save profile'}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                  <h3 className="mb-4 text-lg font-semibold text-white">Account</h3>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-400">Member since</dt>
                      <dd className="font-semibold text-white">{formatDate(profile.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-400">Last sign-in</dt>
                      <dd className="font-semibold text-white">{formatDate(profile.lastLoginAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-400">Last password change</dt>
                      <dd className="font-semibold text-white">{formatDate(profile.lastPasswordChange)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-400">Account status</dt>
                      <dd className={`font-semibold ${profile.isActive ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {profile.isActive ? 'Active' : 'Disabled'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {profile && activeTab === 'security' && (
              <div className="space-y-6">
                {profile.authProvider === 'google' ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-sm text-gray-300">
                    This account signs in with Google, so there is no password to change here.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                    <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white">
                      <Lock className="h-4 w-4" /> Change password
                    </h3>

                    <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-300">Current password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm({ ...passwordForm, currentPassword: event.target.value })
                          }
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-slate-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-300">New password</label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={(event) =>
                              setPasswordForm({ ...passwordForm, newPassword: event.target.value })
                            }
                            autoComplete="new-password"
                            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-slate-500"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-300">
                            Confirm new password
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={(event) =>
                              setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })
                            }
                            autoComplete="new-password"
                            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-slate-500"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showPassword ? 'Hide passwords' : 'Show passwords'}
                        </button>
                        <button
                          type="submit"
                          disabled={passwordMutation.isPending}
                          className="flex items-center gap-2 rounded-xl bg-slate-600/20 px-5 py-2.5 font-semibold text-slate-200 transition-colors hover:bg-slate-600/30 disabled:opacity-50"
                        >
                          <Shield className="h-4 w-4" />
                          {passwordMutation.isPending ? 'Updating…' : 'Update password'}
                        </button>
                      </div>

                      <p className="text-xs text-gray-500">
                        At least 8 characters, with upper and lower case letters, a number and a symbol.
                      </p>
                    </form>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                  <h3 className="mb-4 text-lg font-semibold text-white">Session</h3>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-300">
                        Sign out after (minutes of inactivity)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={security.sessionTimeout}
                        onChange={(event) =>
                          setSecurity({
                            ...security,
                            sessionTimeout: Number(event.target.value) || security.sessionTimeout,
                          })
                        }
                        className="w-40 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2 text-white focus:border-transparent focus:ring-2 focus:ring-slate-500"
                      />
                    </div>
                    <button
                      onClick={() => securityMutation.mutate()}
                      disabled={securityMutation.isPending}
                      className="flex items-center gap-2 rounded-xl bg-slate-600/20 px-5 py-2.5 font-semibold text-slate-200 transition-colors hover:bg-slate-600/30 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {securityMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Applies to every page in the app; between 5 and 120 minutes.
                  </p>
                </div>
              </div>
            )}

            {profile && activeTab === 'alerts' && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                <h3 className="mb-6 text-lg font-semibold text-white">Notifications</h3>

                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start gap-4 rounded-xl bg-slate-800/30 p-4 transition-colors hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      checked={security.emailNotifications}
                      onChange={(event) =>
                        setSecurity({ ...security, emailNotifications: event.target.checked })
                      }
                      className="mt-1 h-5 w-5 rounded border-white/20 bg-slate-700"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white">Email notifications</div>
                      <div className="text-sm text-gray-400">
                        Receive product and account updates by email.
                      </div>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-4 rounded-xl bg-slate-800/30 p-4 transition-colors hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      checked={security.loginAlerts}
                      onChange={(event) => setSecurity({ ...security, loginAlerts: event.target.checked })}
                      className="mt-1 h-5 w-5 rounded border-white/20 bg-slate-700"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white">Login alerts</div>
                      <div className="text-sm text-gray-400">
                        Get an in-app notification when your account signs in.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => securityMutation.mutate()}
                    disabled={securityMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-slate-600/20 px-5 py-2.5 font-semibold text-slate-200 transition-colors hover:bg-slate-600/30 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {securityMutation.isPending ? 'Saving…' : 'Save preferences'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
