import { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Printer, Calculator, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import Decimal from 'decimal.js';

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
  const [change, setChange] = useState<Decimal | null>(null);
  const [isRenewal, setIsRenewal] = useState(false);
  const [renewalMonths, setRenewalMonths] = useState(1);

  const monthlyRate = new Decimal(customer.monthlyRate);
  const totalAmount = isRenewal ? monthlyRate.times(renewalMonths) : monthlyRate;

  useEffect(() => {
    if (paymentAmount) {
      const payment = new Decimal(paymentAmount || 0);
      
      if (payment.gte(totalAmount)) {
        setChange(payment.minus(totalAmount));
      } else {
        setChange(null);
      }
    }
  }, [paymentAmount, totalAmount]);

  const formatCurrency = (amount: Decimal | number) => {
    const value = amount instanceof Decimal ? amount : new Decimal(amount);
    return `$${value.toFixed(2)} MXN`;
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

  const handlePayment = async () => {
    if (!paymentAmount) return;

    const payment = new Decimal(paymentAmount);
    if (payment.lt(totalAmount)) {
      setError('El monto pagado es insuficiente');
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isRenewal ? `/api/pension/renew/${customer.id}` : '/api/pension/payment';
      const payload = isRenewal ? {
        durationMonths: renewalMonths,
        cashReceived: payment.toNumber()
      } : {
        customerId: customer.id,
        cashReceived: payment.toNumber()
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
          <h2 className="text-2xl font-bold text-gray-900">
            {isRenewal ? 'Renovar Pensión' : 'Pago de Pensión'}
          </h2>
          <p className="text-gray-600">Procesar pago mensual</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Información del Cliente
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Cliente:</span>
              <span className="font-semibold">{customer.name}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Placa:</span>
              <span className="font-mono font-bold">{customer.plateNumber}</span>
            </div>
            
            {customer.vehicleMake && (
              <div className="flex justify-between">
                <span className="text-gray-600">Vehículo:</span>
                <span>{customer.vehicleMake} {customer.vehicleModel}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                customer.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                customer.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-800' :
                customer.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getStatusMessage()}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Válido hasta:</span>
              <span>{new Date(customer.endDate).toLocaleDateString('es-MX')}</span>
            </div>

            {/* Payment Type Selection */}
            <div className="border-t pt-3 mt-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!isRenewal}
                    onChange={() => setIsRenewal(false)}
                    className="mr-3"
                  />
                  <span>Pago mensual regular (${customer.monthlyRate.toFixed(2)} MXN)</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={isRenewal}
                    onChange={() => setIsRenewal(true)}
                    className="mr-3"
                  />
                  <span>Renovación por múltiples meses</span>
                </label>
                
                {isRenewal && (
                  <div className="ml-6 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Meses a renovar:
                    </label>
                    <select
                      value={renewalMonths}
                      onChange={(e) => setRenewalMonths(parseInt(e.target.value))}
                      className="input-field"
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
            
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total a Pagar:</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalAmount)}
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
              {/* Show relevant amounts */}
              {[
                customer.monthlyRate.toString(),
                '50', '100', '200', '500', 
                (customer.monthlyRate * 2).toString()
              ].slice(0, 5).map((amount) => (
                <button
                  key={amount}
                  onClick={() => addAmount(amount)}
                  className="btn-secondary py-3 text-sm font-medium"
                >
                  ${parseFloat(amount).toFixed(0)}
                </button>
              ))}
              <button
                onClick={clearAmount}
                className="btn-danger py-3 text-sm"
              >
                Limpiar
              </button>
            </div>

            {change && change.gt(0) && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-blue-800 font-medium">Cambio:</span>
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
              disabled={!paymentAmount || isProcessing || new Decimal(paymentAmount || 0).lt(totalAmount)}
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
                  {isRenewal ? 'Confirmar Renovación' : 'Confirmar Pago'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}