import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Edit,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

import { apiClient } from '../../api/client';
import DataTable from '../../components/admin/DataTable';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

const PAGE_SIZE = 10;

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'suspended';
  lastActive: string;
  createdAt: string;
  avatar: string | null;
}

interface UsersPageResult {
  users: AdminUserRow[];
  total: number;
  page: number;
  pages: number;
}

const fetchUsers = async (filters: {
  search: string;
  role: string;
  status: string;
  page: number;
}): Promise<UsersPageResult> => {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.role !== 'all') params.set('role', filters.role);
  if (filters.status !== 'all') params.set('status', filters.status);
  params.set('page', String(filters.page));
  params.set('limit', String(PAGE_SIZE));

  const { data } = await apiClient.get<{ data: UsersPageResult }>(
    `/admin/users?${params.toString()}`,
  );
  return data.data;
};

const setUserActive = async ({ id, isActive }: { id: string; isActive: boolean }) => {
  const { data } = await apiClient.put(`/admin/users/${id}`, { isActive });
  return data.data;
};

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    isOpen: boolean;
    type: 'suspend' | 'reactivate' | null;
  }>({ isOpen: false, type: null });
  const [actionError, setActionError] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users', search, roleFilter, statusFilter, page],
    queryFn: () => fetchUsers({ search, role: roleFilter, status: statusFilter, page }),
  });

  const statusMutation = useMutation({
    mutationFn: setUserActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActionDialog({ isOpen: false, type: null });
      setSelectedUser(null);
      setActionError('');
    },
    onError: (error: any) =>
      setActionError(error?.response?.data?.message || 'Could not update this user'),
  });

  const handleAction = (user: AdminUserRow, action: 'view' | 'edit' | 'suspend' | 'reactivate') => {
    if (action === 'view' || action === 'edit') {
      navigate(`/admin/users/${user.id}`);
      return;
    }
    setSelectedUser(user);
    setActionError('');
    setActionDialog({ isOpen: true, type: action });
  };

  const confirmAction = () => {
    if (!selectedUser || !actionDialog.type) return;
    statusMutation.mutate({
      id: selectedUser.id,
      isActive: actionDialog.type === 'reactivate',
    });
  };

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (value: string, row: AdminUserRow) => (
        <div className="flex items-center gap-3">
          {row.avatar ? (
            <img
              src={row.avatar}
              alt={value}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
              {value?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <p className="font-medium text-white">{value}</p>
            <p className="text-sm text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (value: string) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-300">
          {value.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: AdminUserRow['status']) => (
        <StatusBadge status={value === 'active' ? 'active' : 'suspended'} size="sm" />
      ),
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      render: (value: string) => <span className="text-gray-400 text-sm">{value}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: string) => <span className="text-gray-400 text-sm">{value}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: unknown, row: AdminUserRow) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleAction(row, 'view');
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleAction(row, 'edit');
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4 text-gray-400" />
          </button>
          {row.status === 'active' ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleAction(row, 'suspend');
              }}
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Suspend"
            >
              <Ban className="w-4 h-4 text-red-400" />
            </button>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleAction(row, 'reactivate');
              }}
              className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors"
              title="Reactivate"
            >
              <CheckCircle className="w-4 h-4 text-green-400" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const data = usersQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Users
          </h1>
          <p className="text-gray-400 mt-1">
            {data
              ? `${data.total.toLocaleString()} accounts registered on EstatePlus`
              : 'Manage platform users and access'}
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="analyst">Analyst</option>
            <option value="property_owner">Property Owner</option>
            <option value="user">User</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border border-white/20 rounded-xl bg-slate-900/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center h-64 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : usersQuery.isError ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <p className="font-semibold text-red-300">Could not load users</p>
          <p className="text-sm text-red-200/80 mt-1">
            {(usersQuery.error as any)?.response?.data?.message ||
              (usersQuery.error as Error)?.message}
          </p>
          <button
            onClick={() => usersQuery.refetch()}
            className="mt-3 text-sm font-medium text-red-200 underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.users ?? []}
          emptyMessage="No users match these filters"
          onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
        />
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {data.page} of {data.pages} · {data.total.toLocaleString()} users
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((current) => current + 1)}
              className="p-2 rounded-lg border border-white/10 text-gray-300 disabled:opacity-40 hover:bg-white/5"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={actionDialog.isOpen}
        onClose={() => {
          setActionDialog({ isOpen: false, type: null });
          setSelectedUser(null);
        }}
        onConfirm={confirmAction}
        title={actionDialog.type === 'suspend' ? 'Suspend user?' : 'Reactivate user?'}
        message={
          actionDialog.type === 'suspend'
            ? `This will prevent ${selectedUser?.name ?? 'this user'} from accessing EstatePlus.`
            : `This will restore access for ${selectedUser?.name ?? 'this user'}.`
        }
        confirmText={
          statusMutation.isPending
            ? 'Saving…'
            : actionDialog.type === 'suspend'
              ? 'Suspend User'
              : 'Reactivate User'
        }
        variant={actionDialog.type === 'suspend' ? 'danger' : 'info'}
        isLoading={statusMutation.isPending}
      />
    </div>
  );
};

export default UsersPage;
