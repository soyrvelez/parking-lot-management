import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Car, DollarSign, Clock, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import Decimal from 'decimal.js';

interface DashboardStatsData {
  activeTickets: number;
  todayRevenue: string;
  averageStay: string;
  totalSpaces: number;
  occupancyRate: number;
  pendingIssues: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStatsData>({
    activeTickets: 0,
    todayRevenue: '0.00',
    averageStay: '0h 0m',
    totalSpaces: 100,
    occupancyRate: 0,
    pendingIssues: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { authenticatedFetch } = useAdminAuth();

  useEffect(() => {
    fetchStats();
    // Much less aggressive polling - every 5 minutes in development
    const interval = setInterval(fetchStats, 5 * 60 * 1000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []); // FIXED: Removed authenticatedFetch dependency to prevent interval explosion

  const fetchStats = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/dashboard');

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.metrics) {
          const metrics = result.data.metrics;
          setStats({
            activeTickets: metrics.activeVehicles || 0,
            todayRevenue: metrics.todayRevenue?.replace(/[\$,\s]|pesos/g, '') || '0.00',
            averageStay: metrics.averageDuration || '0h 0m',
            totalSpaces: 100, // Default value, could be configured
            occupancyRate: Math.round((metrics.activeVehicles / 100) * 100) || 0,
            pendingIssues: 0, // Not provided by current API
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    try {
      // Remove any non-numeric characters except decimal points and minus signs
      const cleanAmount = amount.replace(/[^0-9.-]/g, '');
      const value = new Decimal(cleanAmount || '0');
      return `$${value.toFixed(2)}`;
    } catch (error) {
      console.warn('Error formatting currency:', amount, error);
      return '$0.00';
    }
  };

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600 bg-red-100';
    if (rate >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const statCards = [
    {
      title: 'Vehículos Activos',
      value: stats.activeTickets.toString(),
      subtitle: `de ${stats.totalSpaces} espacios`,
      icon: Car,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Ingresos del Día',
      value: formatCurrency(stats.todayRevenue),
      subtitle: 'MXN',
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Estancia Promedio',
      value: stats.averageStay,
      subtitle: 'tiempo por vehículo',
      icon: Clock,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Ocupación',
      value: `${stats.occupancyRate}%`,
      subtitle: 'del espacio total',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border animate-pulse">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg flex-shrink-0"></div>
              <div className="flex-1 min-w-0">
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-2 sm:h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {statCards.map((card, index) => (
        <div key={index} className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.textColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{card.title}</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1 truncate">{card.subtitle}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Alert Card if there are pending issues */}
      {stats.pendingIssues > 0 && (
        <div className="sm:col-span-2 lg:col-span-4">
          <div className="bg-yellow-50 border border-yellow-200 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-yellow-800">
                  Atención Requerida
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {stats.pendingIssues} problemas pendientes que requieren revisión
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}