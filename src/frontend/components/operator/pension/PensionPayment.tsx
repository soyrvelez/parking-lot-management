import { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Printer, Calculator, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { Money } from '../../../../shared/utils/money';

interface PensionPaymentProps {
  customer: any;
  onPaymentComplete: () => void;
  onBack: () => void;
}

export default function PensionPayment({ customer, onPaymentComplete, onBack }: PensionPaymentProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [change, setChange] = useState<Money | null>(null);
  const [isRenewal, setIsRenewal] = useState(false);
  const [renewalMonths, setRenewalMonths] = useState(1);

  // Use raw numbers for calculation to avoid Money class limits
  const monthlyRateValue = customer.monthlyRate;
  const totalAmountValue = isRenewal ? monthlyRateValue * renewalMonths : monthlyRateValue;

  useEffect(() => {
    if (paymentAmount) {
      try {
        const paymentValue = parseFloat(paymentAmount) || 0;
        
        if (paymentValue >= totalAmountValue) {
          const changeValue = paymentValue - totalAmountValue;
          // Only create Money instance for change if it's within limits
          if (changeValue <= 9999.99) {
            setChange(Money.fromNumber(changeValue));
          } else {
            // For large change amounts, set to null and handle manually
            setChange(null);
          }
        } else {
          setChange(null);
        }
      } catch (error) {
        setChange(null);
      }
    }
  }, [paymentAmount, totalAmountValue]);

  const formatCurrency = (amount: Money | number): string => {
    try {
      if (amount instanceof Money) {
        return amount.formatPesos();
      }
      // For large amounts, use safe formatting
      if (amount <= 9999.99) {
        return Money.fromNumber(amount).formatPesos();
      }
      return `$${amount.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} pesos`;
    } catch (error) {
      // Fallback formatting if Money class fails
      const numAmount = typeof amount === 'number' ? amount : 0;
      return `$${numAmount.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} pesos`;
    }
  };

  const addAmount = (amount: string) => {
    try {
      const currentValue = parseFloat(paymentAmount) || 0;
      const addValue = parseFloat(amount);
      const newTotal = currentValue + addValue;
      setPaymentAmount(newTotal.toString());
    } catch (error) {
      setPaymentAmount(amount);
    }
  };

  const clearAmount = () => {
    setPaymentAmount('');
    setChange(null);
  };

  const handlePayment = async () => {
    if (!paymentAmount) return;

    const paymentValue = parseFloat(paymentAmount);
    if (isNaN(paymentValue) || paymentValue < 0) {
      setError('Monto de pago inválido');
      return;
    }
    
    if (paymentValue < totalAmountValue) {
      setError('El monto pagado es insuficiente');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isRenewal ? `/api/pension/renew/${customer.id}` : '/api/pension/payment';
      const payload = isRenewal ? {
        durationMonths: parseInt(renewalMonths.toString()),
        cashReceived: parseFloat(paymentValue.toString()),
        operatorId: 'OPERATOR_001' // Required for audit logging
      } : {
        customerId: customer.id,
        cashReceived: parseFloat(paymentValue.toString()),
        operatorId: 'OPERATOR_001' // Required for audit logging
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(isRenewal ? '¡Pensión renovada exitosamente!' : '¡Pago procesado exitosamente!');
        
        setTimeout(() => {
          onPaymentComplete();
        }, 2000);
      } else {
        const errorMessage = result.error?.message || result.message || 'Error al procesar el pago';
        setError(errorMessage);
      }
    } catch (err) {
      setError('Error de conexión. Verifique la red.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusMessage = () => {
    const daysRemaining = customer.daysRemaining;
    
    if (customer.status === 'EXPIRED') {
      return 'Pensión expirada - Se requiere renovación';
    } else if (customer.status === 'EXPIRING_SOON') {
      return `Pensión por vencer en ${daysRemaining} días`;
    } else {
      return `Pensión válida - ${daysRemaining} días restantes`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6">
      {/* Header - Mobile First */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 hover:bg-gray-200 
                     rounded-full transition-colors duration-200 touch-manipulation"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              {isRenewal ? 'Renovar Pensión' : 'Pago de Pensión'}
            </h2>
            <p className="text-sm sm:text-base text-gray-600">Procesar pago mensual</p>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile First Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Customer Information - Full width on mobile */}
        <div className="order-1 lg:order-1 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Información del Cliente
          </h3>
          
          <div className="space-y-4 sm:space-y-5">
            {/* Customer Details - Stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <span className="block text-xs sm:text-sm text-gray-600 mb-1">Cliente:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">{customer.name}</span>
              </div>
              
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <span className="block text-xs sm:text-sm text-gray-600 mb-1">Placa:</span>
                <span className="text-sm sm:text-base font-mono font-bold text-gray-900">{customer.plateNumber}</span>
              </div>
            </div>
            
            {customer.vehicleMake && (
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <span className="block text-xs sm:text-sm text-gray-600 mb-1">Vehículo:</span>
                <span className="text-sm sm:text-base text-gray-900">{customer.vehicleMake} {customer.vehicleModel}</span>
              </div>
            )}
            
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <span className="block text-xs sm:text-sm text-gray-600 mb-2">Estado:</span>
              <span className={`inline-block px-3 py-2 rounded-full text-xs sm:text-sm font-medium ${
                customer.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                customer.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-800' :
                customer.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getStatusMessage()}
              </span>
            </div>
            
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <span className="block text-xs sm:text-sm text-gray-600 mb-1">Válido hasta:</span>
              <span className="text-sm sm:text-base text-gray-900">{new Date(customer.endDate).toLocaleDateString('es-MX')}</span>
            </div>

            {/* Payment Type Selection - Touch Friendly */}
            <div className="border-t pt-4 sm:pt-6">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Tipo de Pago</h4>
              <div className="space-y-3 sm:space-y-4">
                <label className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-200 touch-manipulation">
                  <input
                    type="radio"
                    checked={!isRenewal}
                    onChange={() => setIsRenewal(false)}
                    className="mt-1 w-4 h-4 sm:w-5 sm:h-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="block text-sm sm:text-base font-medium text-gray-900">
                      Pago mensual regular
                    </span>
                    <span className="block text-xs sm:text-sm text-gray-600 mt-1">
                      ${customer.monthlyRate.toFixed(2)} MXN
                    </span>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors duration-200 touch-manipulation">
                  <input
                    type="radio"
                    checked={isRenewal}
                    onChange={() => setIsRenewal(true)}
                    className="mt-1 w-4 h-4 sm:w-5 sm:h-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="block text-sm sm:text-base font-medium text-gray-900">
                      Renovación por múltiples meses
                    </span>
                    <span className="block text-xs sm:text-sm text-gray-600 mt-1">
                      Seleccionar duración
                    </span>
                  </div>
                </label>
                
                {isRenewal && (
                  <div className="ml-4 sm:ml-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                      Meses a renovar:
                    </label>
                    <select
                      value={renewalMonths}
                      onChange={(e) => setRenewalMonths(parseInt(e.target.value))}
                      className="w-full p-3 sm:p-4 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                    >
                      {[1, 2, 3, 4, 5, 6, 12].map(months => (
                        <option key={months} value={months}>
                          {months} {months === 1 ? 'mes' : 'meses'} - ${(customer.monthlyRate * months).toFixed(2)} MXN
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            {/* Total Amount - Prominent Display */}
            <div className="border-t pt-4 sm:pt-6">
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 sm:p-6 rounded-xl border border-green-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="text-base sm:text-lg font-semibold text-gray-900">Total a Pagar:</span>
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-600">
                    {formatCurrency(totalAmountValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Interface - Full width on mobile, second on mobile */}
        <div className="order-2 lg:order-2 bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Monto Recibido
          </h3>
          
          <div className="space-y-4 sm:space-y-6">
            {/* Amount Input - Large and Touch Friendly */}
            <div className="text-center">
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full p-4 sm:p-6 text-center text-2xl sm:text-3xl lg:text-4xl font-bold 
                         border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500 
                         bg-gray-50 hover:bg-white transition-colors duration-200 touch-manipulation"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            {/* Exact Amount Button - Most Prominent */}
            <button
              onClick={() => setPaymentAmount(totalAmountValue.toString())}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                       text-white font-bold py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8 rounded-xl sm:rounded-2xl 
                       shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 
                       transition-all duration-200 border-2 border-green-400 hover:border-green-300
                       touch-manipulation"
              title="Monto Exacto"
            >
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <Calculator className="w-6 h-6 sm:w-8 sm:h-8" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-sm sm:text-base lg:text-lg">MONTO EXACTO:</span>
                  <span className="text-lg sm:text-xl lg:text-2xl">{formatCurrency(totalAmountValue)}</span>
                </div>
              </div>
            </button>

            {/* Quick Amount Buttons - Touch Optimized Grid */}
            <div className="space-y-3 sm:space-y-4">
              <h4 className="text-sm sm:text-base font-medium text-gray-700">Montos Rápidos:</h4>
              
              {/* Common denominations - 2 columns on mobile, 3 on larger screens */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                {['50', '100', '200', '500', '1000', '2000'].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => addAmount(amount)}
                    className="bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 font-semibold 
                             py-3 sm:py-4 lg:py-5 px-3 sm:px-4 rounded-lg sm:rounded-xl 
                             transition-all duration-200 transform hover:scale-105 active:scale-95
                             border border-blue-200 hover:border-blue-300 touch-manipulation
                             text-base sm:text-lg lg:text-xl"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              
              {/* Clear Button - Full Width */}
              <button
                onClick={clearAmount}
                className="w-full bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-800 font-semibold 
                         py-3 sm:py-4 px-4 rounded-lg sm:rounded-xl transition-all duration-200 
                         transform hover:scale-105 active:scale-95 border border-red-200 hover:border-red-300
                         touch-manipulation text-base sm:text-lg"
                title="Limpiar"
              >
                Limpiar Monto
              </button>
            </div>

            {/* Change Display - Prominent when applicable */}
            {((change && change.greaterThan(Money.zero())) || (paymentAmount && parseFloat(paymentAmount) > totalAmountValue)) && (
              <div className="bg-blue-50 border border-blue-200 p-4 sm:p-6 rounded-lg sm:rounded-xl">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="text-blue-800 font-medium text-base sm:text-lg">Cambio a entregar:</span>
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-800">
                    {change ? formatCurrency(change) : formatCurrency(parseFloat(paymentAmount) - totalAmountValue)}
                  </span>
                </div>
              </div>
            )}

            {/* Error Messages - Touch Friendly */}
            {error && (
              <div className="flex items-start gap-3 text-red-600 bg-red-50 border border-red-200 p-4 sm:p-5 rounded-lg sm:rounded-xl">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base">{error}</span>
              </div>
            )}

            {/* Success Messages - Touch Friendly */}
            {success && (
              <div className="flex items-start gap-3 text-green-600 bg-green-50 border border-green-200 p-4 sm:p-5 rounded-lg sm:rounded-xl">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base">{success}</span>
              </div>
            )}

            {/* Payment Confirmation Button - Large and Prominent */}
            <button
              onClick={handlePayment}
              disabled={!paymentAmount || isProcessing || (parseFloat(paymentAmount || '0') < totalAmountValue)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                       disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                       text-white font-bold py-4 sm:py-6 lg:py-8 px-4 sm:px-6 rounded-xl sm:rounded-2xl 
                       shadow-lg hover:shadow-xl disabled:shadow-none
                       transform hover:scale-105 active:scale-95 disabled:transform-none
                       transition-all duration-200 touch-manipulation
                       text-base sm:text-lg lg:text-xl
                       flex items-center justify-center gap-2 sm:gap-3"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>{isRenewal ? 'Confirmar Renovación' : 'Confirmar Pago'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}