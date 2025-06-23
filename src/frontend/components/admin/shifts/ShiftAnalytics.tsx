import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Clock, Target, AlertTriangle, Award } from 'lucide-react';
import Decimal from 'decimal.js';

interface AnalyticsData {
  productivityTrends: Array<{
    month: string;
    avgTransactionsPerHour: number;
    avgRevenuePerHour: number;
    efficiency: number;
  }>;
  shiftDistribution: Array<{
    timeSlot: string;
    operatorCount: number;
    transactionVolume: number;
    efficiency: number;
  }>;
  operatorComparison: Array<{
    operator: string;
    efficiency: number;
    revenue: number;
    hoursWorked: number;
  }>;
  performanceMetrics: {
    avgEfficiency: number;
    topPerformerEfficiency: number;
    improvementOpportunity: number;
    staffUtilization: number;
  };
  predictiveInsights: {
    nextWeekDemand: number;
    recommendedStaffing: number;
    expectedRevenue: string;
    riskFactors: string[];
  };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ShiftAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    productivityTrends: [],
    shiftDistribution: [],
    operatorComparison: [],
    performanceMetrics: {
      avgEfficiency: 0,
      topPerformerEfficiency: 0,
      improvementOpportunity: 0,
      staffUtilization: 0,
    },
    predictiveInsights: {
      nextWeekDemand: 0,
      recommendedStaffing: 0,
      expectedRevenue: '0.00',
      riskFactors: [],
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<'efficiency' | 'revenue' | 'transactions'>('efficiency');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch('/api/admin/shifts/analytics', {
        credentials: 'include',
      });

      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${new Decimal(amount).toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('revenue') || entry.name.includes('Revenue')
                ? formatCurrency(entry.value)
                : entry.name.includes('efficiency') || entry.name.includes('Efficiency')
                ? `${entry.value}%`
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getMetricColor = (value: number, type: 'efficiency' | 'utilization') => {
    const thresholds = {
      efficiency: { good: 85, fair: 70 },
      utilization: { good: 80, fair: 60 },
    };

    const threshold = thresholds[type];
    if (value >= threshold.good) return 'text-green-600';
    if (value >= threshold.fair) return 'text-yellow-600';
    return 'text-red-600';
  };

  const metricCards = [
    {
      title: 'Eficiencia Promedio',
      value: `${data.performanceMetrics.avgEfficiency.toFixed(1)}%`,
      subtitle: 'del equipo completo',
      icon: Target,
      color: getMetricColor(data.performanceMetrics.avgEfficiency, 'efficiency'),
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Mejor Rendimiento',
      value: `${data.performanceMetrics.topPerformerEfficiency.toFixed(1)}%`,
      subtitle: 'operador destacado',
      icon: Award,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Oportunidad de Mejora',
      value: `${data.performanceMetrics.improvementOpportunity.toFixed(1)}%`,
      subtitle: 'potencial de crecimiento',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Utilización de Personal',
      value: `${data.performanceMetrics.staffUtilization.toFixed(1)}%`,
      subtitle: 'capacidad utilizada',
      icon: Users,
      color: getMetricColor(data.performanceMetrics.staffUtilization, 'utilization'),
      bgColor: 'bg-green-50',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-xs text-gray-500">{card.subtitle}</p>
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Trends */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Tendencias de Productividad</h3>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="input-field text-sm"
            >
              <option value="efficiency">Eficiencia</option>
              <option value="revenue">Ingresos por Hora</option>
              <option value="transactions">Transacciones por Hora</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.productivityTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey={selectedMetric === 'efficiency' ? 'efficiency' : 
                           selectedMetric === 'revenue' ? 'avgRevenuePerHour' : 'avgTransactionsPerHour'}
                  stroke="#10b981" 
                  strokeWidth={3}
                  name={selectedMetric === 'efficiency' ? 'Eficiencia (%)' : 
                        selectedMetric === 'revenue' ? 'Ingresos por Hora' : 'Transacciones por Hora'}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shift Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Turno</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.shiftDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="timeSlot" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="efficiency" 
                  fill="#3b82f6" 
                  name="Eficiencia (%)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operator Comparison */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparación de Operadores</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.operatorComparison} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis dataKey="operator" type="category" width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="efficiency" 
                  fill="#10b981" 
                  name="Eficiencia (%)"
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Rendimiento</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Alto Rendimiento (>85%)', value: data.operatorComparison.filter(op => op.efficiency >= 85).length },
                    { name: 'Rendimiento Medio (70-85%)', value: data.operatorComparison.filter(op => op.efficiency >= 70 && op.efficiency < 85).length },
                    { name: 'Necesita Mejora (<70%)', value: data.operatorComparison.filter(op => op.efficiency < 70).length },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {[
                    { name: 'Alto Rendimiento (>85%)', value: data.operatorComparison.filter(op => op.efficiency >= 85).length },
                    { name: 'Rendimiento Medio (70-85%)', value: data.operatorComparison.filter(op => op.efficiency >= 70 && op.efficiency < 85).length },
                    { name: 'Necesita Mejora (<70%)', value: data.operatorComparison.filter(op => op.efficiency < 70).length },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Predictive Insights */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Análisis Predictivo</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Proyección Próxima Semana</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Demanda esperada:</span>
                <span className="font-medium">{data.predictiveInsights.nextWeekDemand}%</span>
              </div>
              <div className="flex justify-between">
                <span>Personal recomendado:</span>
                <span className="font-medium">{data.predictiveInsights.recommendedStaffing} operadores</span>
              </div>
              <div className="flex justify-between">
                <span>Ingresos esperados:</span>
                <span className="font-medium">{formatCurrency(parseFloat(data.predictiveInsights.expectedRevenue))}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Oportunidades de Optimización</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div>• Redistribuir personal en horas pico</div>
              <div>• Implementar capacitación en eficiencia</div>
              <div>• Optimizar horarios de descanso</div>
              <div>• Automatizar procesos repetitivos</div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">Factores de Riesgo</h4>
            <div className="space-y-2 text-sm text-yellow-800">
              {data.predictiveInsights.riskFactors.length > 0 ? (
                data.predictiveInsights.riskFactors.map((risk, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    {risk}
                  </div>
                ))
              ) : (
                <div>• No se identificaron riesgos inmediatos</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights Clave</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Fortalezas Identificadas</h4>
            <div className="space-y-2 text-sm text-gray-700">
              {data.performanceMetrics.avgEfficiency >= 80 && (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  Alta eficiencia general del equipo
                </div>
              )}
              {data.performanceMetrics.staffUtilization >= 75 && (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  Buena utilización del personal disponible
                </div>
              )}
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                Tendencia positiva en productividad
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Áreas de Mejora</h4>
            <div className="space-y-2 text-sm text-gray-700">
              {data.performanceMetrics.improvementOpportunity > 15 && (
                <div className="flex items-center gap-2 text-orange-600">
                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                  Amplio margen de mejora disponible
                </div>
              )}
              {data.operatorComparison.filter(op => op.efficiency < 70).length > 0 && (
                <div className="flex items-center gap-2 text-orange-600">
                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                  Algunos operadores necesitan capacitación
                </div>
              )}
              <div className="flex items-center gap-2 text-orange-600">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                Optimizar distribución de turnos
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}