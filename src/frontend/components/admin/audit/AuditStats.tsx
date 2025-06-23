import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Shield, TrendingUp, Users, Database, Zap } from 'lucide-react';

interface AuditStatsData {
  totalEvents: number;
  criticalEvents: number;
  securityEvents: number;
  uniqueUsers: number;
  systemErrors: number;
  avgEventsPerHour: number;
  topCategories: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  recentTrends: {
    eventsChange: number;
    errorsChange: number;
    securityChange: number;
  };
}

interface AuditStatsProps {
  filters: {
    startDate: string;
    endDate: string;
    level: string;
    category: string;
    userId: string;
    search: string;
  };
}

export default function AuditStats({ filters }: AuditStatsProps) {
  const [stats, setStats] = useState<AuditStatsData>({
    totalEvents: 0,
    criticalEvents: 0,
    securityEvents: 0,
    uniqueUsers: 0,
    systemErrors: 0,
    avgEventsPerHour: 0,
    topCategories: [],
    recentTrends: {
      eventsChange: 0,
      errorsChange: 0,
      securityChange: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuditStats();
  }, [filters]);

  const fetchAuditStats = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        level: filters.level,
        category: filters.category,
        userId: filters.userId,
        search: filters.search,
      });

      const response = await fetch(`/api/admin/audit/stats?${queryParams}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTrend = (change: number) => {
    const isPositive = change >= 0;
    return {
      value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      color: isPositive ? 'text-green-600' : 'text-red-600',
      icon: isPositive ? TrendingUp : TrendingUp, // Could use TrendingDown icon
    };
  };

  const getIntensityColor = (value: number, max: number) => {
    const intensity = value / max;
    if (intensity > 0.7) return 'bg-red-500';
    if (intensity > 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const statCards = [
    {
      title: 'Total de Eventos',
      value: stats.totalEvents.toLocaleString(),
      subtitle: 'en el período seleccionado',
      icon: Activity,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      trend: formatTrend(stats.recentTrends.eventsChange),
    },
    {
      title: 'Eventos Críticos',
      value: stats.criticalEvents.toLocaleString(),
      subtitle: 'errores y advertencias',
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      trend: formatTrend(stats.recentTrends.errorsChange),
    },
    {
      title: 'Eventos de Seguridad',
      value: stats.securityEvents.toLocaleString(),
      subtitle: 'autenticación y acceso',
      icon: Shield,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      trend: formatTrend(stats.recentTrends.securityChange),
    },
    {
      title: 'Usuarios Únicos',
      value: stats.uniqueUsers.toLocaleString(),
      subtitle: 'usuarios activos',
      icon: Users,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Errores del Sistema',
      value: stats.systemErrors.toLocaleString(),
      subtitle: 'fallos y excepciones',
      icon: Database,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
    {
      title: 'Promedio por Hora',
      value: stats.avgEventsPerHour.toFixed(1),
      subtitle: 'eventos por hora',
      icon: Zap,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
  ];

  if (isLoading) {
    return (
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
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, index) => (
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
            
            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-900 truncate">{card.value}</p>
              
              {card.trend && (
                <div className="flex items-center gap-1">
                  <card.trend.icon className={`w-3 h-3 ${card.trend.color}`} />
                  <span className={`text-xs font-medium ${card.trend.color}`}>
                    {card.trend.value}
                  </span>
                  <span className="text-xs text-gray-500">vs anterior</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Top Categories */}
      {stats.topCategories.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Categoría</h3>
          <div className="space-y-3">
            {stats.topCategories.map((category, index) => {
              const maxCount = Math.max(...stats.topCategories.map(c => c.count));
              const widthPercentage = (category.count / maxCount) * 100;
              
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700 capitalize">
                    {category.category === 'auth' ? 'Autenticación' :
                     category.category === 'transaction' ? 'Transacciones' :
                     category.category === 'system' ? 'Sistema' :
                     category.category === 'operator' ? 'Operadores' :
                     category.category === 'hardware' ? 'Hardware' :
                     category.category === 'admin' ? 'Administración' :
                     category.category}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 relative">
                    <div 
                      className={`h-2 rounded-full ${getIntensityColor(category.count, maxCount)}`}
                      style={{ width: `${widthPercentage}%` }}
                    ></div>
                  </div>
                  <div className="w-16 text-right">
                    <div className="text-sm font-bold text-gray-900">{category.count}</div>
                    <div className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}