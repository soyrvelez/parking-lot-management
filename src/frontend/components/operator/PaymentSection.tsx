import { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Printer, Calculator, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Money } from '../../../shared/utils/money';
import moment from 'moment-timezone';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface PaymentSectionProps {
  ticket: any;
  onPaymentComplete: () => void;
  onBack: () => void;
}

export default function PaymentSection({ ticket, onPaymentComplete, onBack }: PaymentSectionProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState<Money | null>(null);
  const [change, setChange] = useState<Money | null>(null);

  // Keyboard shortcuts for payment operations
  useKeyboardShortcuts({
    onQuickAmount: (amount) => {
      addAmount(amount);
    },
    onClearAmount: () => {
      clearAmount();
    },
    onConfirmPayment: () => {
      if (paymentAmount && calculatedAmount && !isProcessing) {
        handlePayment();
      }
    }
  });

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
        
        // Print receipt
        try {
          await fetch('/api/hardware/print-receipt', {
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
        } catch (printError) {
          console.warn('Error al imprimir recibo:', printError);
        }

        // Call completion immediately to prevent user from accessing paid ticket
        onPaymentComplete();
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
    <div>
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="btn-secondary mr-4 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Regresar
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Procesar Pago</h2>
          <p className="text-gray-600">Cobrar estacionamiento</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Ticket Information - Compact Top Section */}
        <div className="card bg-gray-50 border-l-4 border-blue-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">Placa</div>
              <div className="text-xl font-mono font-bold">{ticket.plateNumber}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Entrada</div>
              <div className="text-lg font-medium">
                {moment.tz(ticket.entryTime, 'America/Mexico_City').format('HH:mm')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Tiempo</div>
              <div className="text-lg font-medium flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-bold text-green-600">
                {calculatedAmount !== null ? 
                  (calculatedAmount.equals(Money.fromNumber(0)) ? 'Pagado' : formatCurrency(calculatedAmount)) 
                  : 'Calculando...'}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Amount Input - Large and Prominent */}
        <div className="card text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Monto Recibido
          </h3>
          
          <div className="space-y-6">
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="input-field-large text-center"
              placeholder="0.00"
              step="0.01"
              min="0"
            />

            {/* Quick Amount Buttons - Large and Touch-Friendly */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {['100', '200', '500'].map((amount) => (
                <button
                  key={amount}
                  onClick={() => addAmount(amount)}
                  className="btn-success btn-quick-amount text-2xl"
                  title={`F${amount === '100' ? '5' : amount === '200' ? '6' : '7'}`}
                >
                  ${amount}
                </button>
              ))}
              <button
                onClick={clearAmount}
                className="btn-danger btn-quick-amount text-xl"
                title="F9"
              >
                Limpiar
              </button>
            </div>

            {change && change.greaterThan(Money.zero()) && (
              <div className="bg-blue-50 p-6 rounded-2xl border-l-4 border-blue-400">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-blue-800">Cambio:</span>
                  <span className="text-3xl font-bold text-blue-800">
                    {formatCurrency(change)}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-4 text-red-600 bg-red-50 p-6 rounded-2xl text-lg">
                <AlertCircle className="w-8 h-8" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-4 text-green-600 bg-green-50 p-6 rounded-2xl text-lg">
                <CheckCircle className="w-8 h-8" />
                <span className="font-medium">{success}</span>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!paymentAmount || !calculatedAmount || isProcessing || (parseFloat(paymentAmount || '0') < (calculatedAmount?.toNumber() || 0))}
              className="btn-primary w-full btn-payment flex items-center justify-center gap-4"
              title="F12 o Enter"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Printer className="w-8 h-8" />
                  Confirmar Pago (F12)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}