import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DonutChartProps {
  data: Array<{ type?: string; count?: number; percentage: number } & Record<string, unknown>>;
  labelKey?: string;
  valueKey?: string;
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DonutChart({ 
  data = [],
  labelKey = 'type',
  valueKey = 'count',
  height = 300,
  colors = DEFAULT_COLORS 
}: DonutChartProps) {
  // Transform data for pie chart
  const chartData = data.map((item, index) => ({
    name: String((item as Record<string, unknown>)[labelKey] ?? item.type),
    value: Number((item as Record<string, unknown>)[valueKey] ?? item.count),
    percentage: item.percentage,
    color: colors[index % colors.length]
  }));

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fontWeight: 600 }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPie>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ 
            backgroundColor: '#1e293b', 
            border: '1px solid #334155', 
            borderRadius: 8,
            color: '#fff'
          }}
          formatter={(value: number, name: string) => [value.toLocaleString(), name]}
        />
        <Legend 
          wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
          formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
        />
      </RechartsPie>
    </ResponsiveContainer>
  );
}