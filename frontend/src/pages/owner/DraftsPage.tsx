import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PageHero } from '../../components/ui/kit-core';
import {
  changePropertyStatus,
  deleteProperty,
  getMyProperties,
} from '../../api/properties';
import {
  FileText,
  Search,
  Edit,
  Trash2,
  Clock,
  Send,
  Home,
  MapPin,
  DollarSign
} from 'lucide-react';

interface Draft {
  id: string;
  title: string;
  type: 'apartment' | 'villa' | 'condominium' | 'commercial';
  neighborhood: string;
  price?: number;
  area?: number;
  completionPercentage: number;
  lastModified: string;
  createdAt: string;
}

/**
 * Drafts are the owner's own properties whose stored status is DRAFT. The
 * completion figure is derived from which required fields are actually filled
 * in, so it always reflects the record in the database.
 */
const getDrafts = async (): Promise<Draft[]> => {
  const { properties } = await getMyProperties({ status: 'DRAFT', limit: 100 });

  return properties.map((property) => {
    const filled = [
      Boolean(property.title),
      Boolean(property.neighborhoodId),
      Boolean(property.askingPrice),
      Boolean(property.sizeSqm),
      Boolean(property.bedrooms),
      Boolean(property.bathrooms),
    ];
    const completionPercentage = Math.round((filled.filter(Boolean).length / filled.length) * 100);

    const type = property.propertyType.toLowerCase();
    return {
      id: property.id,
      title: property.title,
      type:
        type === 'apartment' || type === 'villa' || type === 'condominium'
          ? type
          : 'commercial',
      neighborhood: property.neighborhood?.name ?? property.address ?? 'Addis Ababa',
      price: property.askingPrice ?? undefined,
      area: property.sizeSqm ?? undefined,
      completionPercentage,
      lastModified: property.updatedAt,
      createdAt: property.createdAt,
    };
  });
};

export default function DraftsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: drafts, isLoading } = useQuery({
    queryKey: ['drafts'],
    queryFn: getDrafts
  });

  const refreshDrafts = () => queryClient.invalidateQueries({ queryKey: ['drafts'] });

  /** DRAFT → PENDING is the transition the backend accepts for review. */
  const submitDraft = useMutation({
    mutationFn: (id: string) =>
      changePropertyStatus(id, { fromStatus: 'DRAFT', toStatus: 'PENDING' } as never),
    onSuccess: async () => {
      setActionError(null);
      await refreshDrafts();
      navigate('/app/my-properties');
    },
    onError: (error) =>
      setActionError(error instanceof Error ? error.message : 'The draft could not be submitted.'),
  });

  const removeDraft = useMutation({
    mutationFn: deleteProperty,
    onSuccess: async () => {
      setActionError(null);
      await refreshDrafts();
    },
    onError: (error) =>
      setActionError(error instanceof Error ? error.message : 'The draft could not be deleted.'),
  });

  const confirmDelete = (draft: Draft) => {
    if (window.confirm(`Delete the draft “${draft.title}”? This cannot be undone from the list.`)) {
      removeDraft.mutate(draft.id);
    }
  };

  const filteredDrafts = drafts?.filter(draft =>
    draft.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    draft.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeColor = (type: Draft['type']) => {
    switch (type) {
      case 'apartment': return 'bg-blue-500/20 text-blue-400';
      case 'villa': return 'bg-purple-500/20 text-purple-400';
      case 'condominium': return 'bg-green-500/20 text-green-400';
      case 'commercial': return 'bg-amber-500/20 text-amber-400';
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        icon={FileText}
        title="Draft Properties"
        description="Continue working on your saved property listings."
        accent="amber"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{drafts?.length || 0}</div>
              <div className="text-sm text-gray-400">Total Drafts</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Clock className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {drafts?.filter(d => d.completionPercentage >= 70).length || 0}
              </div>
              <div className="text-sm text-gray-400">Nearly Complete</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Edit className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {drafts?.filter(d => {
                  const daysSince = Math.floor((Date.now() - new Date(d.lastModified).getTime()) / (1000 * 60 * 60 * 24));
                  return daysSince <= 7;
                }).length || 0}
              </div>
              <div className="text-sm text-gray-400">Recent Edits</div>
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {actionError}
        </p>
      )}

      {/* Search */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search drafts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Drafts List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : filteredDrafts && filteredDrafts.length > 0 ? (
          filteredDrafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-amber-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Home className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-semibold text-white">{draft.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(draft.type)}`}>
                      {draft.type.charAt(0).toUpperCase() + draft.type.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{draft.neighborhood}</span>
                    </div>
                    {draft.price && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>ETB {draft.price.toLocaleString()}</span>
                      </div>
                    )}
                    {draft.area && (
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        <span>{draft.area} sqm</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Modified {new Date(draft.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-400">Completion Progress</span>
                      <span className="text-white font-semibold">{draft.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800/50 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all"
                        style={{ width: `${draft.completionPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  to={`/app/my-properties/edit/${draft.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Continue Editing
                </Link>
                {draft.completionPercentage >= 70 && (
                  <button
                    onClick={() => submitDraft.mutate(draft.id)}
                    disabled={submitDraft.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    {submitDraft.isPending ? 'Submitting…' : 'Submit for Review'}
                  </button>
                )}
                <button
                  onClick={() => confirmDelete(draft)}
                  disabled={removeDraft.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-red-400 border border-white/20 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Drafts Found</h3>
            <p className="text-gray-400 mb-6">
              {searchTerm 
                ? 'Try adjusting your search' 
                : 'Start creating a new property listing'}
            </p>
            <Link
              to="/app/my-properties/add"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Create New Property
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
