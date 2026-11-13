import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  suffix?: string;
}

export default function StatCard({ title, value, change, icon: Icon, suffix }: StatCardProps) {
  const formatChange = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

      return (
    // Flat stat strip — drops the .stat-card card frame for a lighter look.
    <div className="flex items-center gap-3.5 rounded-xl bg-white/80 px-4 py-3.5 ring-1 ring-slate-200/60 dark:bg-slate-900/60 dark:ring-slate-700">
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-lg text-gray-500 ml-1 dark:text-slate-400">{suffix}</span>}
        </p>
        {change !== undefined && (
          <p className={`mt-0.5 text-xs ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatChange(change)} vs last period
          </p>
        )}
      </div>
    </div>
  );
}
