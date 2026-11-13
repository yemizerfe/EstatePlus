import { Lightbulb, Info } from 'lucide-react';
import type { Reading, ReadingTone } from '../../lib/marketMeaning';

/**
 * MeaningPanel — the "so what?" of a set of statistics.
 *
 * Pages already explain what each number is via ⓘ hints; this puts the derived
 * reading in the page itself, so a user who never hovers still learns what the
 * figures imply for buying, renting or investing.
 */

const TONE_DOT: Record<ReadingTone, string> = {
  positive: 'bg-emerald-400',
  caution: 'bg-amber-400',
  neutral: 'bg-sky-400',
  info: 'bg-slate-400',
};

const TONE_LABEL: Record<ReadingTone, string> = {
  positive: 'Favourable',
  caution: 'Worth caution',
  neutral: 'Balanced',
  info: 'Context',
};

interface MeaningPanelProps {
  readings: Reading[];
  title?: string;
  subtitle?: string;
  /** Why the readings can be trusted, or what they leave out. */
  caveat?: string;
  className?: string;
}

export function MeaningPanel({
  readings,
  title = 'What these numbers mean',
  subtitle = 'Read straight from the figures on this page — no interpretation needed on your side.',
  caveat,
  className = '',
}: MeaningPanelProps) {
  if (readings.length === 0) return null;

  return (
    <section
      aria-label={title}
      className={`overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-white/5 to-transparent backdrop-blur-xl ${className}`}
    >
      <header className="flex items-start gap-3 border-b border-white/10 px-6 py-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg">
          <Lightbulb className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        </div>
      </header>

      <ul className="divide-y divide-white/5">
        {readings.map((reading, index) => (
          <li key={`${reading.title}-${index}`} className="flex gap-3 px-6 py-4">
            <span
              aria-hidden
              title={TONE_LABEL[reading.tone]}
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[reading.tone]}`}
            />
            <div>
              <p className="text-sm font-semibold text-white">{reading.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-300">{reading.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {caveat && (
        <p className="flex items-start gap-2 border-t border-white/10 px-6 py-3 text-xs leading-relaxed text-gray-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{caveat}</span>
        </p>
      )}
    </section>
  );
}

/** Compact one-line interpretation for cards that cannot fit a full panel. */
export function ReadingLine({ reading }: { reading: Reading }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-gray-300">
      <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[reading.tone]}`} />
      <span>{reading.body}</span>
    </p>
  );
}

export default MeaningPanel;
