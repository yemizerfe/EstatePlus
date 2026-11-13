import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  changeMyPassword,
  getMyProfile,
  removeMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
} from '../../api/users';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const SETTINGS_KEY = 'estateplus.app-settings';

const defaultSettings = {
  emailNotifications: true,
  priceAlerts: true,
  weeklyReports: true,
  marketDigest: false,
  profileVisibility: 'Private',
  defaultView: 'List',
};

type AppSettings = typeof defaultSettings;

const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

const passwordChecks = (pw: string) => ({
  length: pw.length >= 8,
  upper: /[A-Z]/.test(pw),
  lower: /[a-z]/.test(pw),
  number: /\d/.test(pw),
});

const prettyRole = (role: string) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const prettyProvider = (provider: string) =>
  provider.charAt(0).toUpperCase() + provider.slice(1);

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export default function ProfileSettingsPage() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'settings'>('profile');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: getMyProfile,
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
    }
  }, [profile]);

  const refreshProfile = () => queryClient.invalidateQueries({ queryKey: ['my-profile'] });

  const saveProfileMutation = useMutation({
    mutationFn: () => updateMyProfile({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: async (updated) => {
      await refreshProfile();
      if (user) setUser({ ...user, name: `${updated.firstName} ${updated.lastName}`.trim() });
      setBanner({ kind: 'success', text: 'Profile updated successfully.' });
    },
    onError: (err: any) =>
      setBanner({ kind: 'error', text: err.response?.data?.message || 'Could not update your profile.' }),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess: async (result) => {
      await refreshProfile();
      if (user) setUser({ ...user, avatar: result.profilePicture });
      setBanner({ kind: 'success', text: 'Avatar updated.' });
    },
    onError: (err: any) =>
      setBanner({ kind: 'error', text: err.response?.data?.message || 'Could not upload the image.' }),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: removeMyAvatar,
    onSuccess: async () => {
      await refreshProfile();
      if (user) setUser({ ...user, avatar: undefined });
      setBanner({ kind: 'success', text: 'Avatar removed.' });
    },
    onError: (err: any) =>
      setBanner({ kind: 'error', text: err.response?.data?.message || 'Could not remove the avatar.' }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => changeMyPassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setBanner({ kind: 'success', text: 'Password changed successfully.' });
    },
    onError: (err: any) =>
      setBanner({ kind: 'error', text: err.response?.data?.message || 'Could not change the password.' }),
  });

  const handleAvatarSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBanner({ kind: 'error', text: 'Please choose an image file (JPG, PNG or WebP).' });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setBanner({ kind: 'error', text: 'Image is too large. Maximum size is 2MB.' });
      return;
    }
    uploadAvatarMutation.mutate(file);
  };

  const checks = passwordChecks(newPassword);
  const allChecksPass = Object.values(checks).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword;
  const canSubmitPassword =
    currentPassword.length > 0 && allChecksPass && passwordsMatch && !changePasswordMutation.isPending;

  const isGoogleAccount = !!profile && (
    profile.authProvider?.toLowerCase() === 'google' ||
    !!profile.googleId ||
    (!profile.passwordHash && profile.authProvider?.toLowerCase() === 'local')
  );
  const canManagePassword = !!profile && !isGoogleAccount;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setBanner({ kind: 'error', text: 'New passwords do not match.' });
      return;
    }
    changePasswordMutation.mutate();
  };

  const initials = profile
    ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
    : '';
  const avatarSrc = profile?.profilePicture || undefined;
  const busy = uploadAvatarMutation.isPending || removeAvatarMutation.isPending;

  const toggleSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const settingRows: { key: keyof AppSettings; label: string; hint: string }[] = [
    { key: 'emailNotifications', label: 'Email notifications', hint: 'Property updates and account alerts' },
    { key: 'priceAlerts', label: 'Price alerts', hint: 'Get notified when saved homes change price' },
    { key: 'weeklyReports', label: 'Weekly market reports', hint: 'Neighborhood and pricing summaries every week' },
    { key: 'marketDigest', label: 'Market digest', hint: 'A quick summary of matching opportunities' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-2 mb-2">
            <UserRound className="w-5 h-5 text-cyan-300" />
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-slate-300">Account</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Profile &amp; settings</h1>
          <p className="mt-2 text-slate-300">Manage your account, security, and the way the app works for you.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5 shadow-2xl shadow-slate-950/40">
          {([
            ['profile', 'Profile', <UserRound key="p" className="w-4 h-4" />],
            ['security', 'Security', <ShieldCheck key="s" className="w-4 h-4" />],
            ['settings', 'App settings', <SlidersHorizontal key="n" className="w-4 h-4" />],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {banner && (
          <div
            className={`mb-6 flex items-center justify-between rounded-2xl border p-4 text-sm ${
              banner.kind === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            <span className="flex items-center gap-2">
              {banner.kind === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {banner.text}
            </span>
            <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" className="opacity-70 transition hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLoading || !profile ? (
          <div className="flex items-center justify-center py-24 text-slate-300">
            <Loader2 className="mr-3 h-6 w-6 animate-spin text-cyan-300" />
            Loading your profile...
          </div>
        ) : activeTab === 'profile' ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
              <h2 className="mb-1 text-lg font-bold text-white">Profile photo</h2>
              <p className="mb-6 text-sm text-slate-400">JPG, PNG or WebP — up to 2MB</p>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative w-fit">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-700 to-slate-500 ring-4 ring-slate-200/80">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Your avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-semibold text-white">{initials}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    aria-label="Upload avatar"
                    title="Upload avatar"
                    className="absolute bottom-0 right-0 rounded-full bg-slate-900 p-2 text-white shadow-lg ring-2 ring-slate-600 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col items-start gap-3">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelected} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
                  >
                    {uploadAvatarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {uploadAvatarMutation.isPending ? 'Uploading...' : 'Upload new photo'}
                  </button>
                  {avatarSrc && (
                    <button
                      type="button"
                      onClick={() => removeAvatarMutation.mutate()}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
              <h2 className="mb-6 text-lg font-bold text-white">Personal information</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={profile.email}
                      readOnly
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-3 py-2.5 text-slate-300"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Email updates are currently disabled for security and account integrity.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Role</label>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-sm font-medium text-slate-200">
                    <BadgeCheck className="h-4 w-4 text-emerald-400" />
                    {prettyRole(profile.role)}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => saveProfileMutation.mutate()}
                  disabled={saveProfileMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
                >
                  {saveProfileMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saveProfileMutation.isPending ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'security' ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
              <div className="mb-1 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-bold text-white">Change password</h2>
              </div>

              {canManagePassword ? (
                <>
                  <p className="mb-6 text-sm text-slate-400">
                    Use at least 8 characters with upper and lower case letters and a number.
                  </p>

                  <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">Current password</label>
                      <div className="relative">
                        <input
                          type={showCurrent ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 pr-10 text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent((v) => !v)}
                          aria-label={showCurrent ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">New password</label>
                      <div className="relative">
                        <input
                          type={showNew ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 pr-10 text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          aria-label={showNew ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {newPassword.length > 0 && (
                        <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-slate-300">
                          {([
                            ['At least 8 characters', checks.length],
                            ['An uppercase letter', checks.upper],
                            ['A lowercase letter', checks.lower],
                            ['A number', checks.number],
                          ] as [string, boolean][]).map(([label, ok]) => (
                            <li key={label} className={`flex items-center gap-1.5 ${ok ? 'text-emerald-300' : 'text-slate-400'}`}>
                              {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                              {label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">Confirm new password</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          className={`w-full rounded-xl border bg-slate-950/80 px-3 py-2.5 pr-10 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                            confirmPassword.length > 0 && !passwordsMatch
                              ? 'border-red-500/60 focus:border-red-400'
                              : 'border-slate-700'
                          }`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && !passwordsMatch && (
                        <p className="mt-2 text-xs text-red-300">Passwords do not match.</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmitPassword}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {changePasswordMutation.isPending ? 'Updating...' : 'Update password'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-300">
                  This account was created with Google Sign-In, so it does not use a local password. Password changes are unavailable here.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
              <h2 className="mb-6 text-lg font-bold text-white">Account details</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <LogIn className="h-5 w-5 text-slate-400" />
                    <span className="text-white">Last sign-in</span>
                  </div>
                  <span className="text-sm text-slate-300">{formatDateTime(profile.lastLoginAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-slate-400" />
                    <span className="text-white">Sign-in method</span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-slate-200">
                    {prettyProvider(profile.authProvider)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BadgeCheck className="h-5 w-5 text-slate-400" />
                    <span className="text-white">Member since</span>
                  </div>
                  <span className="text-sm text-slate-300">{formatDate(profile.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
            <div className="mb-1 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-bold text-white">App settings</h2>
            </div>
            <p className="mb-6 text-sm text-slate-400">
              Set the defaults that shape your home search and account communication.
            </p>

            <div className="space-y-6">
              <div className="space-y-4">
                {settingRows.map((row) => {
                  const enabled = Boolean(settings[row.key as keyof typeof settings]);
                  return (
                    <div key={row.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                      <div>
                        <p className="font-semibold text-white">{row.label}</p>
                        <p className="text-xs text-slate-400">{row.hint}</p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={row.label}
                        onClick={() =>
                          toggleSetting(
                            row.key as keyof AppSettings,
                            !enabled as AppSettings[keyof AppSettings],
                          )
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          enabled ? 'bg-blue-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Profile visibility</label>
                  <select
                    value={settings.profileVisibility}
                    onChange={(e) => toggleSetting('profileVisibility', e.target.value as AppSettings['profileVisibility'])}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option>Private</option>
                    <option>Public</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">Default view</label>
                  <select
                    value={settings.defaultView}
                    onChange={(e) => toggleSetting('defaultView', e.target.value as AppSettings['defaultView'])}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option>List</option>
                    <option>Map</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setSettings(defaultSettings);
                    setBanner({ kind: 'success', text: 'App settings reset to defaults.' });
                  }}
                  className="text-sm font-semibold text-slate-300 transition hover:text-white"
                >
                  Reset to defaults
                </button>

                <button
                  type="button"
                  onClick={() => setBanner({ kind: 'success', text: 'App settings saved successfully.' })}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                  <Check className="h-4 w-4" />
                  Save settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

