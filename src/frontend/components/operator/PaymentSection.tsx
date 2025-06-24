import { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Printer, Calculator, Clock, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
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
              onPaymentComplete({ alreadyPaid: true, ticket: ticket });
            }, 1000);
          } else {
            setError('Este boleto ya fue procesado.');
            // Return to scan mode for any processed ticket
            setTimeout(() => {
              onPaymentComplete({ alreadyProcessed: true, ticket: ticket });
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
      </div>
    </div>
  );
}

interface LostTicketSectionProps {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  initialPlateNumber?: string;
}

export function LostTicketSection({ onSuccess, onError, initialPlateNumber = '' }: LostTicketSectionProps) {
  const [plateNumber, setPlateNumber] = useState(initialPlateNumber);
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingPlate, setIsValidatingPlate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lostTicketFee, setLostTicketFee] = useState<number>(150); // Default, will be fetched
  const [ticketDetails, setTicketDetails] = useState<any>(null);
  const [plateValidated, setPlateValidated] = useState(false);

  // Fetch current lost ticket fee from pricing config
  useEffect(() => {
    const fetchLostTicketFee = async () => {
      try {
        const response = await fetch('/api/parking/pricing');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.lostTicketFee) {
            setLostTicketFee(parseFloat(data.data.lostTicketFee));
          }
        }
      } catch (error) {
        console.error('Error fetching lost ticket fee:', error);
      }
    };

    fetchLostTicketFee();
  }, []);

  // Validate plate number against active tickets
  const validatePlateNumber = async (plate: string) => {
    if (!plate || plate.trim().length === 0) {
      setError('Número de placa es requerido');
      return false;
    }

    setIsValidatingPlate(true);
    setError(null);
    setTicketDetails(null);
    setPlateValidated(false);

    try {
      const response = await fetch('/api/parking/validate-plate-for-lost-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plateNumber: plate.trim().toUpperCase()
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTicketDetails(result.data);
        setLostTicketFee(result.data.lostTicketFeeAmount);
        setPlateValidated(true);
        setError(null);
        return true;
      } else {
        setError(result.error?.message || 'No se encontró un boleto activo para esta placa');
        setPlateValidated(false);
        return false;
      }
    } catch (error) {
      console.error('Error validating plate:', error);
      setError('Error de conexión al validar la placa');
      setPlateValidated(false);
      return false;
    } finally {
      setIsValidatingPlate(false);
    }
  };

  // Handle plate number changes
  const handlePlateNumberChange = (value: string) => {
    setPlateNumber(value);
    // Reset validation when plate changes
    if (plateValidated) {
      setPlateValidated(false);
      setTicketDetails(null);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Ensure plate is validated before allowing payment
    if (!plateValidated) {
      setError('Debe validar la placa antes de procesar el pago');
      return;
    }
    setSuccess(null);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/parking/lost-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plateNumber: plateNumber.toUpperCase(),
          cashReceived: parseFloat(cashReceived),
          operatorId: 'OPERATOR' // This should come from auth context
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('¡Pago de boleto extraviado procesado exitosamente!');
        
        // Print receipt and track print status (align with regular payment workflow)
        let receiptPrinted = true;
        try {
          const printResponse = await fetch('/api/hardware/print-lost-ticket-receipt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transactionId: data.data.transactionId || data.data.id,
              plateNumber: plateNumber.toUpperCase(),
              cashReceived: parseFloat(cashReceived),
              change: (parseFloat(cashReceived) - lostTicketFee).toFixed(2),
              lostTicketFee: lostTicketFee
            }),
          });
          receiptPrinted = printResponse.ok;
        } catch (printError) {
          console.warn('Error al imprimir recibo de boleto extraviado:', printError);
          receiptPrinted = false;
        }

        // Prepare payment data consistent with regular payment workflow
        const paymentData = {
          transactionId: data.data.transactionId || data.data.id,
          plateNumber: plateNumber.toUpperCase(),
          transactionType: 'LOST_TICKET',
          totalAmount: `$${lostTicketFee.toFixed(2)} MXN`,
          cashReceived: `$${parseFloat(cashReceived).toFixed(2)} MXN`,
          changeGiven: `$${(parseFloat(cashReceived) - lostTicketFee).toFixed(2)} MXN`,
          paymentTime: new Date().toISOString(),
          receiptPrinted
        };

        // Reset form
        setPlateNumber('');
        setCashReceived('');
        
        // Call completion with consistent payment data structure
        onSuccess?.(paymentData);
      } else {
        setError(data.error?.message || 'Error procesando boleto perdido');
        onError?.(data.error?.message || 'Error procesando boleto perdido');
      }
    } catch (error) {
      const errorMessage = 'Error de conexión procesando boleto perdido';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const cashShortcuts = ['50', '100', '200', '500'];
  const change = cashReceived ? Math.max(0, parseFloat(cashReceived) - lostTicketFee) : 0;

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <AlertTriangle className="w-12 h-12 text-orange-500" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            Boleto Perdido
          </h2>
          <p className="text-gray-600 mt-2">
            Procesar pago por boleto extraviado
          </p>
        </div>

        {/* Lost Ticket Fee Display */}
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="text-center">
            <h3 className="text-lg font-medium text-orange-800 mb-2">
              Tarifa por Boleto Perdido
            </h3>
            <p className="text-2xl font-bold text-orange-900">
              {formatCurrency(lostTicketFee)}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plate Number Input and Validation */}
          <div>
            <label htmlFor="plateNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Placa del Vehículo
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                id="plateNumber"
                value={plateNumber}
                onChange={(e) => handlePlateNumberChange(e.target.value.toUpperCase())}
                placeholder="Ejemplo: ABC123"
                className={`flex-1 px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                  plateValidated ? 'border-green-500 bg-green-50' : 'border-gray-300'
                }`}
                required
                maxLength={10}
              />
              <button
                type="button"
                onClick={() => validatePlateNumber(plateNumber)}
                disabled={isValidatingPlate || !plateNumber.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isValidatingPlate ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Validando...
                  </>
                ) : plateValidated ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Validado
                  </>
                ) : (
                  'Validar Placa'
                )}
              </button>
            </div>
            
            {/* Ticket Details Display */}
            {plateValidated && ticketDetails && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">✅ Boleto Activo Encontrado</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">ID del Boleto:</span>
                    <div className="font-mono font-medium">{ticketDetails.ticketId}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Hora de Entrada:</span>
                    <div className="font-medium">{ticketDetails.entryTime}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Tiempo en Estacionamiento:</span>
                    <div className="font-medium">{ticketDetails.duration}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Tarifa por Extravío:</span>
                    <div className="font-bold text-orange-600">{ticketDetails.lostTicketFee}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cash Payment Section */}
          <div>
            <label htmlFor="cashReceived" className="block text-sm font-medium text-gray-700 mb-2">
              Efectivo Recibido (MXN)
            </label>
            
            {/* Cash Shortcuts */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {cashShortcuts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setCashReceived(amount)}
                  className={`py-2 px-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                    cashReceived === amount
                      ? 'bg-orange-100 border-orange-500 text-orange-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <input
              type="number"
              id="cashReceived"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min={lostTicketFee}
              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>

          {/* Change Display */}
          {cashReceived && parseFloat(cashReceived) >= lostTicketFee && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium text-green-800 mb-1">
                  Cambio a Entregar
                </h3>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(change)}
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-center font-medium">{error}</p>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-center font-medium">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing || !plateValidated || !cashReceived || parseFloat(cashReceived) < lostTicketFee}
            className="w-full bg-orange-600 text-white text-lg font-bold py-4 px-6 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <>
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Procesando...
              </>
            ) : (
              'PROCESAR BOLETO EXTRAVIADO'
            )}
          </button>

          {/* Validation Notice */}
          {!plateValidated && plateNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-blue-500 mr-3" />
                <p className="text-blue-700">
                  Debe validar la placa antes de poder procesar el pago
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Information */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Información Importante:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Se cobra una tarifa fija por boleto extraviado</li>
            <li>• El pago debe ser en efectivo</li>
            <li>• Se imprimirá un recibo como comprobante</li>
            <li>• El registro queda en el sistema para auditoría</li>
          </ul>
        </div>
      </div>
    </div>
  );
}