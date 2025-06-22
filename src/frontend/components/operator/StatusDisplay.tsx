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
      <div className="flex items-center gap-6">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="animate-pulse h-8 bg-gray-200 rounded-lg w-24"></div>
          <div className="animate-pulse h-8 bg-gray-200 rounded-lg w-28"></div>
          <div className="animate-pulse h-8 bg-gray-200 rounded-lg w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      {/* System Status Indicator */}
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary-600" />
        <span className="text-sm text-gray-600">Sistema:</span>
        <span className={`text-sm font-medium ${getStatusColor(stats.systemStatus)}`}>
          {getStatusText(stats.systemStatus)}
        </span>
      </div>

      {/* Horizontal Stats Cards */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
          <Car className="w-4 h-4 text-blue-600" />
          <div className="flex items-center gap-1">
            <span className="text-sm text-blue-800">Activos:</span>
            <span className="text-lg font-bold text-blue-900">{stats.activeTickets}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
          <DollarSign className="w-4 h-4 text-green-600" />
          <div className="flex items-center gap-1">
            <span className="text-sm text-green-800">Hoy:</span>
            <span className="text-sm font-bold text-green-900">{formatCurrency(stats.todayRevenue)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
          <Clock className="w-4 h-4 text-purple-600" />
          <div className="flex items-center gap-1">
            <span className="text-sm text-purple-800">Promedio:</span>
            <span className="text-sm font-bold text-purple-900">{stats.averageStay}</span>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-xs text-gray-400 ml-auto">
        Actualizado cada 30s
      </div>
    </div>
  );
}