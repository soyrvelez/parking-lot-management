import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/stats', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    const value = new Decimal(amount);
    return `$${value.toFixed(2)}`;
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
              <card.icon className={`w-6 h-6 ${card.textColor}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Alert Card if there are pending issues */}
      {stats.pendingIssues > 0 && (
        <div className="md:col-span-2 lg:col-span-4">
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
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