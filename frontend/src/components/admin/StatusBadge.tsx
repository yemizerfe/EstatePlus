import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'suspended' | 'connected' | 'disconnected' | 'syncing' | 'failed' | 'operational' | 'degraded' | 'down';
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1'
  };

  const statusConfig = {
    active: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Active' },
    inactive: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Inactive' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Pending' },
    suspended: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Suspended' },
    connected: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Connected' },
    disconnected: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Disconnected' },
    syncing: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Syncing' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Failed' },
    operational: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Operational' },
    degraded: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Degraded' },
    down: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Down' }
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${sizeClasses[size]} ${config.bg} ${config.text} ${config.border}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {config.label}
    </span>
  );
};

export default StatusBadge;
