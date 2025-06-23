import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Car, Users, Clock, Calculator } from 'lucide-react';
import Decimal from 'decimal.js';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

interface ReportSummaryData {
  totalRevenue: string;
  totalTransactions: number;
  averageTicketValue: string;
  peakHours: Array<{ hour: string; count: number }>;
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
  const { authenticatedFetch } = useAdminAuth();
  const [data, setData] = useState<ReportSummaryData>({
    totalRevenue: '$0.00 pesos',
    totalTransactions: 0,
    averageTicketValue: '$0.00 pesos',
    peakHours: [],
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

      const response = await authenticatedFetch(`/api/admin/reports/summary?${queryParams}`);

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching report summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    // API already returns formatted currency strings, so just return as-is
    return amount || '$0.00 pesos';
  };

  const getPeakHour = () => {
    if (data.peakHours && data.peakHours.length > 0) {
      return data.peakHours[0].hour;
    }
    return '12:00';
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
    },
    {
      title: 'Total Transacciones',
      value: data.totalTransactions.toLocaleString(),
      subtitle: 'operaciones',
      icon: Calculator,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Ticket Promedio',
      value: formatCurrency(data.averageTicketValue),
      subtitle: 'por operación',
      icon: TrendingUp,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Hora Pico',
      value: getPeakHour(),
      subtitle: 'mayor actividad',
      icon: Clock,
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
            
          </div>
        </div>
      ))}

      {/* Peak Hours Summary - Full Width */}
      <div className="md:col-span-2 lg:col-span-3 xl:col-span-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Horas Pico</h3>
                <p className="text-sm text-blue-700">Mayor actividad del período</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {data.peakHours.slice(0, 2).map(peak => peak.hour).join(', ') || 'N/A'}
              </div>
              <div className="text-sm text-blue-700">
                {data.peakHours.length > 0 ? `${data.peakHours[0].count} transacciones` : 'Sin datos'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}