import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Building, Shield, Calendar, Upload, Lock, Key, AlertTriangle, Save, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';

interface AdminProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  authProvider: string;
  profilePicture: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  organization?: string | null;
  lastPasswordChange?: string | null;
  securitySettings?: { emailNotifications: boolean; loginAlerts: boolean; sessionTimeout: number };
}

// API calls
const getAdminProfile = async (): Promise<AdminProfile> => {
  const { data } = await apiClient.get('/auth/profile');
  return data.data;
};

const updatePassword = async (passwordData: { currentPassword: string; newPassword: string }) => {
  const { data } = await apiClient.put('/auth/password', passwordData);
  return data;
};

const updateSecuritySettings = async (settings: any) => {
  const { data } = await apiClient.put('/auth/security-settings', settings);
  return data;
};

const uploadAvatar = async (file: File): Promise<{ avatarUrl: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);
  // Let the browser set the multipart boundary; forcing the header here drops it.
  const { data } = await apiClient.post<{ data: { avatarUrl: string } }>('/auth/avatar', formData, {
    headers: { 'Content-Type': undefined as unknown as string },
  });
  return data.data;
};

const AdminProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [securitySettings, setSecuritySettings] = useState({
    emailNotifications: true,
    loginAlerts: true,
    sessionTimeout: 30
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: getAdminProfile,
  });

  // Initialise security settings once the profile arrives.
  useEffect(() => {
    if (profile?.securitySettings) {
      setSecuritySettings(profile.securitySettings);
    }
  }, [profile]);

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, avatar: data.avatarUrl });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setAvatarPreview(null);
      setSuccessMessage('Avatar updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || 'Failed to upload avatar');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccessMessage('Password updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || 'Failed to update password');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  });

  // Update security settings mutation
  const updateSecurityMutation = useMutation({
    mutationFn: updateSecuritySettings,
    onSuccess: (_data, saved) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      // Keep the live session policy in step with what was just saved.
      if (user) {
        setUser({ ...user, sessionTimeout: saved.sessionTimeout });
      }
      setSuccessMessage('Security settings updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || 'Failed to update security settings');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('File size must be less than 5MB');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select an image file');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }

      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload immediately
      uploadAvatarMutation.mutate(file);
    }
  };

  const handlePasswordChange = () => {
    // Validate
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setErrorMessage('Please fill in all password fields');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('New passwords do not match');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    updatePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });
  };

  const handleSecuritySave = () => {
    updateSecurityMutation.mutate(securitySettings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-400 font-semibold">{successMessage}</p>
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-400 font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Admin Profile</h1>
        <p className="text-gray-400 mt-1">Manage your administrator account and security settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-start gap-6">
          {/* Avatar with Upload */}
          <div className="relative group">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            {avatarPreview || profile?.profilePicture || user?.avatar ? (
              <img
                src={avatarPreview || profile?.profilePicture || user?.avatar}
                alt={profile?.firstName || user?.name}
                className="w-32 h-32 rounded-full object-cover ring-4 ring-blue-500/30"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-blue-500/30">
                {(profile?.firstName || user?.name || 'A').charAt(0)}
              </div>
            )}
            <button
              onClick={handleAvatarClick}
              disabled={uploadAvatarMutation.isPending}
              className="absolute bottom-0 right-0 w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors disabled:opacity-50"
            >
              {uploadAvatarMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <h2 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {profile?.firstName && profile?.lastName 
                ? `${profile.firstName} ${profile.lastName}` 
                : user?.name}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span className="text-lg font-semibold text-blue-400">Administrator</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-white">{profile?.email || user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Account type</p>
                  <p className="text-white capitalize">{profile?.role?.replace('_', ' ') || 'Administrator'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Account Created</p>
                  <p className="text-white">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Last Password Change</p>
                  <p className="text-white">{profile?.lastPasswordChange ? new Date(profile.lastPasswordChange).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Key className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Change Password</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                className="w-full px-4 py-3 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                className="w-full px-4 py-3 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handlePasswordChange}
            disabled={updatePasswordMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20 font-semibold transition-all disabled:opacity-50"
          >
            {updatePasswordMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Update Password
              </>
            )}
          </button>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Security Settings</h3>
        </div>

        <div className="space-y-6">
          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-semibold text-white">Email Notifications</p>
                <p className="text-sm text-gray-400">Receive important updates via email</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={securitySettings.emailNotifications}
                onChange={(e) => setSecuritySettings({...securitySettings, emailNotifications: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Login Alerts */}
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-semibold text-white">Login Alerts</p>
                <p className="text-sm text-gray-400">Get notified of new login attempts</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={securitySettings.loginAlerts}
                onChange={(e) => setSecuritySettings({...securitySettings, loginAlerts: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Session Timeout */}
          <div className="p-4 bg-slate-900/50 rounded-xl border border-white/10">
            <label className="block font-semibold text-white mb-2">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              value={securitySettings.sessionTimeout}
              onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: parseInt(e.target.value)})}
              className="w-full px-4 py-3 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="5"
              max="120"
            />
            <p className="text-sm text-gray-400 mt-2">Automatically log out after period of inactivity</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSecuritySave}
            disabled={updateSecurityMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20 font-semibold transition-all disabled:opacity-50"
          >
            {updateSecurityMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Security Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Security Note */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-400 mb-1">Security Best Practices</p>
            <p className="text-sm text-gray-300">
              Administrators have full platform access. Use a strong unique password, review the audit log for unexpected activity, and never share your credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfilePage;
