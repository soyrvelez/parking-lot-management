import { useState, useEffect } from 'react';
import { DollarSign, Car, AlertCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import moment from 'moment-timezone';
import Decimal from 'decimal.js';

interface Transaction {
  id: string;
  type: 'PARKING' | 'PENSION' | 'LOST_TICKET' | 'REFUND';
  amount: string;
  plateNumber?: string;
  timestamp: string;
  description?: string;
}

interface RecentTransactionsData {
  transactions: Transaction[];
  totalToday: string;
  transactionCount: number;
  avgTransaction: string;
}

export default function RecentTransactions() {
  const { authenticatedFetch } = useAdminAuth();
  const [data, setData] = useState<RecentTransactionsData>({
    transactions: [],
    totalToday: '0.00',
    transactionCount: 0,
    avgTransaction: '0.00',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 2 * 60 * 1000); // Much less aggressive polling - every 2 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/transactions/recent?limit=10');

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Transform the backend response to match component interface
          const transactions = result.data.transactions.map((transaction: any) => ({
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            plateNumber: transaction.ticket?.plateNumber || transaction.pension?.plateNumber,
            timestamp: transaction.timestamp,
            description: transaction.description
          }));

          // Calculate summary stats
          const totalAmount = transactions.reduce((sum: Decimal, t: any) => {
            const amount = new Decimal(t.amount);
            return t.type === 'REFUND' ? sum.minus(amount) : sum.plus(amount);
          }, new Decimal(0));

          const avgAmount = transactions.length > 0 
            ? totalAmount.dividedBy(transactions.length) 
            : new Decimal(0);

          setData({
            transactions,
            totalToday: totalAmount.toFixed(2),
            transactionCount: transactions.length,
            avgTransaction: avgAmount.toFixed(2)
          });
        }
      }
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTransactions();
  };

  const formatCurrency = (amount: string) => {
    const value = new Decimal(amount);
    return `$${value.toFixed(2)}`;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PARKING': return Car;
      case 'PENSION': return TrendingUp;
      case 'LOST_TICKET': return AlertCircle;
      case 'REFUND': return TrendingDown;
      default: return DollarSign;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'PARKING': return 'text-green-600 bg-green-100';
      case 'PENSION': return 'text-blue-600 bg-blue-100';
      case 'LOST_TICKET': return 'text-yellow-600 bg-yellow-100';
      case 'REFUND': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTransactionText = (type: string) => {
    switch (type) {
      case 'PARKING': return 'Estacionamiento';
      case 'PENSION': return 'Pensión';
      case 'LOST_TICKET': return 'Boleto Perdido';
      case 'REFUND': return 'Reembolso';
      default: return type;
    }
  };

  const isNegativeTransaction = (type: string) => {
    return type === 'REFUND';
  };

  if (isLoading) {
    return (
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 sm:h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border w-full min-w-0 flex-1">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Transacciones Recientes</h3>
          <p className="text-xs sm:text-sm text-gray-500">Últimas 10 transacciones</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 flex-shrink-0"
        >
          <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-200 mb-3 sm:mb-4 block" style={{width: '100%'}}>
        <div className="text-xs sm:text-sm text-blue-700 font-medium mb-2">Ingresos Totales MXN</div>
        <div className="text-xl sm:text-2xl font-bold text-blue-900">
          {formatCurrency(data.totalToday)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-blue-200">
          <div>
            <div className="text-xs text-blue-600">Transacciones</div>
            <div className="text-sm sm:text-lg font-bold text-blue-800">{data.transactionCount}</div>
          </div>
          <div>
            <div className="text-xs text-blue-600">Promedio</div>
            <div className="text-sm sm:text-lg font-bold text-blue-800">{formatCurrency(data.avgTransaction)}</div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto">
        {data.transactions.length === 0 ? (
          <div className="text-center py-4 sm:py-6">
            <DollarSign className="mx-auto w-8 h-8 sm:w-10 sm:h-10 text-gray-400 mb-2" />
            <p className="text-gray-500 text-xs sm:text-sm">No hay transacciones recientes</p>
          </div>
        ) : (
          data.transactions.map((transaction) => {
            const Icon = getTransactionIcon(transaction.type);
            const isNegative = isNegativeTransaction(transaction.type);
            
            return (
              <div key={transaction.id} className="flex items-center justify-between p-2 sm:p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTransactionColor(transaction.type)}`}>
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {getTransactionText(transaction.type)}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 truncate">
                      {transaction.plateNumber && (
                        <span className="font-mono">{transaction.plateNumber} • </span>
                      )}
                      {moment.tz(transaction.timestamp, 'America/Mexico_City').format('HH:mm')}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`font-bold text-sm sm:text-base ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                    {isNegative ? '-' : '+'}
                    {formatCurrency(transaction.amount)}
                  </div>
                  <div className="text-xs text-gray-500">MXN</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Description for latest transaction if available */}
      {data.transactions.length > 0 && data.transactions[0].description && (
        <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-blue-50 rounded-lg">
          <div className="text-xs sm:text-sm text-blue-800">
            <strong>Última transacción:</strong> {data.transactions[0].description}
          </div>
        </div>
      )}
    </div>
  );
}