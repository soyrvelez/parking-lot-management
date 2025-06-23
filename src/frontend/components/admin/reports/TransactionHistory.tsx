import { useState, useEffect } from 'react';
import { Search, Filter, Calendar, DollarSign, Car, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import moment from 'moment-timezone';
import Decimal from 'decimal.js';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

interface Transaction {
  id: string;
  type: 'PARKING' | 'PENSION' | 'LOST_TICKET' | 'REFUND';
  amount: string;
  plateNumber?: string;
  timestamp: string;
  description?: string;
  operatorId?: string;
  ticketId?: string;
}

interface TransactionHistoryData {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  summary: {
    totalAmount: string;
    totalCount: number;
  };
}

interface TransactionHistoryProps {
  filters: {
    startDate: string;
    endDate: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    transactionType: string;
  };
}

export default function TransactionHistory({ filters }: TransactionHistoryProps) {
  const { authenticatedFetch } = useAdminAuth();
  const [data, setData] = useState<TransactionHistoryData>({
    transactions: [],
    total: 0,
    page: 1,
    totalPages: 1,
    summary: { totalAmount: '0.00', totalCount: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [localFilters, setLocalFilters] = useState({
    type: 'all',
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchTransactionHistory();
  }, [filters, localFilters, currentPage]);

  const fetchTransactionHistory = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        transactionType: filters.transactionType,
        type: localFilters.type,
        sortBy: localFilters.sortBy,
        sortOrder: localFilters.sortOrder,
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
      });

      const response = await authenticatedFetch(`/api/admin/reports/transactions?${queryParams}`);

      if (response.ok) {
        const historyData = await response.json();
        setData(historyData.data);
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTransactionHistory();
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchTransactionHistory();
  };

  const formatCurrency = (amount: string) => {
    // API already returns formatted currency strings, so just return as-is
    return amount || '$0.00';
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PARKING': return Car;
      case 'PENSION': return Calendar;
      case 'LOST_TICKET': return AlertCircle;
      case 'REFUND': return DollarSign;
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
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
          <h3 className="text-lg font-semibold text-gray-900">Historial de Transacciones</h3>
          <p className="text-sm text-gray-500">
            {data.summary.totalCount} transacciones - {formatCurrency(data.summary.totalAmount)} MXN
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por placa, ID o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={handleSearch}
            className="btn-primary px-6"
          >
            Buscar
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={localFilters.type}
            onChange={(e) => setLocalFilters(prev => ({ ...prev, type: e.target.value }))}
            className="input-field"
          >
            <option value="all">Todos los Tipos</option>
            <option value="PARKING">Estacionamiento</option>
            <option value="PENSION">Pensión</option>
            <option value="LOST_TICKET">Boleto Perdido</option>
            <option value="REFUND">Reembolso</option>
          </select>

          <select
            value={localFilters.sortBy}
            onChange={(e) => setLocalFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            className="input-field"
          >
            <option value="timestamp">Fecha</option>
            <option value="amount">Monto</option>
            <option value="plateNumber">Placa</option>
            <option value="type">Tipo</option>
          </select>

          <select
            value={localFilters.sortOrder}
            onChange={(e) => setLocalFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
            className="input-field"
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {data.transactions.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="mx-auto w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-500">
              {searchTerm ? 'No se encontraron transacciones' : 'No hay transacciones en este período'}
            </p>
          </div>
        ) : (
          data.transactions.map((transaction) => {
            const Icon = getTransactionIcon(transaction.type);
            const isNegative = isNegativeTransaction(transaction.type);
            
            return (
              <div key={transaction.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTransactionColor(transaction.type)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {getTransactionText(transaction.type)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.plateNumber && (
                          <span className="font-mono">{transaction.plateNumber} • </span>
                        )}
                        ID: {transaction.id.slice(-8)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600">
                        {moment.tz(transaction.timestamp, 'America/Mexico_City').format('DD/MM/YY')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {moment.tz(transaction.timestamp, 'America/Mexico_City').format('HH:mm')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-lg font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                        {isNegative ? '-' : '+'}
                        {formatCurrency(transaction.amount)}
                      </div>
                      <div className="text-xs text-gray-500">MXN</div>
                    </div>
                  </div>
                </div>

                {transaction.description && (
                  <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {transaction.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Página {data.page} de {data.totalPages} ({data.total} transacciones total)
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn-secondary flex items-center gap-1 px-3 py-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            
            <span className="px-3 py-2 text-sm text-gray-600">
              {currentPage} / {data.totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
              disabled={currentPage === data.totalPages}
              className="btn-secondary flex items-center gap-1 px-3 py-2"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}