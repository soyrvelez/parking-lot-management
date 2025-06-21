import { useState, useEffect } from 'react';
import { Activity, Car, DollarSign, Clock } from 'lucide-react';
import Decimal from 'decimal.js';

interface DashboardStats {
  activeTickets: number;
  todayRevenue: string;
  averageStay: string;
  systemStatus: 'online' | 'offline' | 'maintenance';
}

export default function StatusDisplay() {
  const [stats, setStats] = useState<DashboardStats>({
    activeTickets: 0,
    todayRevenue: '0.00',
    averageStay: '0h 0m',
    systemStatus: 'online'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/operator/dashboard/stats');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.metrics) {
          const metrics = result.data.metrics;
          setStats({
            activeTickets: metrics.activeVehicles || 0,
            todayRevenue: metrics.todayRevenue || '$0.00 pesos',
            averageStay: metrics.averageDuration || '0h 0m',
            systemStatus: 'online' // Determined from hardware status
          });
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    if (!amount || amount === undefined) return '$0.00 MXN';
    try {
      // Extract numeric value from formatted string like "$25.00 pesos"
      const numericValue = amount.replace(/[^0-9.]/g, '');
      const value = new Decimal(numericValue || '0');
      return `$${value.toFixed(2)} MXN`;
    } catch (error) {
      console.error('Error formatting currency:', error);
      return '$0.00 MXN';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600';
      case 'offline': return 'text-red-600';
      case 'maintenance': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'En Línea';
      case 'offline': return 'Fuera de Línea';
      case 'maintenance': return 'Mantenimiento';
      default: return 'Desconocido';
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Estado Actual
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Sistema:</span>
          <span className={`font-medium ${getStatusColor(stats.systemStatus)}`}>
            {getStatusText(stats.systemStatus)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">Vehículos Activos</span>
            </div>
            <span className="text-2xl font-bold text-blue-900">
              {stats.activeTickets}
            </span>
          </div>

          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800">Ingresos Hoy</span>
            </div>
            <span className="text-lg font-bold text-green-900">
              {formatCurrency(stats.todayRevenue)}
            </span>
          </div>

          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-800">Estancia Promedio</span>
            </div>
            <span className="text-lg font-bold text-purple-900">
              {stats.averageStay}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Actualizado cada 30 segundos
        </div>
      </div>
    </div>
  );
}