import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TrendChart({ data, series, title = 'Evolución ESG' }) {
  if (!data?.length) return null;
  const activeSeries = series ?? defaultSeries;
  const yDomain = calculateDomain(data, activeSeries);
  return (
    <div className="card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis domain={yDomain} />
          <Tooltip />
          <Legend />
          {activeSeries.map((serie) => (
            <Line
              key={serie.dataKey}
              type="monotone"
              dataKey={serie.dataKey}
              stroke={serie.color}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const defaultSeries = [
  { dataKey: 'environmental', color: '#0b815a' },
  { dataKey: 'social', color: '#2563eb' },
  { dataKey: 'governance', color: '#9333ea' },
];

function calculateDomain(data, series) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let hasData = false;

  series.forEach((serie) => {
    if (serie.domain) {
      const [domainMin, domainMax] = serie.domain;
      if (typeof domainMin === 'number') {
        min = Math.min(min, domainMin);
        hasData = true;
      }
      if (typeof domainMax === 'number') {
        max = Math.max(max, domainMax);
        hasData = true;
      }
      return;
    }
    const values = data
      .map((item) => (typeof item[serie.dataKey] === 'number' ? Number(item[serie.dataKey]) : null))
      .filter((value) => value !== null);
    if (values.length) {
      min = Math.min(min, ...values);
      max = Math.max(max, ...values);
      hasData = true;
    }
  });

  if (!hasData) return ['auto', 'auto'];
  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return ['auto', 'auto'];
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return [Math.floor(min), Math.ceil(max)];
}
