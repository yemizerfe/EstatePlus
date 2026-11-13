import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Ban,
  CheckCircle,
  Mail,
  Building,
  Shield,
  Calendar,
  Clock,
  AlertTriangle,
  X,
  Save,
} from 'lucide-react';
import StatusBadge from '../../components/admin/StatusBadge';
import { apiClient } from '../../api/client';

interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'suspended';
  lastLoginAt: string | null;
  createdAt: string;
  profilePicture: string | null;
  firstName: string;
  lastName: string;
  properties: Array<{ id: string; title: string; status: string }>;
  recentActivity: Array<{ id: string; action: string; resource: string; timestamp: string }>;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'View Market Data',
    'Manage Market Data',
    'Create Reports',
    'Manage Users',
    'Manage Roles',
    'Manage Integrations',
    'View Audit Logs',
    'Manage System Settings',
  ],
  ANALYST: ['View Market Data', 'Manage Market Data', 'Create Reports', 'View Audit Logs'],
  PROPERTY_OWNER: ['View Market Data', 'Create Reports', 'Manage Own Listings'],
  USER: ['View Market Data', 'Save Properties', 'Create Reports'],
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';

const getUserDetails = async (id: string): Promise<AdminUserDetail> => {
  const { data } = await apiClient.get<{ data: AdminUserDetail }>(`/admin/users/${id}`);
  return data.data;
};

const updateUserStatus = async ({ id, isActive }: { id: string; isActive: boolean }) => {
  const { data } = await apiClient.put<{ data: AdminUserDetail }>(`/admin/users/${id}`, { isActive });
  return data.data;
};

interface UserEditInput {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'property_owner', label: 'Property Owner' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'admin', label: 'Administrator' },
];

const updateUserDetails = async ({ id, ...updates }: UserEditInput) => {
  const { data } = await apiClient.put<{ data: AdminUserDetail }>(`/admin/users/${id}`, updates);
  return data.data;
};

const UserDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getUserDetails(id!),
    enabled: !!id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'user',
  });
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const statusMutation = useMutation({
    mutationFn: updateUserStatus,
    onSuccess: (_updated, variables) => {
      invalidate();
      setActionError('');
      setNotice(variables.isActive ? 'Account reactivated.' : 'Account suspended.');
    },
    onError: (err: any) =>
      setActionError(err?.response?.data?.message || 'Could not update this account'),
  });

  const editMutation = useMutation({
    mutationFn: updateUserDetails,
    onSuccess: () => {
      invalidate();
      setIsEditing(false);
      setActionError('');
      setNotice('Account details saved.');
    },
    onError: (err: any) =>
      setActionError(err?.response?.data?.message || 'Could not save these changes'),
  });

  const handleEdit = () => {
    if (!user) return;
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.toLowerCase(),
    });
    setActionError('');
    setNotice('');
    setIsEditing(true);
  };

  const submitEdit = () => {
    if (!user) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setActionError('First and last name are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
      setActionError('Enter a valid email address');
      return;
    }
    setActionError('');
    editMutation.mutate({
      id: user.id,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      email: editForm.email.trim(),
      role: editForm.role,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">User not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
          <CheckCircle className="w-4 h-4" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {(actionError || statusMutation.isError) && !isEditing && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0" />
          <span>{actionError || 'Could not update this account'}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">User Details</h1>
            <p className="text-gray-400 mt-1">{user.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          {user.status === 'active' ? (
            <button
              onClick={() => statusMutation.mutate({ id: user.id, isActive: false })}
              disabled={statusMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50"
            >
              <Ban className="w-4 h-4" />
              Suspend
            </button>
          ) : (
            <button
              onClick={() => statusMutation.mutate({ id: user.id, isActive: true })}
              disabled={statusMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Reactivate
            </button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-white font-medium mt-1">{user.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p className="text-white">{user.email}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Listings</label>
                <div className="flex items-center gap-2 mt-1">
                  <Building className="w-4 h-4 text-gray-400" />
                  <p className="text-white">{user.properties.length} properties</p>
                </div>
              </div>
              {user.properties.length > 0 && (
                <div className="space-y-2">
                  {user.properties.map((property) => (
                    <Link
                      key={property.id}
                      to={`/app/properties/${property.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-sm hover:border-blue-500/40"
                    >
                      <span className="truncate text-gray-200">{property.title}</span>
                      <span className="flex-shrink-0 text-xs uppercase text-gray-500">
                        {property.status}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-purple-500/20 capitalize text-purple-300">
                    {user.role.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={user.status as any} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Account Created</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-white">{formatDate(user.createdAt)}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Active</label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-white">{formatDate(user.lastLoginAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Activity */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Account Activity</h3>
          {user.recentActivity.length === 0 && (
            <p className="text-sm text-gray-400">No audit events recorded for this account yet.</p>
          )}
          <div className="space-y-3">
            {user.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{activity.action}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.resource} • {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Permissions</h3>
          <div className="space-y-2">
            {(ROLE_PERMISSIONS[user.role] ?? ROLE_PERMISSIONS.USER!).map((permission, index) => (
              <div key={index} className="flex items-center gap-2 p-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">{permission}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-800 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 p-6">
              <div>
                <h2 className="text-lg font-bold text-white">Edit account</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Changes apply immediately and are recorded in the audit log.
                </p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                disabled={editMutation.isPending}
                className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="space-y-4 p-6"
              onSubmit={(event) => {
                event.preventDefault();
                submitEdit();
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">First name</label>
                  <input
                    value={editForm.firstName}
                    onChange={(event) =>
                      setEditForm({ ...editForm, firstName: event.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-white focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Last name</label>
                  <input
                    value={editForm.lastName}
                    onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-white focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-white focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Role</label>
                <select
                  value={editForm.role}
                  onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-2 text-white focus:border-blue-500/50 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {actionError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={editMutation.isPending}
                  className="rounded-xl border border-white/20 px-4 py-2 text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {editMutation.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetailsPage;
