import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Calculator, History, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthenticatedFetch } from '@/hooks/useKeyboardShortcuts';
import Decimal from 'decimal.js';

interface CashRegisterStatus {
  registerId?: string;
  status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  openingBalance: string;
  currentBalance: string;
  shiftStart?: string;
  transactions: number;
}

interface CashTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PARKING' | 'PENSION' | 'LOST_TICKET';
  amount: string;
  description: string;
  timestamp: string;
  operatorName?: string;
}

export default function AdminCash() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const authenticatedFetch = useAuthenticatedFetch();

  // Cash register state
  const [registerStatus, setRegisterStatus] = useState<CashRegisterStatus>({
    status: 'UNKNOWN',
    openingBalance: '0.00',
    currentBalance: '0.00',
    transactions: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<CashTransaction[]>([]);
  
  // Form state
  const [openingBalance, setOpeningBalance] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSource, setDepositSource] = useState('');
  
  // UI state
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCashStatus();
      fetchRecentTransactions();
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

  const fetchCashStatus = async () => {
    try {
      const response = await authenticatedFetch('/api/cash/status?operatorId=admin-001');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Ensure we have valid default values and remove currency symbols
          const statusData = {
            status: result.data?.status || 'CLOSED',
            openingBalance: (result.data?.openingBalance || '0.00').replace(/[$\s]|pesos/g, ''),
            currentBalance: (result.data?.currentBalance || '0.00').replace(/[$\s]|pesos/g, ''),
            transactions: result.data?.recentCashFlows?.length || 0,
            registerId: result.data?.registerId,
            shiftStart: result.data?.shiftStart
          };
          setRegisterStatus(statusData);
        }
      }
    } catch (error) {
      console.error('Error fetching cash status:', error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const response = await authenticatedFetch('/api/cash/history?limit=10');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.registers) {
          // Combine cash flows from all registers and sort by timestamp
          const allTransactions: CashTransaction[] = [];
          result.data.registers.forEach((register: any) => {
            if (register.cashFlows && Array.isArray(register.cashFlows)) {
              register.cashFlows.forEach((cf: any) => {
                allTransactions.push({
                  id: cf.id,
                  type: cf.type,
                  amount: cf.amount.replace(/[$\s]|pesos/g, ''), // Remove currency symbols and 'pesos'
                  description: cf.reason,
                  timestamp: cf.timestamp,
                  operatorName: register.operatorId
                });
              });
            }
          });
          // Sort by timestamp descending and take first 10
          allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setRecentTransactions(allTransactions.slice(0, 10));
        } else {
          setRecentTransactions([]);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setRecentTransactions([]);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleOpenRegister = async () => {
    if (!openingBalance || isNaN(parseFloat(openingBalance))) {
      showMessage('error', 'Por favor ingrese un monto válido');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await authenticatedFetch('/api/cash/open', {
        method: 'POST',
        body: JSON.stringify({
          openingBalance,
          operatorId: 'admin-001'
        })
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Caja abierta exitosamente');
        setOpeningBalance('');
        fetchCashStatus();
      } else {
        showMessage('error', result.error?.message || 'Error al abrir la caja');
      }
    } catch (error) {
      showMessage('error', 'Error al procesar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!withdrawalAmount || !withdrawalReason) {
      showMessage('error', 'Complete todos los campos');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await authenticatedFetch('/api/cash/adjustment', {
        method: 'POST',
        body: JSON.stringify({
          amount: withdrawalAmount,
          type: 'WITHDRAWAL',
          description: withdrawalReason,
          operatorId: 'admin-001'
        })
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Retiro registrado exitosamente');
        setWithdrawalAmount('');
        setWithdrawalReason('');
        fetchCashStatus();
        fetchRecentTransactions();
      } else {
        showMessage('error', result.error?.message || 'Error al registrar retiro');
      }
    } catch (error) {
      showMessage('error', 'Error al procesar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || !depositSource) {
      showMessage('error', 'Complete todos los campos');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await authenticatedFetch('/api/cash/adjustment', {
        method: 'POST',
        body: JSON.stringify({
          amount: depositAmount,
          type: 'DEPOSIT',
          description: depositSource,
          operatorId: 'admin-001'
        })
      });

      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Depósito registrado exitosamente');
        setDepositAmount('');
        setDepositSource('');
        fetchCashStatus();
        fetchRecentTransactions();
      } else {
        showMessage('error', result.error?.message || 'Error al registrar depósito');
      }
    } catch (error) {
      showMessage('error', 'Error al procesar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await authenticatedFetch(`/api/cash/history?operatorId=admin-001&startDate=${today}&endDate=${today}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.registers) {
          // Generate CSV report
          const headers = ['Fecha', 'Tipo', 'Monto', 'Descripción', 'Balance'];
          const rows = [];
          
          result.data.registers.forEach((register: any) => {
            rows.push([
              new Date(register.shiftStart).toLocaleDateString('es-MX'),
              'Apertura',
              register.openingBalance,
              'Balance de apertura',
              register.openingBalance
            ]);
            
            register.cashFlows.forEach((cf: any) => {
              rows.push([
                new Date(cf.timestamp).toLocaleDateString('es-MX'),
                cf.type === 'WITHDRAWAL' ? 'Retiro' : 'Depósito',
                cf.amount,
                cf.reason,
                '-'
              ]);
            });
            
            if (register.status === 'CLOSED') {
              rows.push([
                register.shiftEnd ? new Date(register.shiftEnd).toLocaleDateString('es-MX') : '',
                'Cierre',
                register.currentBalance,
                'Balance final',
                register.currentBalance
              ]);
            }
          });
          
          // Create CSV content
          const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
          
          // Download file
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `reporte-caja-${today}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showMessage('success', 'Reporte generado y descargado exitosamente');
        } else {
          showMessage('error', 'No se encontraron datos para el reporte');
        }
      } else {
        showMessage('error', 'Error al generar reporte');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showMessage('error', 'Error al generar reporte');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewCompleteHistory = () => {
    router.push('/admin/cash/history');
  };



  const formatCurrency = (amount: string | number): string => {
    const value = new Decimal(amount || 0);
    return `$${value.toFixed(2)}`;
  };

  const calculateDayTotals = () => {
    let income = new Decimal(0);
    let withdrawals = new Decimal(0);

    if (recentTransactions && recentTransactions.length > 0) {
      recentTransactions.forEach(transaction => {
        const amount = new Decimal(transaction.amount || '0');
        if (transaction.type === 'WITHDRAWAL') {
          withdrawals = withdrawals.plus(amount);
        } else {
          income = income.plus(amount);
        }
      });
    }

    return { income: income.toFixed(2), withdrawals: withdrawals.toFixed(2) };
  };

  const { income, withdrawals } = calculateDayTotals();
  const expectedBalance = new Decimal(registerStatus.openingBalance || '0')
    .plus(income)
    .minus(withdrawals);
  const difference = new Decimal(registerStatus.currentBalance || '0').minus(expectedBalance);

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
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            Caja Registradora
          </h1>
          <p className="text-gray-600 mt-2">
            Control de efectivo, balance de caja y gestión de cambios
          </p>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Cash Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Balance Actual</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(registerStatus.currentBalance || '0')}</p>
                <p className="text-xs text-gray-500">
                  {registerStatus.status === 'OPEN' ? 'Caja abierta' : 'Caja cerrada'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Ingresos del Día</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(income)}</p>
                <p className="text-xs text-gray-500">Total cobrado</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Retiros del Día</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(withdrawals)}</p>
                <p className="text-xs text-gray-500">Total retirado</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                difference.isZero() ? 'bg-green-50' : 
                difference.isPositive() ? 'bg-blue-50' : 'bg-red-50'
              }`}>
                <TrendingUp className={`w-6 h-6 ${
                  difference.isZero() ? 'text-green-600' : 
                  difference.isPositive() ? 'text-blue-600' : 'text-red-600'
                }`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Diferencia</p>
                <p className={`text-2xl font-bold ${
                  difference.isZero() ? 'text-gray-900' : 
                  difference.isPositive() ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {formatCurrency(difference.toFixed(2))}
                </p>
                <p className="text-xs text-gray-500">vs Balance esperado</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Operations */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Operaciones de Caja
            </h3>
            
            <div className="space-y-4">
              {/* Opening Balance */}
              {registerStatus.status === 'CLOSED' && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Balance de Apertura</h4>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 border rounded-lg"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      disabled={isProcessing}
                    />
                    <button 
                      className="btn-primary"
                      onClick={handleOpenRegister}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Procesando...' : 'Abrir Caja'}
                    </button>
                  </div>
                </div>
              )}

              {registerStatus.status === 'OPEN' && (
                <>
                  {/* Cash Withdrawal */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">Retiro de Efectivo</h4>
                    <div className="space-y-3">
                      <input
                        type="number"
                        placeholder="Cantidad a retirar"
                        className="w-full px-3 py-2 border rounded-lg"
                        step="0.01"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        disabled={isProcessing}
                      />
                      <input
                        type="text"
                        placeholder="Motivo del retiro"
                        className="w-full px-3 py-2 border rounded-lg"
                        value={withdrawalReason}
                        onChange={(e) => setWithdrawalReason(e.target.value)}
                        disabled={isProcessing}
                      />
                      <button 
                        className="btn-secondary w-full"
                        onClick={handleWithdrawal}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Procesando...' : 'Registrar Retiro'}
                      </button>
                    </div>
                  </div>

                  {/* Cash Deposit */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">Depósito de Efectivo</h4>
                    <div className="space-y-3">
                      <input
                        type="number"
                        placeholder="Cantidad a depositar"
                        className="w-full px-3 py-2 border rounded-lg"
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        disabled={isProcessing}
                      />
                      <input
                        type="text"
                        placeholder="Fuente del depósito"
                        className="w-full px-3 py-2 border rounded-lg"
                        value={depositSource}
                        onChange={(e) => setDepositSource(e.target.value)}
                        disabled={isProcessing}
                      />
                      <button 
                        className="btn-secondary w-full"
                        onClick={handleDeposit}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Procesando...' : 'Registrar Depósito'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {registerStatus.status === 'UNKNOWN' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Cargando estado de la caja...</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              Actividad Reciente
            </h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="border-b pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          transaction.type === 'WITHDRAWAL' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.type === 'WITHDRAWAL' ? '-' : '+'}{formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-xs text-gray-600">{transaction.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.timestamp).toLocaleString('es-MX')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hay movimientos registrados
                </p>
              )}
            </div>
          </div>
        </div>


        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            className="btn-primary"
            onClick={handleGenerateReport}
            disabled={isProcessing}
          >
            {isProcessing ? 'Generando...' : 'Generar Reporte de Caja'}
          </button>
          <button 
            className="btn-primary"
            onClick={handleViewCompleteHistory}
            disabled={isProcessing}
          >
            Ver Historial Completo
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}