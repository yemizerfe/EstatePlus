import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export default function BarChart({ data, xKey, bars, height = 300 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
          labelStyle={{ color: '#374151', fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map(({ key, color, name }) => (
          <Bar key={key} dataKey={key} fill={color} name={name} />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  );
}
