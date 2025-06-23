import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, User, Award, Clock, DollarSign, Activity, Target, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment-timezone';
import Decimal from 'decimal.js';

interface OperatorMetrics {
  id: string;
  name: string;
  totalShifts: number;
  totalHours: number;
  totalTransactions: number;
  totalRevenue: string;
  avgTransactionTime: number;
  efficiency: number;
  punctuality: number;
  customerSatisfaction: number;
  errorRate: number;
  lastShiftDate: string;
  performanceTrend: 'up' | 'down' | 'stable';
  weeklyData: Array<{
    day: string;
    transactions: number;
    revenue: number;
    efficiency: number;
  }>;
}

interface PerformanceData {
  operators: OperatorMetrics[];
  summary: {
    topPerformer: string;
    avgEfficiency: number;
    totalRevenue: string;
    improvementAreas: string[];
  };
}

export default function OperatorPerformance() {
  const [data, setData] = useState<PerformanceData>({
    operators: [],
    summary: {
      topPerformer: '',
      avgEfficiency: 0,
      totalRevenue: '0.00',
      improvementAreas: [],
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<OperatorMetrics | null>(null);
  const [sortBy, setSortBy] = useState<'efficiency' | 'revenue' | 'transactions'>('efficiency');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');

  useEffect(() => {
    fetchPerformanceData();
  }, [timeRange]);

  const fetchPerformanceData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/shifts/performance?timeRange=${timeRange}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const performanceData = await response.json();
        setData(performanceData);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    const value = new Decimal(amount);
    return `$${value.toFixed(2)}`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return TrendingUp;
      case 'down': return TrendingDown;
      default: return Activity;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPerformanceColor = (value: number, type: 'efficiency' | 'punctuality' | 'satisfaction') => {
    const thresholds = {
      efficiency: { good: 85, fair: 70 },
      punctuality: { good: 90, fair: 80 },
      satisfaction: { good: 4.0, fair: 3.5 },
    };

    const threshold = thresholds[type];
    if (value >= threshold.good) return 'text-green-600';
    if (value >= threshold.fair) return 'text-yellow-600';
    return 'text-red-600';
  };

  const sortedOperators = [...data.operators].sort((a, b) => {
    switch (sortBy) {
      case 'efficiency':
        return b.efficiency - a.efficiency;
      case 'revenue':
        return new Decimal(b.totalRevenue).minus(new Decimal(a.totalRevenue)).toNumber();
      case 'transactions':
        return b.totalTransactions - a.totalTransactions;
      default:
        return 0;
    }
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('revenue') 
                ? `$${entry.value} MXN` 
                : entry.name.includes('efficiency')
                ? `${entry.value}%`
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Mejor Operador</div>
              <div className="text-lg font-bold text-gray-900">{data.summary.topPerformer || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Eficiencia Promedio</div>
              <div className="text-lg font-bold text-gray-900">{data.summary.avgEfficiency.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Ingresos Totales</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(data.summary.totalRevenue)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Período</div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="text-sm font-bold text-gray-900 bg-transparent border-none p-0"
              >
                <option value="week">Esta Semana</option>
                <option value="month">Este Mes</option>
                <option value="quarter">Trimestre</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Operators Performance Table */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Rendimiento por Operador</h3>
            <p className="text-sm text-gray-500">{data.operators.length} operadores evaluados</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input-field text-sm"
            >
              <option value="efficiency">Eficiencia</option>
              <option value="revenue">Ingresos</option>
              <option value="transactions">Transacciones</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operador
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Turnos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transacciones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingresos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eficiencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Puntualidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tendencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedOperators.map((operator) => {
                const TrendIcon = getTrendIcon(operator.performanceTrend);
                
                return (
                  <tr key={operator.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{operator.name}</div>
                          <div className="text-xs text-gray-500">
                            Último: {moment.tz(operator.lastShiftDate, 'America/Mexico_City').format('DD/MM')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{operator.totalShifts}</div>
                      <div className="text-xs text-gray-500">{operator.totalHours.toFixed(1)}h total</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{operator.totalTransactions}</div>
                      <div className="text-xs text-gray-500">{operator.avgTransactionTime}s promedio</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">{formatCurrency(operator.totalRevenue)}</div>
                      <div className="text-xs text-gray-500">MXN</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(operator.efficiency, 'efficiency')}`}>
                        {operator.efficiency}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getPerformanceColor(operator.punctuality, 'punctuality')}`}>
                        {operator.punctuality}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TrendIcon className={`w-4 h-4 ${getTrendColor(operator.performanceTrend)}`} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedOperator(operator)}
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operator Detail Modal */}
      {selectedOperator && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedOperator(null)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Detalles de Rendimiento - {selectedOperator.name}</h3>
                  <button
                    onClick={() => setSelectedOperator(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance Chart */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Rendimiento Semanal</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedOperator.weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="efficiency" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            name="Eficiencia (%)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Detailed Metrics */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600">Satisfacción Cliente</div>
                        <div className={`text-lg font-bold ${getPerformanceColor(selectedOperator.customerSatisfaction, 'satisfaction')}`}>
                          {selectedOperator.customerSatisfaction.toFixed(1)}/5.0
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600">Tasa de Error</div>
                        <div className={`text-lg font-bold ${selectedOperator.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedOperator.errorRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-medium text-blue-900 mb-2">Áreas de Mejora</h5>
                      <div className="text-sm text-blue-800 space-y-1">
                        {selectedOperator.efficiency < 80 && <p>• Mejorar velocidad de procesamiento</p>}
                        {selectedOperator.punctuality < 90 && <p>• Trabajar en puntualidad</p>}
                        {selectedOperator.errorRate > 3 && <p>• Reducir errores en transacciones</p>}
                        {selectedOperator.customerSatisfaction < 4 && <p>• Mejorar atención al cliente</p>}
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-medium text-green-900 mb-2">Fortalezas</h5>
                      <div className="text-sm text-green-800 space-y-1">
                        {selectedOperator.efficiency >= 85 && <p>• Excelente eficiencia operativa</p>}
                        {selectedOperator.punctuality >= 95 && <p>• Muy puntual</p>}
                        {selectedOperator.errorRate <= 2 && <p>• Baja tasa de errores</p>}
                        {selectedOperator.customerSatisfaction >= 4.5 && <p>• Excelente servicio al cliente</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Improvement Areas */}
      {data.summary.improvementAreas.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Áreas de Mejora General</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.summary.improvementAreas.map((area, index) => (
              <div key={index} className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-800">{area}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}