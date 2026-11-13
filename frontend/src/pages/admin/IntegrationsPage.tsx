import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, RefreshCw, CheckCircle, AlertTriangle, Play } from 'lucide-react';

import { fetchIntegrationsStatus, type SourceStatusRow } from '../../api/publicData';
import { canSyncIntegration, syncIntegration, type SyncSummary } from '../../api/admin';
import StatusBadge from '../../components/admin/StatusBadge';

/**
 * Live view of the integration registry the backend actually serves.
 *
 * Every row is a source the platform has implemented; its status, access
 * method and last successful sync come from `GET /public/integrations/status`.
 * Nothing is rendered from a static list, so an integration that is not
 * implemented never appears here.
 */
const STATUS_LABEL: Record<string, string> = {
  verified_live: 'Live',
  verified_manual: 'Verified (manual)',
  manual_only: 'Manual only',
  pending_access: 'Pending access',
  not_configured: 'Not configured',
};

function badgeFor(status: string): 'operational' | 'degraded' | 'pending' | 'inactive' {
  if (status === 'verified_live') return 'operational';
  if (status === 'verified_manual') return 'operational';
  if (status === 'manual_only') return 'degraded';
  if (status === 'pending_access') return 'pending';
  return 'inactive';
}

const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ name: string; summary: SyncSummary } | null>(null);
  const [syncError, setSyncError] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: fetchIntegrationsStatus,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: (input: { id: string; name: string }) => syncIntegration(input.id),
    onMutate: (input) => {
      setSyncingId(input.id);
      setSyncError('');
      setSyncResult(null);
    },
    onSuccess: (summary, input) => {
      setSyncResult({ name: input.name, summary });
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] });
    },
    onError: (err: any, input) => {
      setSyncError(
        `${input.name}: ${err?.response?.data?.message || err?.message || 'sync failed'}`,
      );
    },
    onSettled: () => setSyncingId(null),
  });

  const integrations: SourceStatusRow[] = data ?? [];
  const live = integrations.filter((entry) => entry.status === 'verified_live').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Integrations
          </h1>
          <p className="text-gray-400 mt-1">
            {integrations.length > 0
              ? `${integrations.length} integrated sources · ${live} active`
              : 'Loading the integration registry…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-400/50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          The integration registry could not be reached. No status is shown rather than a guessed one.
        </div>
      )}

      {syncResult && (
        <div className="flex items-start gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-green-300">{syncResult.name} synced</p>
            <p className="mt-1 text-green-200/80">
              {syncResult.summary.fetched} fetched · {syncResult.summary.saved} saved ·{' '}
              {syncResult.summary.skipped} skipped
              {syncResult.summary.errors.length > 0
                ? ` · ${syncResult.summary.errors.length} error(s): ${syncResult.summary.errors[0]}`
                : ''}
            </p>
            {syncResult.summary.note && (
              <p className="mt-1 text-xs text-green-200/70">{syncResult.summary.note}</p>
            )}
          </div>
        </div>
      )}

      {syncError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-slate-800/50">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration, index) => {
            const healthy = integration.status === 'verified_live';
            return (
              <div
                // The registry can list the same source id more than once (e.g.
                // separate sale/rent crawl groups), so the id alone is not unique.
                key={`${integration.id}-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-800/50 p-6 backdrop-blur-sm"
              >
                <div className="mb-4 flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                      healthy ? 'bg-green-500/20' : 'bg-amber-500/20'
                    }`}
                  >
                    <Plug className={`w-6 h-6 ${healthy ? 'text-green-400' : 'text-amber-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{integration.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">{integration.category}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    <StatusBadge status={badgeFor(integration.status)} size="sm" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Registry status</span>
                    <span className="text-sm font-medium text-white">
                      {STATUS_LABEL[integration.status] ?? integration.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Access</span>
                    <span className="text-sm font-medium text-white">{integration.accessMethod}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Last sync</span>
                    <span className="text-sm text-white">
                      {integration.lastSuccessfulSync
                        ? new Date(integration.lastSuccessfulSync).toLocaleString()
                        : 'not recorded'}
                    </span>
                  </div>
                </div>

                <p className="mt-4 border-t border-white/10 pt-4 text-sm text-gray-400">
                  {integration.notes}
                </p>

                <div className="mt-4">
                  {canSyncIntegration(integration.id) ? (
                    <button
                      type="button"
                      onClick={() => syncMutation.mutate({ id: integration.id, name: integration.name })}
                      disabled={syncingId !== null}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      {syncingId === integration.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {syncingId === integration.id ? 'Syncing…' : 'Sync now'}
                    </button>
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-2 text-center text-xs text-gray-500">
                      No on-demand sync for this source
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IntegrationsPage;
