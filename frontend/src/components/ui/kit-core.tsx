import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, type LucideIcon } from 'lucide-react';

/**
 * kit-core — accents, page hero and stat cards shared by all private pages.
 */

export type Accent = 'slate' | 'indigo' | 'emerald' | 'sky' | 'purple' | 'amber' | 'rose';

export const ACCENT_STYLES: Record<Accent, { tile: string; glow: string; ring: string }> = {
  slate: {
    tile: 'bg-gradient-to-br from-slate-700 to-slate-900',
    glow: 'from-slate-500/30',
    ring: 'ring-white/10',
  },
  indigo: {
    tile: 'bg-gradient-to-br from-indigo-500 to-violet-600',
    glow: 'from-indigo-500/30',
    ring: 'ring-indigo-500/20',
  },
  emerald: {
    tile: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    glow: 'from-emerald-500/30',
    ring: 'ring-emerald-500/20',
  },
  sky: {
    tile: 'bg-gradient-to-br from-sky-500 to-blue-600',
    glow: 'from-sky-500/30',
    ring: 'ring-sky-500/20',
  },
  purple: {
    tile: 'bg-gradient-to-br from-purple-500 to-fuchsia-600',
    glow: 'from-purple-500/30',
    ring: 'ring-purple-500/20',
  },
  amber: {
    tile: 'bg-gradient-to-br from-amber-500 to-orange-600',
    glow: 'from-amber-500/30',
    ring: 'ring-amber-500/20',
  },
  rose: {
    tile: 'bg-gradient-to-br from-rose-500 to-pink-600',
    glow: 'from-rose-500/30',
    ring: 'ring-rose-500/20',
  },
};

interface PageHeroProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent?: Accent;
  actions?: React.ReactNode;
}

export function PageHero({ icon: Icon, title, description, accent = 'slate', actions }: PageHeroProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl shadow-xl ring-1 ${s.ring}`}>
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br ${s.glow} to-transparent blur-3xl`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr ${s.glow} to-transparent blur-3xl`}
      />
      <div className="relative flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${s.tile}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-[1.75rem]">{title}</h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

interface InfoHintProps {
  /** Plain-language explanation of what a figure means and how it was calculated. */
  text: string;
  /** Name of the figure, used for screen readers. */
  label?: string;
  className?: string;
}

/**
 * Small ⓘ affordance that shows a plain-language explanation of a statistical
 * figure on hover, focus or tap. The popover is rendered in a portal so cards
 * with `overflow-hidden` cannot clip it.
 */
export function InfoHint({ text, label, className = '' }: InfoHintProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 140),
      left: Math.max(8, Math.min(rect.left - 130, window.innerWidth - 296)),
    });
  };

  const hide = () => setPosition(null);

  return (
    <span className={`inline-flex align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`What ${label ?? 'this figure'} means: ${text}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(event) => {
          event.stopPropagation();
          if (position) hide();
          else show();
        }}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {position &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className="pointer-events-none fixed z-[120] block w-72 rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-gray-200 shadow-2xl backdrop-blur-xl"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Plain-language explanation of what the value means. */
  info?: string;
  trend?: { value: string; direction: 'up' | 'down' };
  accent?: Accent;
}

export function StatCard({ icon: Icon, label, value, hint, info, trend, accent = 'slate' }: StatCardProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className="group flex items-center gap-3.5 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 px-4 py-3.5 backdrop-blur-xl transition-all duration-300 hover:border-blue-400/50 hover:from-white/10">
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-md ${s.tile} group-hover:scale-110 transition-transform duration-300`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
          <span className="truncate">{label}</span>
          {info && <InfoHint text={info} label={label} />}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">{value}</p>
        {(hint || trend) && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
                  trend.direction === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {trend.direction === 'up' ? '▲' : '▼'} {trend.value}
              </span>
            )}
            {hint && <span className="truncate">{hint}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
