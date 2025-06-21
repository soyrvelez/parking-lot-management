import { useState, useEffect } from 'react';
import { DollarSign, Car, AlertCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
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
    const interval = setInterval(fetchTransactions, 25000); // Update every 25 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/admin/transactions/recent', {
        credentials: 'include',
      });

      if (response.ok) {
        const transactionsData = await response.json();
        setData(transactionsData);
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
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transacciones Recientes</h3>
          <p className="text-sm text-gray-500">Últimas 10 transacciones</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-700">Total del Día</div>
          <div className="text-xl font-bold text-green-900">
            {formatCurrency(data.totalToday)}
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-700">Transacciones</div>
          <div className="text-xl font-bold text-blue-900">
            {data.transactionCount}
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-700">Promedio</div>
          <div className="text-xl font-bold text-purple-900">
            {formatCurrency(data.avgTransaction)}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {data.transactions.length === 0 ? (
          <div className="text-center py-6">
            <DollarSign className="mx-auto w-10 h-10 text-gray-400 mb-2" />
            <p className="text-gray-500 text-sm">No hay transacciones recientes</p>
          </div>
        ) : (
          data.transactions.map((transaction) => {
            const Icon = getTransactionIcon(transaction.type);
            const isNegative = isNegativeTransaction(transaction.type);
            
            return (
              <div key={transaction.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTransactionColor(transaction.type)}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {getTransactionText(transaction.type)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transaction.plateNumber && (
                        <span className="font-mono">{transaction.plateNumber} • </span>
                      )}
                      {moment.tz(transaction.timestamp, 'America/Mexico_City').format('HH:mm')}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
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
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Última transacción:</strong> {data.transactions[0].description}
          </div>
        </div>
      )}
    </div>
  );
}