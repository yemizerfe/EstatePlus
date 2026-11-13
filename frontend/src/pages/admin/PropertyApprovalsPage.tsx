import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Eye,
  MapPin,
  Home,
  DollarSign,
  User,
  Mail,
  Calendar,
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  getPropertyApprovalQueue,
  reviewProperty,
  type AdminApprovalProperty,
  type ReviewableStatus,
} from '../../api/admin';

type Tab = ReviewableStatus;

const TABS: Array<{ key: Tab; label: string; icon: typeof Clock; accent: string }> = [
  { key: 'PENDING', label: 'Pending review', icon: Clock, accent: 'amber' },
  { key: 'APPROVED', label: 'Approved', icon: CheckCircle, accent: 'emerald' },
  { key: 'REJECTED', label: 'Rejected', icon: XCircle, accent: 'red' },
];

const TAB_STYLES: Record<string, { active: string; idle: string; icon: string }> = {
  amber: {
    active: 'border-amber-500/60 bg-amber-500/10',
    idle: 'border-white/10 hover:border-amber-500/30',
    icon: 'bg-amber-500/20 text-amber-300',
  },
  emerald: {
    active: 'border-emerald-500/60 bg-emerald-500/10',
    idle: 'border-white/10 hover:border-emerald-500/30',
    icon: 'bg-emerald-500/20 text-emerald-300',
  },
  red: {
    active: 'border-red-500/60 bg-red-500/10',
    idle: 'border-white/10 hover:border-red-500/30',
    icon: 'bg-red-500/20 text-red-300',
  },
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const statusBadge = (status: ReviewableStatus) => {
  const styles: Record<ReviewableStatus, string> = {
    PENDING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${styles[status]}`}>
      {status.toLowerCase()}
    </span>
  );
};

const PropertyApprovalsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Tab>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminApprovalProperty | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const queueQuery = useQuery({
    queryKey: ['admin-property-approvals', status, search, page],
    queryFn: () => getPropertyApprovalQueue({ status, search, page }),
  });

  const reviewMutation = useMutation({
    mutationFn: (input: { id: string; decision: 'approve' | 'reject'; reason?: string }) =>
      reviewProperty(input.id, { decision: input.decision, reason: input.reason }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-property-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      setNotice(
        result.status === 'APPROVED'
          ? 'Listing approved — the owner has been notified.'
          : 'Listing rejected — the owner has been notified with your reason.',
      );
      setSelected(null);
      setDecision(null);
      setReason('');
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Could not review this listing');
      setDecision(null);
    },
  });

  const data = queueQuery.data;
  const counts = data?.counts;
  const properties = data?.properties ?? [];

  const openReview = (property: AdminApprovalProperty) => {
    setSelected(property);
    setDecision(null);
    setReason('');
    setError('');
    setNotice('');
  };

  const closeModal = () => {
    if (reviewMutation.isPending) return;
    setSelected(null);
    setDecision(null);
    setReason('');
    setError('');
  };

  const submitDecision = () => {
    if (!selected || !decision) return;
    if (decision === 'reject' && !reason.trim()) {
      setError('A reason is required so the owner knows what to change.');
      return;
    }
    setError('');
    reviewMutation.mutate({
      id: selected.id,
      decision,
      ...(decision === 'reject' ? { reason: reason.trim() } : {}),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Property Approvals
          </h1>
          <p className="text-gray-400 mt-1">
            Review submitted listings and keep the marketplace trustworthy.
          </p>
        </div>
        <button
          onClick={() => queueQuery.refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${queueQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const styles = TAB_STYLES[tab.accent]!;
          const active = status === tab.key;
          const value =
            tab.key === 'PENDING'
              ? counts?.pending
              : tab.key === 'APPROVED'
                ? counts?.approved
                : counts?.rejected;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`text-left rounded-2xl border-2 p-5 backdrop-blur-sm transition-all ${
                active ? styles.active : `bg-slate-800/50 ${styles.idle}`
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">{tab.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">{value ?? '—'}</p>
                </div>
                <div className={`p-3 rounded-lg ${styles.icon}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, location, or owner…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/20 bg-slate-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {queueQuery.isLoading ? (
        <div className="flex items-center justify-center h-64 rounded-2xl border border-white/10 bg-slate-800/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : queueQuery.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="font-semibold text-red-300">Could not load the approval queue</p>
          <p className="mt-1 text-sm text-red-200/80">
            {(queueQuery.error as any)?.response?.data?.message ||
              (queueQuery.error as Error)?.message}
          </p>
          <button
            onClick={() => queueQuery.refetch()}
            className="mt-3 text-sm font-medium text-red-200 underline"
          >
            Try again
          </button>
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-white font-semibold">
            {search.trim() ? 'Nothing matches this search' : `No ${status.toLowerCase()} listings`}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {search.trim()
              ? 'Clear the search box to see everything in this tab.'
              : status === 'PENDING'
                ? 'New submissions appear here as owners publish their listings.'
                : 'Reviewed listings will be recorded in this tab.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10 bg-slate-900/50">
                <tr>
                  {['Property', 'Owner', 'Price', 'Submitted', 'Status', 'Actions'].map((label) => (
                    <th
                      key={label}
                      className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {properties.map((property) => (
                  <tr key={property.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {property.images[0] ? (
                          <img
                            src={property.images[0]}
                            alt={property.title}
                            className="w-16 h-16 rounded-lg object-cover bg-slate-700"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center">
                            <Home className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white">{property.title}</p>
                          <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
                            <MapPin className="w-3 h-3" />
                            {property.neighborhood ?? 'Unassigned area'}
                            {property.address ? ` · ${property.address}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {property.propertyType.replace('_', ' ').toLowerCase()} ·{' '}
                            {property.sizeSqm.toLocaleString()} m² · {property.bedrooms} beds
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-white">{property.owner.name || '—'}</p>
                      <p className="text-xs text-gray-400">{property.owner.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-lg font-bold text-white">
                        {property.askingPrice.toLocaleString()} ETB
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {formatDateTime(property.submittedAt)}
                    </td>
                    <td className="px-6 py-4">{statusBadge(property.status)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openReview(property)}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                      >
                        <Eye className="w-4 h-4" />
                        {property.status === 'PENDING' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {data.page} of {data.pages} · {data.total.toLocaleString()} listings
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/5 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-white/10 p-2 text-gray-300 hover:bg-white/5 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-xl font-bold text-white">Property review</h2>
                <p className="mt-1 text-sm text-gray-400">{selected.title}</p>
              </div>
              <button
                onClick={closeModal}
                disabled={reviewMutation.isPending}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {selected.images.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {selected.images.map((image) => (
                    <img
                      key={image}
                      src={image}
                      alt={selected.title}
                      className="h-40 w-full rounded-xl object-cover bg-slate-800"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-slate-800">
                  <div className="text-center text-gray-500">
                    <Home className="mx-auto mb-2 w-8 h-8" />
                    <p className="text-sm">No photos uploaded for this listing</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 text-lg font-bold text-white">Property details</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Home className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Title</p>
                        <p className="font-semibold text-white">{selected.title}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Location</p>
                        <p className="font-semibold text-white">
                          {selected.neighborhood ?? 'Unassigned area'}
                          {selected.address ? ` · ${selected.address}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <DollarSign className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Asking price</p>
                        <p className="text-xl font-bold text-white">
                          {selected.askingPrice.toLocaleString()} ETB
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      {[
                        ['Type', selected.propertyType.replace('_', ' ').toLowerCase()],
                        ['Size', `${selected.sizeSqm.toLocaleString()} m²`],
                        ['Layout', `${selected.bedrooms} bd · ${selected.bathrooms} ba`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="font-semibold capitalize text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 text-lg font-bold text-white">Owner</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Name</p>
                        <p className="font-semibold text-white">{selected.owner.name || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Email</p>
                        <p className="break-all font-semibold text-white">{selected.owner.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Submitted</p>
                        <p className="font-semibold text-white">
                          {formatDateTime(selected.submittedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="mt-0.5 w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Current status</p>
                        <div className="mt-1">{statusBadge(selected.status)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="mb-2 text-lg font-bold text-white">Description</h3>
                <p className="whitespace-pre-line text-gray-300">
                  {selected.description?.trim() || 'The owner did not write a description.'}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {selected.status !== 'PENDING' ? (
                <p className="rounded-xl border border-white/10 bg-slate-800/60 p-4 text-sm text-gray-400">
                  This listing is already {selected.status.toLowerCase()}. Only pending listings can
                  be approved or rejected.
                </p>
              ) : decision === null ? (
                <div className="flex flex-col gap-4 sm:flex-row">
                  <button
                    onClick={() => {
                      setDecision('approve');
                      setError('');
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve listing
                  </button>
                  <button
                    onClick={() => {
                      setDecision('reject');
                      setError('');
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject listing
                  </button>
                </div>
              ) : decision === 'approve' ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <h3 className="text-lg font-semibold text-emerald-200">Confirm approval</h3>
                  </div>
                  <p className="mb-4 text-emerald-100/80">
                    The listing becomes visible to buyers and the owner is notified. This can be
                    undone later from the approved tab.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={submitDecision}
                      disabled={reviewMutation.isPending}
                      className="flex-1 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? 'Approving…' : 'Confirm approval'}
                    </button>
                    <button
                      onClick={() => setDecision(null)}
                      disabled={reviewMutation.isPending}
                      className="flex-1 rounded-lg border border-white/20 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-400" />
                    <h3 className="text-lg font-semibold text-red-200">Reject listing</h3>
                  </div>
                  <label className="mb-2 block text-sm font-medium text-red-200">
                    Reason for rejection (shown to the owner)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setError('');
                    }}
                    rows={4}
                    maxLength={500}
                    placeholder="Explain what needs to change, e.g. photos do not match the address…"
                    className="w-full rounded-lg border border-red-500/30 bg-slate-900/60 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">{reason.length}/500</p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={submitDecision}
                      disabled={reviewMutation.isPending || !reason.trim()}
                      className="flex-1 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                    <button
                      onClick={() => {
                        setDecision(null);
                        setReason('');
                        setError('');
                      }}
                      disabled={reviewMutation.isPending}
                      className="flex-1 rounded-lg border border-white/20 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PropertyApprovalsPage;
