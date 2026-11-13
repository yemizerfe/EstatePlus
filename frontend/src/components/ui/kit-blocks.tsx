import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Accent } from './kit-core';
import { ACCENT_STYLES } from './kit-core';

/**
 * kit-blocks — section cards, empty states, skeletons, badges & buttons.
 */

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  return (
    <section className={`overflow-hidden rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            {title && <h2 className="text-base font-bold text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={`p-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
  accent?: Accent;
}

export function EmptyState({ icon: Icon, title, message, action, accent = 'slate' }: EmptyStateProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md ${s.tile}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700/60" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded-full bg-slate-200 dark:bg-slate-700/60" />
            <div className="h-3 w-1/4 rounded-full bg-slate-100 dark:bg-slate-800/60" />
          </div>
          <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800/60" />
        </div>
      ))}
    </div>
  );
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

const TONE_STYLES: Record<StatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-400/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-400/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-400 dark:ring-rose-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-400 dark:ring-sky-400/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/15 dark:text-purple-400 dark:ring-purple-400/20',
};

export function StatusBadge({ tone = 'neutral', children }: { tone?: StatusTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  );
}

export function statusToTone(status?: string): StatusTone {
  switch ((status || '').toLowerCase()) {
    case 'approved':
    case 'active':
    case 'completed':
    case 'success':
    case 'verified':
      return 'success';
    case 'pending':
    case 'processing':
    case 'in_progress':
    case 'draft':
      return 'warning';
    case 'rejected':
    case 'failed':
    case 'cancelled':
    case 'inactive':
    case 'blocked':
      return 'danger';
    case 'running':
    case 'importing':
      return 'info';
    default:
      return 'neutral';
  }
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white ${className}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700 ${className}`}
    />
  );
}
