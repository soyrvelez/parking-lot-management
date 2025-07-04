import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RefreshCw, TrendingUp } from 'lucide-react';
import Decimal from 'decimal.js';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

interface ChartData {
  revenueChart: Array<{ hour: string; revenue: string; count: number }>;
  transactionChart: Array<{ type: string; count: number; revenue: string }>;
  occupancyChart: Array<{ hour: string; occupancy: number }>;
}

interface ReportChartsProps {
  filters: {
    startDate: string;
    endDate: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    transactionType: string;
  };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReportCharts({ filters }: ReportChartsProps) {
  const { authenticatedFetch } = useAdminAuth();
  const [data, setData] = useState<ChartData>({
    revenueChart: [],
    transactionChart: [],
    occupancyChart: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchChartData();
  }, [filters]);

  const fetchChartData = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        reportType: filters.reportType,
        transactionType: filters.transactionType,
      });

      const response = await authenticatedFetch(`/api/admin/reports/charts?${queryParams}`);

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchChartData();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('amount') || entry.name.includes('revenue') 
                ? `$${new Decimal(entry.value).toFixed(2)} MXN` 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.type}</p>
          <p>Monto: ${new Decimal(data.revenue).toFixed(2)} MXN</p>
          <p>Transacciones: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Análisis Gráfico</h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Tendencia de Ingresos
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueChart}>
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
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Ingresos (MXN)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Distribución por Hora</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueChart}>
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
                  dataKey="revenue" 
                  fill="#3b82f6" 
                  name="Ingresos por Hora"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction Types Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Tipos de Transacción</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.transactionChart}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ type, count }) => `${type} ${count}`}
                >
                  {data.transactionChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Growth Trends */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Ocupación por Hora</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.occupancyChart}>
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
                  dataKey="occupancy" 
                  fill="#8b5cf6" 
                  name="Ocupación"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Insights del Período</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-700">Hora de Mayor Ingreso</div>
            <div className="text-lg font-bold text-green-900">
              {data.revenueChart.length > 0 ? 
                data.revenueChart.reduce((max, hour) => parseFloat(hour.revenue) > parseFloat(max.revenue) ? hour : max).hour
                : 'N/A'}
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-700">Mayor Ocupación</div>
            <div className="text-lg font-bold text-blue-900">
              {data.occupancyChart.length > 0 ? 
                data.occupancyChart.reduce((max, hour) => hour.occupancy > max.occupancy ? hour : max).hour
                : 'N/A'}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-700">Tipo Principal</div>
            <div className="text-lg font-bold text-purple-900">
              {data.transactionChart.length > 0 ? 
                data.transactionChart.reduce((max, type) => parseFloat(type.revenue) > parseFloat(max.revenue) ? type : max).type
                : 'N/A'}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-700">Total Transacciones</div>
            <div className="text-lg font-bold text-yellow-900">
              {data.transactionChart.reduce((total, type) => total + type.count, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}