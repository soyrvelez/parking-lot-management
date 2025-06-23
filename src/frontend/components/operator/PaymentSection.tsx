import { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Printer, Calculator, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Money } from '../../../shared/utils/money';
import moment from 'moment-timezone';

interface PaymentSectionProps {
  ticket: any;
  onPaymentComplete: (paymentData: any) => void;
  onBack: () => void;
}

export default function PaymentSection({ ticket, onPaymentComplete, onBack }: PaymentSectionProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState<Money | null>(null);
  const [change, setChange] = useState<Money | null>(null);

  // Keyboard shortcuts disabled per operator feedback

  useEffect(() => {
    if (ticket) {
      console.log('PaymentSection received ticket:', ticket);
      calculateAmount();
    }
  }, [ticket]);

  useEffect(() => {
    if (paymentAmount && calculatedAmount) {
      try {
        const payment = Money.fromNumber(parseFloat(paymentAmount) || 0);
        
        if (payment.greaterThanOrEqual(calculatedAmount)) {
          setChange(payment.subtract(calculatedAmount));
        } else {
          setChange(null);
        }
      } catch (error) {
        setChange(null);
      }
    }
  }, [paymentAmount, calculatedAmount]);

  const calculateAmount = async () => {
    if (!ticket || (!ticket.id && !ticket.ticketNumber)) {
      setError('Datos del boleto incompletos. Escanee nuevamente.');
      return;
    }

    const ticketId = ticket.id || ticket.ticketNumber;
    
    try {
      const response = await fetch(`/api/parking/calculate/${ticketId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Extract total from pricing data
        const totalStr = result.data.pricing.total.replace('$', '').replace(' MXN', '');
        setCalculatedAmount(Money.fromNumber(parseFloat(totalStr)));
      } else {
        // Handle specific error cases
        if (response.status === 409 && result.error?.code === 'TICKET_ALREADY_PROCESSED') {
          // Ticket is already paid - redirect immediately to scan mode
          if (result.error.context?.status === 'PAID') {
            setCalculatedAmount(Money.fromNumber(0));
            setError('Este boleto ya fue pagado anteriormente.');
            // Automatically return to scan mode after 1 second
            setTimeout(() => {
              onPaymentComplete();
            }, 1000);
          } else {
            setError('Este boleto ya fue procesado.');
            // Return to scan mode for any processed ticket
            setTimeout(() => {
              onPaymentComplete();
            }, 1000);
          }
        } else if (response.status === 404) {
          setError('Boleto no encontrado. Verifique el código.');
        } else {
          // For other errors, try fallback calculation
          const entryTime = moment.tz(ticket.entryTime, 'America/Mexico_City');
          const now = moment.tz('America/Mexico_City');
          const duration = moment.duration(now.diff(entryTime));
          const hours = Math.ceil(duration.asHours());
          
          // Use database-seeded rates as fallback
          const baseRate = Money.fromNumber(25.00); // Match database minimum rate
          const hourlyRate = Money.fromNumber(5.00); // Match database increment rate
          
          let total = baseRate;
          if (hours > 1) {
            const additionalIncrements = Math.ceil((duration.asMinutes() - 60) / 15);
            total = total.add(hourlyRate.multiply(additionalIncrements));
          }
          
          setCalculatedAmount(total);
        }
      }
    } catch (error) {
      console.error('Error calculating amount:', error);
      setError('Error al calcular el monto. Intente nuevamente.');
      setCalculatedAmount(null); // Clear calculating state
    }
  };

  const formatCurrency = (amount: Money | number) => {
    const value = amount instanceof Money ? amount : Money.fromNumber(amount);
    return value.formatPesos();
  };

  const formatDuration = () => {
    const entryTime = moment.tz(ticket.entryTime, 'America/Mexico_City');
    const now = moment.tz('America/Mexico_City');
    const duration = moment.duration(now.diff(entryTime));
    
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handlePayment = async () => {
    if (!paymentAmount || !calculatedAmount) return;

    try {
      const payment = Money.fromNumber(parseFloat(paymentAmount));
      if (payment.lessThan(calculatedAmount)) {
        setError('El monto pagado es insuficiente');
        return;
      }
    } catch (error) {
      setError('Monto de pago inválido');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/parking/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber: ticket.id || ticket.ticketNumber,
          cashReceived: parseFloat(paymentAmount),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('¡Pago procesado exitosamente!');
        
        // Print receipt and track print status
        let receiptPrinted = true;
        try {
          const printResponse = await fetch('/api/hardware/print-receipt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ticketId: ticket.id,
              amountPaid: paymentAmount,
              change: change?.toString() || '0',
            }),
          });
          receiptPrinted = printResponse.ok;
        } catch (printError) {
          console.warn('Error al imprimir recibo:', printError);
          receiptPrinted = false;
        }

        // Prepare payment data for confirmation screen
        const paymentData = {
          ticketNumber: ticket.id || ticket.ticketNumber,
          plateNumber: ticket.plateNumber,
          totalAmount: calculatedAmount?.formatPesos() || result.data?.totalAmount || '',
          cashReceived: Money.fromNumber(parseFloat(paymentAmount)).formatPesos(),
          changeGiven: change?.formatPesos() || '$0.00 MXN',
          paymentTime: new Date().toISOString(),
          receiptPrinted
        };

        // Call completion with payment data
        onPaymentComplete(paymentData);
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

  const addAmount = (amount: string) => {
    try {
      const current = Money.fromNumber(parseFloat(paymentAmount) || 0);
      const add = Money.fromNumber(parseFloat(amount));
      setPaymentAmount(current.add(add).toString());
    } catch (error) {
      // If adding would cause an error, just set the new amount
      setPaymentAmount(amount);
    }
  };

  const clearAmount = () => {
    setPaymentAmount('');
    setChange(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      {/* Header Section - Responsive layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <button
          onClick={onBack}
          className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start touch-manipulation"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-base sm:text-lg">Regresar</span>
        </button>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Procesar Pago</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Cobrar estacionamiento</p>
        </div>
      </div>

      {/* Main Content Container - Responsive width and spacing */}
      <div className="max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
        {/* Ticket Information - Responsive grid layout */}
        <div className="card bg-gray-50 border-l-4 border-blue-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-center">
            <div className="py-2 sm:py-0">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Placa</div>
              <div className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-gray-900">{ticket.plateNumber}</div>
            </div>
            <div className="py-2 sm:py-0">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Entrada</div>
              <div className="text-base sm:text-lg md:text-xl font-medium text-gray-900">
                {moment.tz(ticket.entryTime, 'America/Mexico_City').format('HH:mm')}
              </div>
            </div>
            <div className="py-2 sm:py-0">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Tiempo</div>
              <div className="text-base sm:text-lg md:text-xl font-medium flex items-center justify-center gap-1 sm:gap-2">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span>{formatDuration()}</span>
              </div>
            </div>
            <div className="py-2 sm:py-0 bg-green-50 rounded-lg sm:bg-transparent sm:rounded-none">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">Total</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
                {calculatedAmount !== null ? 
                  (calculatedAmount.equals(Money.fromNumber(0)) ? 'Pagado' : formatCurrency(calculatedAmount)) 
                  : 'Calculando...'}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Amount Input - Responsive sizing and touch-friendly */}
        <div className="card">
          <div className="text-center">
            <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
              Monto Recibido
            </h3>
            
            <div className="space-y-4 sm:space-y-6">
              {/* Large Amount Input */}
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-2 border-gray-300 rounded-xl sm:rounded-2xl text-xl sm:text-2xl md:text-3xl font-bold text-center focus:ring-4 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 touch-manipulation"
                placeholder="0.00"
                step="0.01"
                min="0"
                inputMode="decimal"
              />

              {/* Quick Amount Buttons - Responsive grid and sizing */}
              <div className="space-y-3 sm:space-y-4">
                {/* Primary Action: Exact Amount - Most Prominent and Responsive */}
                {calculatedAmount && calculatedAmount.greaterThan(Money.zero()) && (
                  <button
                    onClick={() => setPaymentAmount(calculatedAmount.toString())}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                             text-white text-base sm:text-xl md:text-2xl font-bold py-4 sm:py-5 md:py-6 px-4 sm:px-8 
                             rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl
                             transform hover:scale-105 transition-all duration-200 
                             border-2 sm:border-4 border-green-400 hover:border-green-300 touch-manipulation
                             min-h-[60px] sm:min-h-[72px] md:min-h-[80px]"
                    title="Monto Exacto"
                  >
                    <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
                      <Calculator className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0" />
                      <span className="truncate">
                        <span className="hidden sm:inline">MONTO EXACTO: </span>
                        <span className="sm:hidden">EXACTO: </span>
                        {formatCurrency(calculatedAmount)}
                      </span>
                    </div>
                  </button>
                )}
                
                {/* Common Bills - Responsive grid layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {['20', '50', '100'].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => addAmount(amount)}
                      className="btn-success text-base sm:text-lg md:text-xl font-bold py-3 sm:py-4 md:py-5 px-2 sm:px-4 
                               rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 touch-manipulation
                               min-h-[56px] sm:min-h-[64px] md:min-h-[72px]"
                      title={`$${amount} pesos`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {['200', '500', '1000'].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => addAmount(amount)}
                      className="btn-success text-base sm:text-lg md:text-xl font-bold py-3 sm:py-4 md:py-5 px-2 sm:px-4 
                               rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 touch-manipulation
                               min-h-[56px] sm:min-h-[64px] md:min-h-[72px]"
                      title={`$${amount} pesos`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                
                {/* Clear Button - Full width and touch-friendly */}
                <button
                  onClick={clearAmount}
                  className="w-full btn-danger text-base sm:text-lg md:text-xl font-bold py-3 sm:py-4 md:py-5 
                           rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 touch-manipulation
                           min-h-[56px] sm:min-h-[64px] md:min-h-[72px]"
                  title="Limpiar"
                >
                  Limpiar
                </button>
              </div>

              {/* Change Display - Responsive padding and sizing */}
              {change && change.greaterThan(Money.zero()) && (
                <div className="bg-blue-50 p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-2xl border-l-4 border-blue-400">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800">Cambio:</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-800">
                      {formatCurrency(change)}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message - Responsive spacing and sizing */}
              {error && (
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 md:gap-4 text-red-600 bg-red-50 p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-2xl border border-red-200 touch-manipulation">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-sm sm:text-base md:text-lg font-medium leading-relaxed">{error}</span>
                </div>
              )}

              {/* Success Message - Responsive spacing and sizing */}
              {success && (
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 md:gap-4 text-green-600 bg-green-50 p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-2xl border border-green-200 touch-manipulation">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-sm sm:text-base md:text-lg font-medium leading-relaxed">{success}</span>
                </div>
              )}

              {/* Confirm Payment Button - Extra large and responsive */}
              <button
                onClick={handlePayment}
                disabled={!paymentAmount || !calculatedAmount || isProcessing || (parseFloat(paymentAmount || '0') < (calculatedAmount?.toNumber() || 0))}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                         disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed
                         text-white text-lg sm:text-xl md:text-2xl font-bold py-4 sm:py-6 md:py-8 px-4 sm:px-6 md:px-8 
                         rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl
                         transform hover:scale-105 disabled:hover:scale-100 transition-all duration-200 
                         border-2 sm:border-4 border-blue-400 hover:border-blue-300 disabled:border-gray-300
                         flex items-center justify-center gap-2 sm:gap-3 md:gap-4 touch-manipulation
                         min-h-[64px] sm:min-h-[80px] md:min-h-[96px]"
                title="Confirmar pago"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 border-2 sm:border-4 border-white border-t-transparent rounded-full flex-shrink-0"></div>
                    <span className="truncate">
                      <span className="hidden sm:inline">PROCESANDO PAGO...</span>
                      <span className="sm:hidden">PROCESANDO...</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0" />
                    <span className="truncate">CONFIRMAR PAGO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}