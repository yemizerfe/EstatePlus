import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Building,
  Database,
  Shield,
  Plus,
  Plug,
  FileText,
  Activity,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../api/client';
import AdminStatCard from '../../components/admin/AdminStatCard';
import StatusBadge from '../../components/admin/StatusBadge';

interface HealthService {
  name: string;
  icon: string;
  status: 'operational' | 'degraded' | 'down';
  latency: string;
  lastCheck: string;
  version: string;
  details: string;
}

interface SystemHealth {
  services: HealthService[];
  overview?: {
    totalServices?: number;
    operational?: number;
    degraded?: number;
    down?: number;
    averageLatency?: string;
  };
}

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  status: string;
}

interface RecentActivity {
  activities: ActivityItem[];
}

interface SystemAlert {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface SystemAlerts {
  alerts: SystemAlert[];
}

// API calls
const getDashboardStats = async () => {
  const { data } = await apiClient.get('/admin/dashboard/stats');
  return data.data;
};

const getSystemHealth = async (): Promise<SystemHealth> => {
  const { data } = await apiClient.get('/admin/dashboard/system-health');
  return data.data;
};

const getRecentActivity = async (): Promise<RecentActivity> => {
  const { data } = await apiClient.get('/admin/dashboard/recent-activity');
  return data.data;
};

const getSystemAlerts = async (): Promise<SystemAlerts> => {
  const { data } = await apiClient.get('/admin/dashboard/alerts');
  return data.data;
};

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: getDashboardStats
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: getRecentActivity
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: getSystemAlerts
  });

  if (statsLoading || healthLoading || activityLoading || alertsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const quickActions = [
    { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'blue' },
    { label: 'Property Approvals', icon: Shield, path: '/admin/property-approvals', color: 'amber' },
    { label: 'Import Data', icon: Plus, path: '/admin/import', color: 'purple' },
    { label: 'Data Sources', icon: Database, path: '/admin/data-sources', color: 'green' },
    { label: 'Integrations', icon: Plug, path: '/admin/integrations', color: 'orange' },
    { label: 'Audit Logs', icon: FileText, path: '/admin/audit-logs', color: 'gray' },
    { label: 'System Health', icon: Activity, path: '/admin/system-health', color: 'red' }
  ];

  const downServices = health?.overview?.down ?? 0;
  const degradedServices = health?.overview?.degraded ?? 0;
  const operationalServices = health?.overview?.operational ?? 0;
  const totalServices = health?.overview?.totalServices ?? health?.services.length ?? 0;
  const systemStatus =
    downServices > 0 ? `${downServices} down` : degradedServices > 0 ? 'Degraded' : 'Operational';
  const systemStatusColor: 'green' | 'orange' | 'red' =
    downServices > 0 ? 'red' : degradedServices > 0 ? 'orange' : 'green';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Platform administration and system management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 overflow-x-auto">
        <div className="min-w-0">
          <AdminStatCard
            title="Total Users"
            value={stats?.totalUsers.toLocaleString() || '0'}
            icon={Users}
            trend={stats?.userGrowth}
            color="blue"
          />
        </div>
        <div className="min-w-0">
          <AdminStatCard
            title="Active Users"
            value={stats?.activeUsers.toLocaleString() || '0'}
            icon={UserCheck}
            color="green"
          />
        </div>
        <div className="min-w-0">
          <AdminStatCard
            title="Organizations"
            value={stats?.organizations || '0'}
            icon={Building}
            color="purple"
          />
        </div>
        <div className="min-w-0">
          <AdminStatCard
            title="Data Sources"
            value={stats?.dataSources ?? 0}
            subtitle="Configured Sources"
            icon={Database}
            color="orange"
          />
        </div>
        <div className="min-w-0">
          <AdminStatCard
            title="System Status"
            value={systemStatus}
            subtitle={`${operationalServices}/${totalServices} services operational`}
            icon={Shield}
            color={systemStatusColor}
          />
        </div>
      </div>

      {/* Pending approvals surfaced from the stats payload */}
      {(stats?.pendingApprovals ?? 0) > 0 && (
        <button
          onClick={() => navigate('/admin/property-approvals')}
          className="w-full text-left bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 backdrop-blur-sm hover:bg-amber-500/15 transition-colors"
        >
          <p className="text-sm font-semibold text-amber-300">
            {stats.pendingApprovals} propert{stats.pendingApprovals === 1 ? 'y' : 'ies'} waiting for approval
          </p>
          <p className="text-xs text-amber-200/70 mt-1">Open property approvals →</p>
        </button>
      )}

      {/* System Alerts */}
      {alerts && alerts.alerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-400 mb-2 uppercase tracking-wider">System Alerts</h3>
              <div className="space-y-2">
                {alerts.alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between">
                    <p className="text-sm text-gray-400">{alert.message}</p>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {alert.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">System Status</h3>
          <div className="space-y-3">
            {health?.services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={service.status} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-white">{service.name}</p>
                    <p className="text-xs text-gray-400">
                      {service.latency !== '—' ? `Latency: ${service.latency} · ` : ''}
                      {service.details}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Admin Activity */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Recent Admin Activity</h3>
          {(activity?.activities.length ?? 0) === 0 && (
            <p className="text-sm text-gray-400">
              No audit events have been recorded yet. Administrative actions appear here as they
              happen.
            </p>
          )}
          <div className="space-y-4">
            {activity?.activities.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2 animate-pulse" />
                <div className="flex-1">
                  <p className="text-sm text-gray-400">
                    <span className="font-semibold text-white">{item.actor}</span> {item.action}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{item.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const colorMap: Record<string, string> = {
              blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 hover:border-blue-500/50',
              purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:border-purple-500/50',
              green: 'from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-500/50',
              orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 hover:border-orange-500/50',
              gray: 'from-gray-500/20 to-slate-500/20 border-gray-500/30 hover:border-gray-500/50',
              amber: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 hover:border-amber-500/50',
              red: 'from-red-500/20 to-rose-500/20 border-red-500/30 hover:border-red-500/50'
            };
            const iconColorMap: Record<string, string> = {
              blue: 'text-blue-400',
              purple: 'text-purple-400',
              green: 'text-green-400',
              orange: 'text-orange-400',
              gray: 'text-gray-400',
              amber: 'text-amber-400',
              red: 'text-red-400'
            };
            return (
              <div key={action.label} className="min-w-0">
                <button
                  onClick={() => navigate(action.path)}
                  className={`w-full flex flex-col items-center gap-2 p-3 rounded-xl border bg-gradient-to-br ${colorMap[action.color]} hover:scale-105 transition-all group`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className={`w-4 h-4 ${iconColorMap[action.color]}`} />
                  </div>
                  <span className="text-xs font-semibold text-gray-300 text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
