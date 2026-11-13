import { useQuery } from '@tanstack/react-query';
import { getEconomicIndicators } from '../../api/market';
import LineChart from '../../components/charts/LineChart';
import { DollarSign, TrendingUp, Percent, Building } from 'lucide-react';

export default function EconomicsPage() {
  const { data: indicators, isLoading } = useQuery({
    queryKey: ['economic-indicators', 12],
    queryFn: () => getEconomicIndicators({ months: 12 }),
  });

  const groupedByType = indicators?.reduce((acc, ind) => {
    if (!acc[ind.indicatorType]) acc[ind.indicatorType] = [];
    acc[ind.indicatorType]!.push(ind);
    return acc;
  }, {} as Record<string, typeof indicators>);

  const chartData = (type: string) => {
    const data = groupedByType?.[type] || [];
    return data
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map((d) => ({
        date: new Date(d.recordedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        value: d.value,
      }));
  };

  const iconMap: Record<string, typeof DollarSign> = {
    inflation: TrendingUp,
    interest_rate: Percent,
    exchange_rate: DollarSign,
    construction_cost: Building,
  };

  if (isLoading) return <div>Loading indicators...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1>Economic Indicators</h1>
        <p className="text-gray-600 mt-1">Key economic factors affecting the real estate market</p>
      </div>

      {groupedByType &&
        Object.entries(groupedByType).map(([type, data]) => {
          const Icon = iconMap[type] || DollarSign;
          const latest = data[0];
          return (
            <div key={type} className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 capitalize">
                  <Icon className="w-5 h-5" />
                  {type.replace('_', ' ')}
                </h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-brand-600">
                    {latest?.value.toFixed(2)} {latest?.unit}
                  </div>
                  <div className="text-sm text-gray-500">Latest: {new Date(latest?.recordedAt ?? '').toLocaleDateString()}</div>
                </div>
              </div>
              <LineChart data={chartData(type)} xKey="date" lines={[{ key: 'value', color: '#0ea5e9', name: 'Value' }]} height={200} />
            </div>
          );
        })}

      {!groupedByType || Object.keys(groupedByType).length === 0 ? (
        <div className="card text-center py-12 text-gray-500">No economic indicators available</div>
      ) : null}
    </div>
  );
}
