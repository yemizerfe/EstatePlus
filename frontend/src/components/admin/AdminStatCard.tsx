import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
}

const AdminStatCard: React.FC<AdminStatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    red: 'from-red-500/20 to-rose-500/20 border-red-500/30',
    orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    gray: 'from-gray-500/20 to-slate-500/20 border-gray-500/30'
  };

  const iconColorClasses = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    red: 'from-red-500 to-rose-500',
    orange: 'from-orange-500 to-amber-500',
    purple: 'from-purple-500 to-pink-500',
    gray: 'from-gray-500 to-slate-500'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-6 backdrop-blur-sm hover:scale-105 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-400 mb-1 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black text-white mb-2">{value}</p>
          {trend && (
            <p className="text-sm text-green-400 font-semibold">{trend}</p>
          )}
          {subtitle && (
            <p className="text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
        <div className="relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${iconColorClasses[color]} rounded-xl blur-lg opacity-50`} />
          <div className={`relative w-12 h-12 bg-gradient-to-br ${iconColorClasses[color]} rounded-xl flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStatCard;
