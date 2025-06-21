import { useState, useEffect } from 'react';
import { Clock, User, Activity, TrendingUp, AlertTriangle, CheckCircle, Coffee, Zap } from 'lucide-react';
import moment from 'moment-timezone';
import Decimal from 'decimal.js';

interface CurrentShift {
  id: string;
  operatorId: string;
  operatorName: string;
  startTime: string;
  plannedEndTime: string;
  status: 'active' | 'break' | 'ending';
  transactions: number;
  revenue: string;
  avgTransactionTime: number;
  efficiency: number;
}

interface ShiftStats {
  currentShifts: CurrentShift[];
  totalOperators: number;
  activeOperators: number;
  onBreakOperators: number;
  todayRevenue: string;
  todayTransactions: number;
  avgShiftLength: number;
  coveragePercentage: number;
}

export default function ShiftOverview() {
  const [stats, setStats] = useState<ShiftStats>({
    currentShifts: [],
    totalOperators: 0,
    activeOperators: 0,
    onBreakOperators: 0,
    todayRevenue: '0.00',
    todayTransactions: 0,
    avgShiftLength: 0,
    coveragePercentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchShiftOverview();
    const interval = setInterval(fetchShiftOverview, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchShiftOverview = async () => {
    try {
      const response = await fetch('/api/admin/shifts/overview', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching shift overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    const value = new Decimal(amount);
    return `$${value.toFixed(2)}`;
  };

  const formatDuration = (startTime: string) => {
    const start = moment.tz(startTime, 'America/Mexico_City');
    const now = moment.tz('America/Mexico_City');
    const duration = moment.duration(now.diff(start));
    
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return Activity;
      case 'break': return Coffee;
      case 'ending': return Clock;
      default: return User;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'break': return 'text-yellow-600 bg-yellow-100';
      case 'ending': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'break': return 'En Descanso';
      case 'ending': return 'Finalizando';
      default: return status;
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'text-green-600';
    if (efficiency >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const overviewCards = [
    {
      title: 'Operadores Totales',
      value: stats.totalOperators.toString(),
      subtitle: 'registrados en el sistema',
      icon: User,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Operadores Activos',
      value: stats.activeOperators.toString(),
      subtitle: 'trabajando actualmente',
      icon: Activity,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'En Descanso',
      value: stats.onBreakOperators.toString(),
      subtitle: 'tomando un receso',
      icon: Coffee,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
    {
      title: 'Cobertura',
      value: `${stats.coveragePercentage}%`,
      subtitle: 'del horario planificado',
      icon: CheckCircle,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Ingresos del Día',
      value: formatCurrency(stats.todayRevenue),
      subtitle: 'MXN generados hoy',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    {
      title: 'Transacciones',
      value: stats.todayTransactions.toString(),
      subtitle: 'procesadas hoy',
      icon: Zap,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow-sm border animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {overviewCards.map((card, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600 truncate">{card.title}</p>
                <p className="text-xs text-gray-500 truncate">{card.subtitle}</p>
              </div>
            </div>
            <p className="text-lg font-bold text-gray-900 truncate">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Current Shifts */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Turnos Actuales</h3>
            <p className="text-sm text-gray-500">{stats.currentShifts.length} operadores trabajando</p>
          </div>
          <div className="text-sm text-gray-500">
            Actualizado: {moment.tz('America/Mexico_City').format('HH:mm:ss')}
          </div>
        </div>

        <div className="space-y-4">
          {stats.currentShifts.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto w-12 h-12 text-gray-400 mb-3" />
              <p className="text-gray-500">No hay operadores trabajando actualmente</p>
            </div>
          ) : (
            stats.currentShifts.map((shift) => {
              const StatusIcon = getStatusIcon(shift.status);
              
              return (
                <div key={shift.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{shift.operatorName}</div>
                        <div className="text-sm text-gray-500">
                          Turno: {formatDuration(shift.startTime)} • 
                          Termina: {moment.tz(shift.plannedEndTime, 'America/Mexico_City').format('HH:mm')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Performance Metrics */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">{shift.transactions}</div>
                        <div className="text-xs text-gray-500">Transacciones</div>
                      </div>

                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{formatCurrency(shift.revenue)}</div>
                        <div className="text-xs text-gray-500">Ingresos</div>
                      </div>

                      <div className="text-center">
                        <div className={`text-lg font-bold ${getEfficiencyColor(shift.efficiency)}`}>
                          {shift.efficiency}%
                        </div>
                        <div className="text-xs text-gray-500">Eficiencia</div>
                      </div>

                      {/* Status */}
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(shift.status)}`}>
                        <StatusIcon className="w-4 h-4" />
                        {getStatusText(shift.status)}
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Tiempo promedio por transacción: {shift.avgTransactionTime}s</span>
                      {shift.efficiency < 70 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Rendimiento bajo</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            <button className="btn-primary w-full">Iniciar Nuevo Turno</button>
            <button className="btn-secondary w-full">Programar Descanso</button>
            <button className="btn-secondary w-full">Finalizar Turno</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas</h3>
          <div className="space-y-3">
            {stats.coveragePercentage < 80 && (
              <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Cobertura baja ({stats.coveragePercentage}%)</span>
              </div>
            )}
            {stats.activeOperators === 0 && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Sin operadores activos</span>
              </div>
            )}
            {stats.currentShifts.filter(s => s.efficiency < 70).length > 0 && (
              <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">
                  {stats.currentShifts.filter(s => s.efficiency < 70).length} operador(es) con bajo rendimiento
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Día</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Horas trabajadas:</span>
              <span className="font-medium">{(stats.avgShiftLength * stats.activeOperators).toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Promedio por operador:</span>
              <span className="font-medium">{stats.avgShiftLength.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ingresos por hora:</span>
              <span className="font-medium text-green-600">
                {stats.avgShiftLength > 0 ? 
                  formatCurrency((new Decimal(stats.todayRevenue).div(stats.avgShiftLength * stats.activeOperators || 1)).toString()) 
                  : '$0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}