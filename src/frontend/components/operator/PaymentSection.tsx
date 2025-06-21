import { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Printer, Calculator, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import Decimal from 'decimal.js';
import moment from 'moment-timezone';

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
  const [calculatedAmount, setCalculatedAmount] = useState<Decimal | null>(null);
  const [change, setChange] = useState<Decimal | null>(null);

  useEffect(() => {
    if (ticket) {
      console.log('PaymentSection received ticket:', ticket);
      calculateAmount();
    }
  }, [ticket]);

  useEffect(() => {
    if (paymentAmount && calculatedAmount) {
      const payment = new Decimal(paymentAmount || 0);
      const total = calculatedAmount;
      
      if (payment.gte(total)) {
        setChange(payment.minus(total));
      } else {
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
        setCalculatedAmount(new Decimal(totalStr));
      } else {
        // Fallback to basic calculation if API fails
        const entryTime = moment.tz(ticket.entryTime, 'America/Mexico_City');
        const now = moment.tz('America/Mexico_City');
        const duration = moment.duration(now.diff(entryTime));
        const hours = Math.ceil(duration.asHours());
        
        // Use database-seeded rates as fallback
        const baseRate = new Decimal('25.00'); // Match database minimum rate
        const hourlyRate = new Decimal('5.00'); // Match database increment rate
        
        let total = baseRate;
        if (hours > 1) {
          const additionalIncrements = Math.ceil((duration.asMinutes() - 60) / 15);
          total = total.plus(hourlyRate.times(additionalIncrements));
        }
        
        setCalculatedAmount(total);
      }
    } catch (error) {
      console.error('Error calculating amount:', error);
      setError('Error al calcular el monto. Intente nuevamente.');
    }
  };

  const formatCurrency = (amount: Decimal | number) => {
    const value = amount instanceof Decimal ? amount : new Decimal(amount);
    return `$${value.toFixed(2)} MXN`;
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

    const payment = new Decimal(paymentAmount);
    if (payment.lt(calculatedAmount)) {
      setError('El monto pagado es insuficiente');
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
          cashReceived: payment.toNumber(),
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
              amountPaid: payment.toString(),
              change: change?.toString() || '0',
            }),
          });
        } catch (printError) {
          console.warn('Error al imprimir recibo:', printError);
        }

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

  const addAmount = (amount: string) => {
    const current = new Decimal(paymentAmount || 0);
    const add = new Decimal(amount);
    setPaymentAmount(current.plus(add).toString());
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ticket Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Información del Boleto
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Placa:</span>
              <span className="font-mono font-bold">{ticket.plateNumber}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Entrada:</span>
              <span>
                {moment.tz(ticket.entryTime, 'America/Mexico_City').format('DD/MM/YY HH:mm')}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Tiempo:</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatDuration()}
              </span>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total a Pagar:</span>
                <span className="text-2xl font-bold text-green-600">
                  {calculatedAmount ? formatCurrency(calculatedAmount) : 'Calculando...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Interface */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Monto Recibido
          </h3>
          
          <div className="space-y-4">
            <div className="text-center">
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="input-field text-center text-2xl font-bold"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {['20', '50', '100', '200', '500'].map((amount) => (
                <button
                  key={amount}
                  onClick={() => addAmount(amount)}
                  className="btn-secondary py-2 text-sm"
                >
                  ${amount}
                </button>
              ))}
              <button
                onClick={clearAmount}
                className="btn-danger py-2 text-sm"
              >
                Limpiar
              </button>
            </div>

            {change && change.gt(0) && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-blue-800">Cambio:</span>
                  <span className="text-xl font-bold text-blue-800">
                    {formatCurrency(change)}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}

            <button
              onClick={handlePayment}
              disabled={!paymentAmount || !calculatedAmount || isProcessing || new Decimal(paymentAmount || 0).lt(calculatedAmount || 0)}
              className="btn-primary w-full btn-operator flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  Confirmar Pago
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}