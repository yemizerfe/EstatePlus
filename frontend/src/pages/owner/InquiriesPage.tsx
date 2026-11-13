import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHero } from '../../components/ui/kit-core';
import {
  MessageSquare,
  Search,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Home,
  Send,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  fetchInquiries,
  fetchInquiryStats,
  updateInquiry,
  type Inquiry,
  type InquiryStatus,
} from '../../api/inquiries';

type StatusFilter = 'all' | InquiryStatus;

export default function InquiriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [responding, setResponding] = useState<Inquiry | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: inquiries, isLoading, error: loadError } = useQuery({
    queryKey: ['inquiries', statusFilter, searchTerm],
    queryFn: () =>
      fetchInquiries({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        search: searchTerm,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['inquiries', 'stats'],
    queryFn: fetchInquiryStats,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inquiries'] });
  };

  const respondMutation = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      updateInquiry(id, { response, status: 'responded' }),
    onSuccess: () => {
      setResponding(null);
      setDraft('');
      setError('');
      invalidate();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not send the reply.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InquiryStatus }) => updateInquiry(id, { status }),
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not update the inquiry.');
    },
  });

  const openRespond = (inquiry: Inquiry) => {
    setResponding(inquiry);
    setDraft(inquiry.response ?? '');
    setError('');
  };

  const submitReply = () => {
    if (!responding) return;
    if (draft.trim().length < 2) {
      setError('Write a short reply before sending.');
      return;
    }
    respondMutation.mutate({ id: responding.id, response: draft.trim() });
  };

  const nextStatus = (inquiry: Inquiry): { label: string; status: InquiryStatus; icon: typeof CheckCircle } => {
    if (inquiry.status === 'new') return { label: 'Mark Responded', status: 'responded', icon: CheckCircle };
    if (inquiry.status === 'responded') return { label: 'Close', status: 'closed', icon: XCircle };
    return { label: 'Reopen', status: 'new', icon: RotateCcw };
  };

  const getStatusColor = (status: InquiryStatus) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'responded': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'closed': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: InquiryStatus) => {
    switch (status) {
      case 'new': return <AlertCircle className="w-4 h-4" />;
      case 'responded': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <XCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={MessageSquare}
        title="Inquiries"
        description="Manage buyer inquiries and respond to interested parties."
        accent="indigo"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.total ?? 0}</div>
              <div className="text-sm text-gray-400">Total Inquiries</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.new ?? 0}</div>
              <div className="text-sm text-gray-400">New</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.responded ?? 0}</div>
              <div className="text-sm text-gray-400">Responded</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-500/20 rounded-xl">
              <XCircle className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.closed ?? 0}</div>
              <div className="text-sm text-gray-400">Closed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by property or buyer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all" className="bg-slate-800">All Status</option>
            <option value="new" className="bg-slate-800">New</option>
            <option value="responded" className="bg-slate-800">Responded</option>
            <option value="closed" className="bg-slate-800">Closed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {loadError && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{loadError instanceof Error ? loadError.message : 'Could not load inquiries.'}</span>
        </div>
      )}

      {/* Inquiries List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : inquiries && inquiries.length > 0 ? (
          inquiries.map((inquiry) => {
            const action = nextStatus(inquiry);
            const ActionIcon = action.icon;
            return (
              <div
                key={inquiry.id}
                className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Home className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">{inquiry.propertyTitle}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(inquiry.status)} flex items-center gap-1`}>
                        {getStatusIcon(inquiry.status)}
                        {inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{inquiry.userName}</span>
                      </div>
                      <a href={`mailto:${inquiry.userEmail}`} className="flex items-center gap-2 hover:text-white">
                        <Mail className="w-4 h-4" />
                        <span>{inquiry.userEmail}</span>
                      </a>
                      {inquiry.userPhone && (
                        <a href={`tel:${inquiry.userPhone}`} className="flex items-center gap-2 hover:text-white">
                          <Phone className="w-4 h-4" />
                          <span>{inquiry.userPhone}</span>
                        </a>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(inquiry.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-lg border border-white/10">
                      <p className="text-gray-300">{inquiry.message}</p>
                    </div>

                    {inquiry.response && (
                      <div className="mt-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <div className="text-xs font-semibold text-blue-300 mb-1">Your reply</div>
                        <p className="text-gray-200 text-sm">{inquiry.response}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => openRespond(inquiry)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    {inquiry.response ? 'Update Reply' : 'Respond'}
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: inquiry.id, status: action.status })}
                    disabled={statusMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <ActionIcon className="w-4 h-4" />
                    {action.label}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Inquiries Found</h3>
            <p className="text-gray-400">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'You haven\u2019t received any inquiries yet'}
            </p>
          </div>
        )}
      </div>

      {/* Reply modal */}
      {responding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Reply to {responding.userName}</h3>
                <p className="text-sm text-gray-400">{responding.propertyTitle}</p>
              </div>
              <button onClick={() => setResponding(null)} className="p-1 text-gray-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 bg-slate-800/60 rounded-lg p-3 mb-4">{responding.message}</p>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Write your reply..."
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setResponding(null)}
                className="px-4 py-2 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submitReply}
                disabled={respondMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {respondMutation.isPending ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
