import { LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export default function LineChart({ data, xKey, lines, height = 300 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
          labelStyle={{ color: '#374151', fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map(({ key, color, name }) => (
          <Line key={key} type="monotone" dataKey={key} stroke={color} name={name} strokeWidth={2} dot={false} />
        ))}
      </RechartsLine>
    </ResponsiveContainer>
  );
}
