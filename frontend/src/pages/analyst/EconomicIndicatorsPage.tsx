import { useQuery } from '@tanstack/react-query';
import { getEconomicIndicators } from '../../api/economics';
import type { EconomicIndicator } from '../../types';
import { LineChart } from '../../components/charts';
import { InfoHint, PageHero } from '../../components/ui/kit-core';
import { indicatorHint } from '../../lib/metricHints';
import { indicatorReading } from '../../lib/marketMeaning';
import { ReadingLine } from '../../components/ui/MeaningPanel';
import { SectionCard, EmptyState } from '../../components/ui/kit-blocks';
import { TrendingUp, TrendingDown, DollarSign, Percent, Building } from 'lucide-react';

const iconMap: Record<EconomicIndicator['indicatorType'], typeof TrendingUp> = {
  INFLATION: TrendingUp,
  INTEREST_RATES: Percent,
  GDP_GROWTH: TrendingUp,
  UNEMPLOYMENT: TrendingDown,
  CONSTRUCTION_COSTS: DollarSign,
  MORTGAGE_RATES: Percent,
  EXCHANGE_RATES: DollarSign,
  CONSUMER_CONFIDENCE: TrendingUp,
  HOUSING_STARTS: Building,
  BUILDING_PERMITS: Building,
  RETAIL_SALES: TrendingUp,
  INDUSTRIAL_PRODUCTION: TrendingUp,
  PPI: DollarSign,
  CPI: DollarSign,
  WAGE_GROWTH: TrendingUp,
  POPULATION_GROWTH: TrendingUp,
  MIGRATION: TrendingUp,
  INFRASTRUCTURE_SPENDING: DollarSign,
  TAX_RATES: Percent,
  REGULATION_INDEX: TrendingUp,
};

const unitLabels: Record<EconomicIndicator['indicatorType'], string> = {
  INFLATION: '%',
  INTEREST_RATES: '%',
  GDP_GROWTH: '%',
  UNEMPLOYMENT: '%',
  CONSTRUCTION_COSTS: 'USD',
  MORTGAGE_RATES: '%',
  EXCHANGE_RATES: 'USD',
  CONSUMER_CONFIDENCE: 'Index',
  HOUSING_STARTS: 'Units',
  BUILDING_PERMITS: 'Permits',
  RETAIL_SALES: 'USD',
  INDUSTRIAL_PRODUCTION: 'Index',
  PPI: 'Index',
  CPI: 'Index',
  WAGE_GROWTH: '%',
  POPULATION_GROWTH: '%',
  MIGRATION: 'Users',
  INFRASTRUCTURE_SPENDING: 'USD',
  TAX_RATES: '%',
  REGULATION_INDEX: 'Index',
};

const formatIndicatorLabel = (type: string): string =>
  type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function EconomicIndicatorsPage() {
  const { data: indicators, isLoading } = useQuery({
    queryKey: ['economic-indicators', 12],
    queryFn: () => getEconomicIndicators({ months: 12 }),
  });

  const groupedByType = indicators?.reduce((acc, ind) => {
    if (!acc[ind.indicatorType]) {
      acc[ind.indicatorType] = [];
    }
    acc[ind.indicatorType]!.push(ind);
    return acc;
  }, {} as Record<string, EconomicIndicator[]>) ?? {};

  const chartData = (type: EconomicIndicator['indicatorType']) => {
    const data = groupedByType[type] ?? [];
    return data
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map((d) => ({
        date: new Date(d.recordedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        value: d.value,
      }));
  };

  const indicatorTypes = Object.keys(groupedByType) as EconomicIndicator['indicatorType'][];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={TrendingUp}
        title="Economic Indicators"
        description="Key economic factors affecting the real estate market. Tap the ⓘ beside an indicator to read what the number means in plain language."
      />

      {indicatorTypes.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {indicatorTypes.map((type) => {
            const data = groupedByType[type] ?? [];
            const Icon = iconMap[type] ?? TrendingUp;
            const sorted = [...data].sort(
              (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
            );
            const latest = sorted[sorted.length - 1];
            const previous = sorted[sorted.length - 2];
            const reading = indicatorReading({
              type,
              latestValue: latest?.value ?? null,
              previousValue: previous?.value ?? null,
            });
            const label = formatIndicatorLabel(type);
            return (
              <SectionCard key={type} title={label}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0 text-sky-400" />
                    <h3 className="flex items-center text-base font-semibold text-white">
                      {label}
                      {indicatorHint(type) && <InfoHint text={indicatorHint(type)!} label={label} />}
                    </h3>
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    <div className="text-xl font-bold text-white">
                      {(latest?.value ?? 0).toFixed(2)} {latest?.unit ?? unitLabels[type] ?? ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      Latest: {latest ? new Date(latest.recordedAt).toLocaleDateString() : '-'}
                    </div>
                  </div>
                </div>
                {reading && <ReadingLine reading={reading} />}
                <div className="mt-4">
                  <LineChart
                    data={chartData(type)}
                    xKey="date"
                    lines={[{ key: 'value', color: '#0ea5e9', name: 'Value' }]}
                    height={200}
                  />
                </div>
              </SectionCard>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Building}
          title="No economic indicators available"
          message="No economic indicators have been recorded for the selected period."
        />
      )}
    </div>
  );
}
