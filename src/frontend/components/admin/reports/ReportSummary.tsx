import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Car, Users, Clock, Calculator } from 'lucide-react';
import Decimal from 'decimal.js';

interface ReportSummaryData {
  totalRevenue: string;
  totalTransactions: number;
  averageTransaction: string;
  totalVehicles: number;
  averageStay: string;
  revenueChange: string;
  transactionChange: string;
  peakHour: string;
  cashOnHand: string;
}

interface ReportSummaryProps {
  filters: {
    startDate: string;
    endDate: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    transactionType: string;
  };
}

export default function ReportSummary({ filters }: ReportSummaryProps) {
  const [data, setData] = useState<ReportSummaryData>({
    totalRevenue: '0.00',
    totalTransactions: 0,
    averageTransaction: '0.00',
    totalVehicles: 0,
    averageStay: '0h 0m',
    revenueChange: '0.00',
    transactionChange: '0.00',
    peakHour: '12:00',
    cashOnHand: '0.00',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSummaryData();
  }, [filters]);

  const fetchSummaryData = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        reportType: filters.reportType,
        transactionType: filters.transactionType,
      });

      const response = await fetch(`/api/admin/reports/summary?${queryParams}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const summaryData = await response.json();
        setData(summaryData);
      }
    } catch (error) {
      console.error('Error fetching report summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    const value = new Decimal(amount);
    return `$${value.toFixed(2)}`;
  };

  const formatChange = (change: string) => {
    const value = new Decimal(change);
    const isPositive = value.gte(0);
    return {
      value: `${isPositive ? '+' : ''}${value.toFixed(2)}%`,
      color: isPositive ? 'text-green-600' : 'text-red-600',
      icon: isPositive ? TrendingUp : TrendingDown,
    };
  };

  const summaryCards = [
    {
      title: 'Ingresos Totales',
      value: formatCurrency(data.totalRevenue),
      subtitle: 'MXN',
      icon: DollarSign,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      change: formatChange(data.revenueChange),
    },
    {
      title: 'Total Transacciones',
      value: data.totalTransactions.toLocaleString(),
      subtitle: 'operaciones',
      icon: Calculator,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      change: formatChange(data.transactionChange),
    },
    {
      title: 'Transacción Promedio',
      value: formatCurrency(data.averageTransaction),
      subtitle: 'por operación',
      icon: TrendingUp,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Vehículos Atendidos',
      value: data.totalVehicles.toLocaleString(),
      subtitle: 'automóviles',
      icon: Car,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    {
      title: 'Estancia Promedio',
      value: data.averageStay,
      subtitle: 'tiempo por vehículo',
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
    {
      title: 'Hora Pico',
      value: data.peakHour,
      subtitle: 'mayor actividad',
      icon: Users,
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {summaryCards.map((card, index) => (
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
            
            {card.change && (
              <div className="flex items-center gap-1">
                <card.change.icon className={`w-3 h-3 ${card.change.color}`} />
                <span className={`text-xs font-medium ${card.change.color}`}>
                  {card.change.value}
                </span>
                <span className="text-xs text-gray-500">vs anterior</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Cash on Hand Card - Full Width */}
      <div className="md:col-span-2 lg:col-span-3 xl:col-span-6">
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-900">Efectivo en Caja</h3>
                <p className="text-sm text-green-700">Saldo actual disponible</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-green-900">
                {formatCurrency(data.cashOnHand)}
              </div>
              <div className="text-sm text-green-700">MXN</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}