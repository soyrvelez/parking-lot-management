import { useState } from 'react';
import { CheckCircle, Printer, DollarSign, Car, Clock, RefreshCw, AlertTriangle, Receipt } from 'lucide-react';
import moment from 'moment-timezone';
import { Money } from '../../../shared/utils/money';

interface PaymentCompletedConfirmationProps {
  paymentData: {
    ticketNumber?: string;
    transactionId?: string;
    plateNumber: string;
    totalAmount: string;
    cashReceived: string;
    changeGiven?: string;
    paymentTime: string;
    receiptPrinted?: boolean;
    transactionType?: string;
  };
  onContinue: () => void;
  onNewEntry: () => void;
}

export default function PaymentCompletedConfirmation({ 
  paymentData, 
  onContinue, 
  onNewEntry 
}: PaymentCompletedConfirmationProps) {
  const [isReprintingReceipt, setIsReprintingReceipt] = useState(false);
  const [reprintError, setReprintError] = useState('');
  const [reprintSuccess, setReprintSuccess] = useState('');

  const handleReprintReceipt = async () => {
    setIsReprintingReceipt(true);
    setReprintError('');
    setReprintSuccess('');

    try {
      // Determine which endpoint to use based on transaction type
      const isLostTicket = paymentData.transactionType === 'LOST_TICKET';
      const endpoint = isLostTicket ? '/api/hardware/print-lost-ticket-receipt' : '/api/hardware/print-receipt';
      
      // Prepare request body based on transaction type
      const requestBody = isLostTicket ? {
        transactionId: paymentData.transactionId,
        plateNumber: paymentData.plateNumber,
        cashReceived: parseFloat(paymentData.cashReceived.replace(/[^0-9.]/g, '')),
        change: parseFloat((paymentData.changeGiven || '0').replace(/[^0-9.]/g, '')),
        lostTicketFee: parseFloat(paymentData.totalAmount.replace(/[^0-9.]/g, '')),
        reprint: true
      } : {
        ticketId: paymentData.ticketNumber,
        amountPaid: paymentData.cashReceived,
        change: paymentData.changeGiven || '0',
        reprint: true
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok) {
        const successMessage = isLostTicket 
          ? '¡Recibo de boleto extraviado reimpreso exitosamente!'
          : '¡Recibo reimpreso exitosamente!';
        setReprintSuccess(successMessage);
        // Clear success message after 3 seconds
        setTimeout(() => setReprintSuccess(''), 3000);
      } else {
        setReprintError(result.error?.message || 'Error al reimprimir recibo');
      }
    } catch (error) {
      setReprintError('Error de conexión. Verifique la impresora.');
    } finally {
      setIsReprintingReceipt(false);
    }
  };

  const formatPaymentTime = (timeString: string) => {
    try {
      // Validate the date string first
      if (!timeString || timeString === 'Invalid Date') {
        return 'Hora no disponible';
      }
      
      const date = moment.tz(timeString, 'America/Mexico_City');
      
      // Check if moment created a valid date
      if (!date.isValid()) {
        console.warn('Invalid payment date string received:', timeString);
        return 'Hora no disponible';
      }
      
      return date.format('DD/MM/YYYY HH:mm:ss');
    } catch (error) {
      console.error('Error formatting payment time:', error);
      return 'Hora no disponible';
    }
  };

  const hasChange = paymentData.changeGiven ? 
    parseFloat(paymentData.changeGiven.replace('$', '').replace(' MXN', '')) > 0 : 
    false;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-green-700 mb-2">
          {paymentData.transactionType === 'LOST_TICKET' 
            ? '¡Boleto Extraviado Procesado!'
            : '¡Pago Procesado Exitosamente!'}
        </h2>
        <p className="text-xl text-gray-600">
          {paymentData.transactionType === 'LOST_TICKET'
            ? 'Tarifa de boleto extraviado cobrada exitosamente'
            : 'El vehículo puede salir del estacionamiento'}
        </p>
      </div>

      {/* Payment Details Card */}
      <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Vehicle & Payment Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Car className="w-8 h-8 text-green-600" />
              <h3 className="text-2xl font-bold text-gray-900">Información del Vehículo</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 font-medium">Número de Placa</div>
                <div className="text-3xl font-mono font-bold text-gray-900 bg-white px-4 py-2 rounded-lg border">
                  {paymentData.plateNumber}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 font-medium">
                  {paymentData.transactionType === 'LOST_TICKET' ? 'ID de Transacción' : 'Número de Boleto'}
                </div>
                <div className="text-lg font-mono text-gray-800 bg-white px-3 py-2 rounded border">
                  {paymentData.transactionType === 'LOST_TICKET' 
                    ? paymentData.transactionId 
                    : paymentData.ticketNumber}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Payment Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-8 h-8 text-blue-600" />
              <h3 className="text-2xl font-bold text-gray-900">Detalles del Pago</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 font-medium">Total a Pagar</div>
                <div className="text-2xl font-bold text-blue-700 bg-white px-3 py-2 rounded border">
                  {paymentData.totalAmount}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 font-medium">Efectivo Recibido</div>
                <div className="text-xl font-bold text-gray-900 bg-white px-3 py-2 rounded border">
                  {paymentData.cashReceived}
                </div>
              </div>

              {hasChange && (
                <div>
                  <div className="text-sm text-gray-600 font-medium">Cambio</div>
                  <div className="text-xl font-bold text-orange-600 bg-orange-50 px-3 py-2 rounded border border-orange-200">
                    {paymentData.changeGiven || '$0.00 MXN'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Time */}
        <div className="mt-6 pt-6 border-t border-green-200">
          <div className="flex items-center justify-center gap-3">
            <Clock className="w-6 h-6 text-gray-600" />
            <div className="text-center">
              <div className="text-sm text-gray-600 font-medium">Hora de Pago</div>
              <div className="text-lg font-bold text-gray-900">
                {formatPaymentTime(paymentData.paymentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Alert (if applicable) */}
      {hasChange && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-6 mb-6 rounded-r-xl">
          <div className="flex items-center gap-4">
            <DollarSign className="w-8 h-8 text-orange-600" />
            <div>
              <h4 className="text-xl font-bold text-orange-800">¡Entregar Cambio!</h4>
              <p className="text-lg text-orange-700">
                Debe entregar <span className="font-bold">{paymentData.changeGiven || '$0.00 MXN'}</span> al cliente
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Printer Status & Actions */}
      <div className="space-y-6">
        {/* Receipt Print Status */}
        {paymentData.receiptPrinted === false && (
          <div className="flex items-center gap-4 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <div className="font-medium text-lg">El recibo no se pudo imprimir automáticamente</div>
              <div className="text-sm mt-1">
                Use el botón "Reimprimir Recibo" para intentar nuevamente
              </div>
            </div>
          </div>
        )}

        {/* Reprint Status Messages */}
        {reprintSuccess && (
          <div className="flex items-center gap-4 text-green-600 bg-green-50 p-4 rounded-xl border border-green-200">
            <CheckCircle className="w-6 h-6" />
            <span className="font-medium text-lg">{reprintSuccess}</span>
          </div>
        )}

        {reprintError && (
          <div className="flex items-center gap-4 text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <div className="font-medium text-lg">{reprintError}</div>
              <div className="text-sm mt-1">
                Verifique que la impresora esté encendida y tenga papel
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Reprint Receipt Button */}
          <button
            type="button"
            onClick={handleReprintReceipt}
            disabled={isReprintingReceipt}
            className="btn-warning btn-operator flex items-center justify-center gap-3 text-lg py-6"
            title="Reimprimir recibo en caso de problema con la impresora"
          >
            {isReprintingReceipt ? (
              <>
                <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full"></div>
                Imprimiendo...
              </>
            ) : (
              <>
                <Receipt className="w-6 h-6" />
                Reimprimir Recibo
              </>
            )}
          </button>

          {/* New Entry Button */}
          <button
            type="button"
            onClick={onNewEntry}
            className="btn-success btn-operator flex items-center justify-center gap-3 text-lg py-6"
          >
            <Car className="w-6 h-6" />
            Nueva Entrada
          </button>

          {/* Continue/Scan Button */}
          <button
            type="button"
            onClick={onContinue}
            className="btn-primary btn-operator flex items-center justify-center gap-3 text-lg py-6"
          >
            <RefreshCw className="w-6 h-6" />
            Continuar
          </button>
        </div>

        {/* Helper Text */}
        <div className="text-center text-gray-500 text-sm space-y-1">
          <p>🧾 Use "Reimprimir Recibo" si la impresora tuvo problemas o se acabó el papel</p>
          <p>🚗 Use "Nueva Entrada" para registrar otro vehículo inmediatamente</p>
          <p>📱 Use "Continuar" para procesar otro pago o regresar al menú principal</p>
        </div>
      </div>
    </div>
  );
}