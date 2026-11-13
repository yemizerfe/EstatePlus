import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHero } from '../../components/ui/kit-core';
import {
  CalendarRange,
  Search,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Calendar,
  Home,
  Plus,
  X,
  AlertCircle,
  UserX,
} from 'lucide-react';
import {
  fetchViewings,
  fetchViewingStats,
  createViewing,
  updateViewing,
  type Viewing,
  type ViewingStatus,
} from '../../api/viewings';
import { useMyProperties } from '../../hooks/useProperties';

type StatusFilter = 'all' | ViewingStatus;

const emptyForm = {
  propertyId: '',
  clientName: '',
  clientEmail: '',
  clientPhone: '',
  scheduledAt: '',
  notes: '',
};

/** ISO date-time → value accepted by <input type="datetime-local">. */
const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ViewingsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [rescheduling, setRescheduling] = useState<Viewing | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();

  const { data: viewings, isLoading, error: loadError } = useQuery({
    queryKey: ['viewings', statusFilter, searchTerm],
    queryFn: () =>
      fetchViewings({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        search: searchTerm,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['viewings', 'stats'],
    queryFn: fetchViewingStats,
  });

  // The owner can only book viewings on listings they own.
  const { data: myProperties } = useMyProperties({ limit: 100 });
  const properties = myProperties?.properties ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['viewings'] });
  };

  const createMutation = useMutation({
    mutationFn: createViewing,
    onSuccess: () => {
      setScheduleOpen(false);
      setForm({ ...emptyForm });
      setFormError('');
      invalidate();
    },
    onError: (mutationError) => {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Could not schedule the viewing.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ViewingStatus }) => updateViewing(id, { status }),
    onSuccess: () => {
      setFormError('');
      invalidate();
    },
    onError: (mutationError) => {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Could not update the viewing.');
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      updateViewing(id, { scheduledAt, status: 'scheduled' }),
    onSuccess: () => {
      setRescheduling(null);
      setRescheduleAt('');
      setFormError('');
      invalidate();
    },
    onError: (mutationError) => {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Could not reschedule the viewing.');
    },
  });

  const openSchedule = () => {
    setForm({ ...emptyForm, propertyId: properties[0]?.id ?? '' });
    setFormError('');
    setScheduleOpen(true);
  };

  const submitSchedule = () => {
    if (!form.propertyId) return setFormError('Choose the listing being viewed.');
    if (!form.clientName.trim()) return setFormError('The client name is required.');
    if (!form.clientEmail.trim()) return setFormError('The client email is required.');
    if (!form.scheduledAt) return setFormError('Pick the date and time of the viewing.');

    const when = new Date(form.scheduledAt);
    if (Number.isNaN(when.getTime())) return setFormError('Pick a valid date and time.');

    createMutation.mutate({
      propertyId: form.propertyId,
      clientName: form.clientName.trim(),
      clientEmail: form.clientEmail.trim(),
      ...(form.clientPhone.trim() ? { clientPhone: form.clientPhone.trim() } : {}),
      scheduledAt: when.toISOString(),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    });
  };

  const openReschedule = (viewing: Viewing) => {
    setRescheduling(viewing);
    setRescheduleAt(toLocalInput(viewing.scheduledAt));
    setFormError('');
  };

  const submitReschedule = () => {
    if (!rescheduling) return;
    if (!rescheduleAt) return setFormError('Pick the new date and time.');
    const when = new Date(rescheduleAt);
    if (Number.isNaN(when.getTime())) return setFormError('Pick a valid date and time.');
    rescheduleMutation.mutate({ id: rescheduling.id, scheduledAt: when.toISOString() });
  };

  const getStatusColor = (status: ViewingStatus) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'no-show': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    }
  };

  const getStatusIcon = (status: ViewingStatus) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      case 'no-show': return <UserX className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={CalendarRange}
        title="Property Viewings"
        description="Manage scheduled property viewings and track client visits."
        accent="purple"
        actions={
          <button
            onClick={openSchedule}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Viewing
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <CalendarRange className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.total ?? 0}</div>
              <div className="text-sm text-gray-400">Total Viewings</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.scheduled ?? 0}</div>
              <div className="text-sm text-gray-400">Scheduled</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.completed ?? 0}</div>
              <div className="text-sm text-gray-400">Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats?.cancelled ?? 0}</div>
              <div className="text-sm text-gray-400">Cancelled</div>
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
              placeholder="Search by property or client name..."
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
            <option value="scheduled" className="bg-slate-800">Scheduled</option>
            <option value="completed" className="bg-slate-800">Completed</option>
            <option value="cancelled" className="bg-slate-800">Cancelled</option>
            <option value="no-show" className="bg-slate-800">No Show</option>
          </select>
        </div>
      </div>

      {formError && !scheduleOpen && !rescheduling && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}
      {loadError && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{loadError instanceof Error ? loadError.message : 'Could not load viewings.'}</span>
        </div>
      )}

      {/* Viewings List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : viewings && viewings.length > 0 ? (
          viewings.map((viewing) => (
            <div
              key={viewing.id}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <Home className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">{viewing.propertyTitle}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(viewing.status)} flex items-center gap-1`}>
                      {getStatusIcon(viewing.status)}
                      {viewing.status.charAt(0).toUpperCase() + viewing.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                    <MapPin className="w-4 h-4" />
                    <span>{viewing.propertyAddress}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Client Info */}
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-white/10">
                      <h4 className="text-sm font-semibold text-gray-400 mb-3">Client Information</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>{viewing.clientName}</span>
                        </div>
                        <a href={`mailto:${viewing.clientEmail}`} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span>{viewing.clientEmail}</span>
                        </a>
                        {viewing.clientPhone && (
                          <a href={`tel:${viewing.clientPhone}`} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span>{viewing.clientPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Schedule Info */}
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-white/10">
                      <h4 className="text-sm font-semibold text-gray-400 mb-3">Schedule Details</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{new Date(viewing.scheduledAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>
                            {new Date(viewing.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {viewing.notes && (
                          <div className="text-sm text-gray-400 mt-2 pt-2 border-t border-white/10">
                            <p>{viewing.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {viewing.status === 'scheduled' ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => statusMutation.mutate({ id: viewing.id, status: 'completed' })}
                    disabled={statusMutation.isPending}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    Mark Completed
                  </button>
                  <button
                    onClick={() => openReschedule(viewing)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: viewing.id, status: 'no-show' })}
                    disabled={statusMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                  >
                    <UserX className="w-4 h-4" />
                    No Show
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: viewing.id, status: 'cancelled' })}
                    disabled={statusMutation.isPending}
                    className="px-4 py-2 bg-slate-800/50 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => statusMutation.mutate({ id: viewing.id, status: 'scheduled' })}
                    disabled={statusMutation.isPending}
                    className="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                  >
                    Reopen Viewing
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <CalendarRange className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Viewings Scheduled</h3>
            <p className="text-gray-400 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Schedule your first property viewing'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={openSchedule}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Schedule Viewing
              </button>
            )}
          </div>
        )}
      </div>

      {/* Schedule modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Schedule Viewing</h3>
              <button onClick={() => setScheduleOpen(false)} className="p-1 text-gray-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {properties.length === 0 ? (
              <p className="text-sm text-gray-400">
                You need a listing before you can schedule a viewing.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Property</label>
                  <select
                    value={form.propertyId}
                    onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {properties.map((property) => (
                      <option key={property.id} value={property.id} className="bg-slate-800">
                        {property.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Client name</label>
                    <input
                      value={form.clientName}
                      onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Abebe Bekele"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Client email</label>
                    <input
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) => setForm((prev) => ({ ...prev, clientEmail: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Phone (optional)</label>
                    <input
                      value={form.clientPhone}
                      onChange={(e) => setForm((prev) => ({ ...prev, clientPhone: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+251 9.."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Date &amp; time</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Anything the client should know"
                  />
                </div>

                {formError && (
                  <div className="flex items-start gap-2 text-sm text-red-300">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setScheduleOpen(false)}
                    className="px-4 py-2 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitSchedule}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Scheduling...' : 'Schedule'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Reschedule Viewing</h3>
                <p className="text-sm text-gray-400">{rescheduling.propertyTitle}</p>
              </div>
              <button onClick={() => setRescheduling(null)} className="p-1 text-gray-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-sm text-gray-400 mb-1">New date &amp; time</label>
            <input
              type="datetime-local"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {formError && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setRescheduling(null)}
                className="px-4 py-2 text-gray-300 border border-white/20 rounded-lg hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submitReschedule}
                disabled={rescheduleMutation.isPending}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
