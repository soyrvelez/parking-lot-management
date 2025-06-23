import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { DollarSign, ArrowLeft, Download, Filter, Calendar, Search } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Decimal from 'decimal.js';

interface CashRegister {
  id: string;
  operatorId: string;
  status: 'OPEN' | 'CLOSED';
  openingBalance: string;
  currentBalance: string;
  expectedBalance?: string;
  discrepancy?: string;
  shiftStart: string;
  shiftEnd?: string;
  cashFlowCount: number;
  cashFlows: CashFlow[];
}

interface CashFlow {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: string;
  reason: string;
  timestamp: string;
}

export default function CashHistory() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const { authenticatedFetch } = useAdminAuth();

  // Data state
  const [cashHistory, setCashHistory] = useState<CashRegister[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [limit, setLimit] = useState(50);

  // UI state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Set default date range to last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      
      fetchCashHistory();
    }
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }

      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminToken');
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCashHistory = async () => {
    setIsFetching(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (operatorId) queryParams.append('operatorId', operatorId);
      queryParams.append('limit', limit.toString());

      const response = await authenticatedFetch(`/api/cash/history?${queryParams.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.registers) {
          setCashHistory(result.data.registers);
          setTotalRecords(result.data.total || result.data.registers.length);
        } else {
          setCashHistory([]);
          setTotalRecords(0);
        }
      } else {
        setCashHistory([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('Error fetching cash history:', error);
      setCashHistory([]);
      setTotalRecords(0);
    } finally {
      setIsFetching(false);
    }
  };

  const handleApplyFilters = () => {
    fetchCashHistory();
  };

  const handleExportCSV = () => {
    // Generate CSV content
    const headers = ['Fecha Inicio', 'Fecha Fin', 'Operador', 'Estado', 'Balance Inicial', 'Balance Final', 'Diferencia', 'Movimientos'];
    const rows = cashHistory.map(register => [
      new Date(register.shiftStart).toLocaleDateString('es-MX'),
      register.shiftEnd ? new Date(register.shiftEnd).toLocaleDateString('es-MX') : 'N/A',
      register.operatorId,
      register.status === 'OPEN' ? 'Abierto' : 'Cerrado',
      register.openingBalance,
      register.currentBalance,
      register.discrepancy || '0.00',
      register.cashFlowCount.toString()
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historial-caja-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleRowExpansion = (registerId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(registerId)) {
      newExpanded.delete(registerId);
    } else {
      newExpanded.add(registerId);
    }
    setExpandedRows(newExpanded);
  };

  const formatCurrency = (amount: string): string => {
    // Clean the amount string by removing currency symbols and 'pesos' text
    const cleanAmount = (amount || '0').replace(/[$\s]|pesos/g, '');
    const value = new Decimal(cleanAmount || 0);
    return `$${value.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-600" />
                Historial Completo de Caja
              </h1>
              <p className="text-gray-600 mt-2">
                Registro histórico de turnos y movimientos de efectivo
              </p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center gap-2"
            disabled={cashHistory.length === 0}
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Búsqueda
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operador (Opcional)
              </label>
              <input
                type="text"
                placeholder="ID del operador"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Límite de Registros
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value={25}>25 registros</option>
                <option value={50}>50 registros</option>
                <option value={100}>100 registros</option>
                <option value={200}>200 registros</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="btn-primary"
              disabled={isFetching}
            >
              {isFetching ? 'Buscando...' : 'Aplicar Filtros'}
            </button>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setOperatorId('');
                setLimit(50);
              }}
              className="btn-secondary"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-600">
            Mostrando {cashHistory.length} de {totalRecords} registros encontrados
          </p>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {cashHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Turno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance Inicial
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance Final
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Movimientos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cashHistory.map((register) => (
                    <>
                      <tr key={register.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(register.shiftStart).toLocaleDateString('es-MX')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(register.shiftStart).toLocaleTimeString('es-MX')}
                            {register.shiftEnd && (
                              <> - {new Date(register.shiftEnd).toLocaleTimeString('es-MX')}</>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {register.operatorId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            register.status === 'OPEN' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {register.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(register.openingBalance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(register.currentBalance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {register.discrepancy ? (
                            <span className={`font-medium ${
                              parseFloat(register.discrepancy) === 0 
                                ? 'text-green-600' 
                                : parseFloat(register.discrepancy) > 0 
                                ? 'text-blue-600' 
                                : 'text-red-600'
                            }`}>
                              {formatCurrency(register.discrepancy)}
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {register.cashFlowCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => toggleRowExpansion(register.id)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            {expandedRows.has(register.id) ? 'Ocultar' : 'Ver Detalles'}
                          </button>
                        </td>
                      </tr>
                      {expandedRows.has(register.id) && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-900">Movimientos de Efectivo</h4>
                              {register.cashFlows.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full">
                                    <thead>
                                      <tr>
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase">Fecha/Hora</th>
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                                      </tr>
                                    </thead>
                                    <tbody className="space-y-1">
                                      {register.cashFlows.map((flow) => (
                                        <tr key={flow.id}>
                                          <td className="text-xs text-gray-600 py-1">
                                            {new Date(flow.timestamp).toLocaleString('es-MX')}
                                          </td>
                                          <td className="text-xs py-1">
                                            <span className={`px-2 py-1 rounded-full text-xs ${
                                              flow.type === 'DEPOSIT' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                              {flow.type === 'DEPOSIT' ? 'Depósito' : 'Retiro'}
                                            </span>
                                          </td>
                                          <td className={`text-xs py-1 font-medium ${
                                            flow.type === 'DEPOSIT' ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            {flow.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(flow.amount)}
                                          </td>
                                          <td className="text-xs text-gray-600 py-1">
                                            {flow.reason}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No hay movimientos registrados</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron registros</h3>
              <p className="text-gray-500">
                {isFetching 
                  ? 'Buscando registros...' 
                  : 'No hay registros de caja que coincidan con los filtros seleccionados.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}