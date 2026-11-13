import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Zap, MessageSquare, Boxes, Cloud, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import StatusBadge from '../../components/admin/StatusBadge';

interface HealthService {
  name: string;
  icon: string;
  status: string;
  latency: string;
  lastCheck: string;
  version: string;
  details: string;
}

interface SystemHealthResponse {
  services: HealthService[];
  overview?: {
    operational?: number;
    down?: number;
    degraded?: number;
    totalServices?: number;
    averageLatency?: string;
  };
}

// API calls
const getSystemHealth = async (): Promise<SystemHealthResponse> => {
  const { data } = await apiClient.get('/admin/dashboard/system-health');
  return data.data;
};

const SystemHealthPage: React.FC = () => {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  const getIcon = (iconName: string) => {
    const icons = {
      activity: Activity,
      database: Database,
      zap: Zap,
      message: MessageSquare,
      boxes: Boxes,
      cloud: Cloud
    };
    return icons[iconName as keyof typeof icons] || Activity;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'from-green-500 to-emerald-500';
      case 'degraded': return 'from-yellow-500 to-orange-500';
      case 'down': return 'from-red-500 to-rose-500';
      default: return 'from-gray-500 to-slate-500';
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">System Health</h1>
          <p className="text-gray-400 mt-1">Monitor infrastructure and service status</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <p className="text-sm text-gray-400">Total Services</p>
          <p className="text-3xl font-bold text-white mt-2">{data?.overview?.totalServices || data?.services?.length || 0}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <p className="text-sm text-gray-400">Operational</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{data?.overview?.operational || 0}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <p className="text-sm text-gray-400">Degraded</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{data?.overview?.degraded || 0}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <p className="text-sm text-gray-400">Down</p>
          <p className="text-3xl font-bold text-red-400 mt-2">{data?.overview?.down || 0}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <p className="text-sm text-gray-400">Avg Latency</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">{data?.overview?.averageLatency || 'N/A'}</p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data?.services.map((service) => {
          const Icon = getIcon(service.icon);
          return (
            <div
              key={service.name}
              className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getStatusColor(service.status)} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{service.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {service.version && service.version !== '—'
                          ? `Version ${service.version}`
                          : 'Live probe'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={service.status as any} size="sm" />
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Latency</p>
                      <p className="text-sm font-medium text-white mt-1">{service.latency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Checked</p>
                      <p className="text-sm font-medium text-white mt-1">{service.lastCheck}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <p className="text-sm text-gray-400">{service.details}</p>
                  </div>
                </div>
              </div>

              {service.status === 'down' && (
                <div className="bg-red-500/10 border-t border-red-500/30 px-6 py-3">
                  <p className="text-sm text-red-300">
                    <strong>Action required:</strong> service is unreachable. Check its container
                    and the matching connection string in the server environment.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Warning Note */}
      <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-4">
        <p className="text-sm text-gray-400">
          <strong className="text-gray-200">How this is measured:</strong> the backend probes
          PostgreSQL, Redis and RabbitMQ directly and reports pending or failed import jobs. This
          page refreshes every 30 seconds.
        </p>
      </div>
    </div>
  );
};

export default SystemHealthPage;
