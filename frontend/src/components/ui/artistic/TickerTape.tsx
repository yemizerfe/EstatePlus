import React from 'react';

const STATS: Array<{ label: string; value: string; trend?: 'up' | 'down' }> = [
  { label: 'Avg price · Bole', value: '8.4M ETB', trend: 'up' },
  { label: 'Avg price · CMC', value: '6.1M ETB', trend: 'up' },
  { label: 'Rental yield · City', value: '5.8%', trend: 'down' },
  { label: 'YoY growth', value: '+12.3%', trend: 'up' },
  { label: 'Active listings', value: '2,481' },
  { label: 'Mortgage rate', value: '13.5%', trend: 'down' },
  { label: 'Avg price / m² · Old Airport', value: '71k ETB', trend: 'up' },
  { label: 'Neighborhoods tracked', value: '32' },
];

/**
 * TickerTape
 * Infinite market ticker in the spirit of classic finance terminals —
 * a seamless CSS marquee that pauses on hover. Decorative only.
 */
const TickerTape: React.FC = () => {
  const doubled = [...STATS, ...STATS];

  return (
    <div aria-hidden="true" className="ticker-wrap relative z-10">
      <div className="ticker">
        {doubled.map((s, i) => (
          <span key={i} className="ticker-item">
            <span className="text-slate-500">{s.label}</span>
            <span className="font-bold text-slate-900">{s.value}</span>
            {s.trend && (
              <span className={s.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}>
                {s.trend === 'up' ? '▲' : '▼'}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TickerTape;
