import { useState, useEffect } from 'react';
import { useAuthenticatedFetch } from '@/hooks/useKeyboardShortcuts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { RefreshCw } from 'lucide-react';
import Decimal from 'decimal.js';

interface HourlyData {
  hour: string;
  entries: number;
  exits: number;
  revenue: number;
}

interface LiveMetricsData {
  hourlyData: HourlyData[];
  revenueData: Array<{
    time: string;
    cumulative: number;
  }>;
  lastUpdated: string;
}

export default function LiveMetrics() {
  const [data, setData] = useState<LiveMetricsData>({
    hourlyData: [],
    revenueData: [],
    lastUpdated: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const authenticatedFetch = useAuthenticatedFetch();

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [authenticatedFetch]);

  const fetchMetrics = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/metrics/hourly');

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const { hourlyData, revenueData, lastUpdated } = result.data;
          
          setData({
            hourlyData: hourlyData || [],
            revenueData: revenueData || [],
            lastUpdated: lastUpdated || new Date().toISOString(),
          });
        }
      } else {
        // Fallback to dashboard endpoint if hourly metrics fails
        console.warn('Hourly metrics endpoint failed, using basic dashboard data');
        const dashboardResponse = await authenticatedFetch('/api/admin/dashboard');
        if (dashboardResponse.ok) {
          // Set empty data rather than mock data
          setData({
            hourlyData: Array.from({ length: 24 }, (_, hour) => ({
              hour: hour.toString().padStart(2, '0'),
              entries: 0,
              exits: 0,
              revenue: 0,
            })),
            revenueData: [],
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching live metrics:', error);
      // Set empty data on error instead of mock data
      setData({
        hourlyData: Array.from({ length: 24 }, (_, hour) => ({
          hour: hour.toString().padStart(2, '0'),
          entries: 0,
          exits: 0,
          revenue: 0,
        })),
        revenueData: [],
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMetrics();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`Hora: ${label}:00`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'revenue' && ' MXN'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const RevenueTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          <p style={{ color: payload[0].color }}>
            Ingresos: ${new Decimal(payload[0].value).toFixed(2)} MXN
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Métricas en Tiempo Real</h3>
          <p className="text-sm text-gray-500">
            Última actualización: {new Date(data.lastUpdated).toLocaleTimeString('es-MX')}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Hourly Entries/Exits Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Entradas y Salidas por Hora</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="hour" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="entries" 
                  fill="#10b981" 
                  name="Entradas"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  dataKey="exits" 
                  fill="#f59e0b" 
                  name="Salidas"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Trend Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Ingresos Acumulados del Día</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="Ingresos Acumulados"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-700">Total Entradas Hoy</div>
          <div className="text-2xl font-bold text-green-900">
            {data.hourlyData.reduce((sum, item) => sum + item.entries, 0)}
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-700">Total Salidas Hoy</div>
          <div className="text-2xl font-bold text-yellow-900">
            {data.hourlyData.reduce((sum, item) => sum + item.exits, 0)}
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-700">Ingresos Totales</div>
          <div className="text-2xl font-bold text-blue-900">
            ${new Decimal(data.hourlyData.reduce((sum, item) => sum + item.revenue, 0)).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}