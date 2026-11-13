import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketForecast } from '../../api/market';
import { getNeighborhoods } from '../../api/market';

interface ForecastPointLike {
  month: string;
  value: number;
}

interface ForecastPayload {
  historicalData?: ForecastPointLike[];
  forecastData?: ForecastPointLike[];
  baseValue?: number;
  forecastMonths?: number;
  rSquared?: number | null;
  disclaimer?: string;
}
import LineChart from '../../components/charts/LineChart';
import { TrendingUp, AlertCircle } from 'lucide-react';

export default function ForecastingPage() {
  const [params, setParams] = useState({
    forecastType: 'price' as 'price' | 'rental',
    neighborhoodId: '',
    months: 6,
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ['neighborhoods'],
    queryFn: () => getNeighborhoods(),
  });

  const { data: forecast, isLoading, error } = useQuery<ForecastPayload>({
    queryKey: ['forecast', params],
    queryFn: () => getMarketForecast(params) as Promise<ForecastPayload>,
  });

  const chartData = forecast
    ? [
        ...(forecast.historicalData?.map((d) => ({ month: d.month, actual: d.value, forecast: null })) || []),
        ...(forecast.forecastData?.map((d) => ({ month: d.month, actual: null, forecast: d.value })) || []),
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2">
          <TrendingUp className="w-8 h-8" />
          Market Forecasting
        </h1>
        <p className="text-gray-600 mt-1">Short-term market trend predictions</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Forecast Type</label>
            <select
              value={params.forecastType}
              onChange={(e) => setParams({ ...params, forecastType: e.target.value as 'price' | 'rental' })}
              className="input"
            >
              <option value="price">Property Prices</option>
              <option value="rental">Rental Prices</option>
            </select>
          </div>
          <div>
            <label className="label">Neighborhood</label>
            <select
              value={params.neighborhoodId}
              onChange={(e) => setParams({ ...params, neighborhoodId: e.target.value })}
              className="input"
            >
              <option value="">All Neighborhoods</option>
              {neighborhoods?.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Forecast Period</label>
            <select value={params.months} onChange={(e) => setParams({ ...params, months: Number(e.target.value) })} className="input">
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-center py-12 text-gray-500">Generating forecast...</div>
      ) : error ? (
        <div className="card">
          <div className="flex items-start gap-3 text-red-600">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Unable to generate forecast</p>
              <p className="text-sm mt-1">
                {error instanceof Error ? error.message : 'The forecasting service did not respond.'}
              </p>
            </div>
          </div>
        </div>
      ) : forecast ? (
        <>
          <div className="card">
            <h2 className="mb-4">Forecast Results</h2>
            <LineChart
              data={chartData}
              xKey="month"
              lines={[
                { key: 'actual', color: '#0ea5e9', name: 'Historical' },
                { key: 'forecast', color: '#f59e0b', name: 'Forecast' },
              ]}
              height={400}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="mb-3">Forecast Details</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Base Value:</dt>
                  <dd className="font-medium">ETB {(forecast.baseValue ?? 0).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Forecast Period:</dt>
                  <dd className="font-medium">{forecast.forecastMonths} months</dd>
                </div>
                {forecast.rSquared != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Model R²:</dt>
                    <dd className="font-medium">{forecast.rSquared.toFixed(3)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="card bg-amber-50 border-amber-200">
              <h3 className="mb-2 flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5" />
                Important Notice
              </h3>
              <p className="text-sm text-amber-800">{forecast.disclaimer}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
