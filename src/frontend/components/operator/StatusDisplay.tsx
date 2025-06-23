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
    const interval = setInterval(fetchStats, 3 * 60 * 1000); // Less aggressive polling - every 3 minutes
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 sm:gap-4 lg:gap-6">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-3 w-3 sm:h-4 sm:w-4 bg-gray-200 rounded"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-12 sm:w-16"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-16 sm:w-20"></div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 lg:gap-4 w-full">
          <div className="animate-pulse h-8 sm:h-10 bg-gray-200 rounded-lg w-full sm:w-24 lg:w-28"></div>
          <div className="animate-pulse h-8 sm:h-10 bg-gray-200 rounded-lg w-full sm:w-28 lg:w-32"></div>
          <div className="animate-pulse h-8 sm:h-10 bg-gray-200 rounded-lg w-full sm:w-32 lg:w-36"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 sm:gap-4 lg:gap-6">
      {/* System Status Indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-primary-600" />
        <span className="text-xs sm:text-sm text-gray-600">Sistema:</span>
        <span className={`text-xs sm:text-sm font-medium ${getStatusColor(stats.systemStatus)}`}>
          {getStatusText(stats.systemStatus)}
        </span>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:items-center gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto">
        <div className="flex items-center gap-2 sm:gap-3 bg-blue-50 px-2 py-2 sm:px-3 sm:py-2 rounded-lg touch-manipulation">
          <Car className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1 min-w-0">
            <span className="text-xs sm:text-sm text-blue-800">Activos:</span>
            <span className="text-lg sm:text-xl lg:text-lg font-bold text-blue-900">{stats.activeTickets}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 bg-green-50 px-2 py-2 sm:px-3 sm:py-2 rounded-lg touch-manipulation">
          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1 min-w-0">
            <span className="text-xs sm:text-sm text-green-800">Hoy:</span>
            <span className="text-sm sm:text-base lg:text-sm font-bold text-green-900 truncate">{formatCurrency(stats.todayRevenue)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 bg-purple-50 px-2 py-2 sm:px-3 sm:py-2 rounded-lg touch-manipulation">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-1 min-w-0">
            <span className="text-xs sm:text-sm text-purple-800">Promedio:</span>
            <span className="text-sm sm:text-base lg:text-sm font-bold text-purple-900 truncate">{stats.averageStay}</span>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-xs text-gray-400 lg:ml-auto self-end lg:self-auto">
        <span className="hidden sm:inline">Actualizado cada 3min</span>
        <span className="sm:hidden">Act. 3min</span>
      </div>
    </div>
  );
}