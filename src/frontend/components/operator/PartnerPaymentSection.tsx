import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft, Stamp, AlertTriangle, CheckCircle, Calculator, Building2, FileX } from 'lucide-react';

interface PartnerPaymentSectionProps {
  partnerTicket: any;
  onPaymentComplete: (paymentData: any) => void;
  onBack: () => void;
}

const PartnerPaymentSection: React.FC<PartnerPaymentSectionProps> = ({
  partnerTicket,
  onPaymentComplete,
  onBack
}) => {
  const [hasBusinessStamp, setHasBusinessStamp] = useState<boolean | null>(null);
  const [chargeRegularRate, setChargeRegularRate] = useState(false);
  const [chargeLostTicketFee, setChargeLostTicketFee] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [rateComparison, setRateComparison] = useState<any>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [change, setChange] = useState<number | null>(null);
  const [lostTicketFee, setLostTicketFee] = useState<number>(200);

  useEffect(() => {
    if (partnerTicket) {
      loadRateComparison();
    }
    loadPricingData();
  }, [partnerTicket]);

  useEffect(() => {
    // Calculate change when payment amount changes
    if (paymentAmount && calculatedAmount) {
      const payment = parseFloat(paymentAmount) || 0;
      if (payment >= calculatedAmount) {
        setChange(payment - calculatedAmount);
      } else {
        setChange(null);
      }
    }
  }, [paymentAmount, calculatedAmount]);

  useEffect(() => {
    // Update calculated amount based on rate selection
    if (rateComparison) {
      if (chargeLostTicketFee) {
        setCalculatedAmount(lostTicketFee);
      } else if (chargeRegularRate) {
        setCalculatedAmount(parseFloat(rateComparison.regularRate.amount));
      } else {
        setCalculatedAmount(parseFloat(rateComparison.partnerRate.amount));
      }
    }
  }, [chargeRegularRate, chargeLostTicketFee, rateComparison, lostTicketFee]);

  const loadRateComparison = async () => {
    try {
      const response = await fetch(`/api/partner/tickets/${partnerTicket.id}/calculate-both`);
      const data = await response.json();
      
      if (data.success) {
        setRateComparison(data.data);
        setCalculatedAmount(parseFloat(data.data.partnerRate.amount));
      } else {
        setError('Error al calcular tarifas');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const loadPricingData = async () => {
    try {
      const response = await fetch('/api/parking/pricing');
      const data = await response.json();
      
      if (data.success) {
        setLostTicketFee(parseFloat(data.data.lostTicketFee));
      }
    } catch (err) {
      console.error('Error loading pricing data:', err);
    }
  };

  const handleStampDecision = (hasStamp: boolean) => {
    setHasBusinessStamp(hasStamp);
    setChargeRegularRate(!hasStamp);
    setChargeLostTicketFee(false);
    setError('');
  };

  const handleLostTicketDecision = () => {
    setChargeLostTicketFee(true);
    setHasBusinessStamp(false);
    setChargeRegularRate(false);
    setError('');
  };

  const setExactAmount = () => {
    setPaymentAmount(calculatedAmount.toFixed(2));
  };

  const handleProcessPayment = async () => {
    if (!chargeLostTicketFee && hasBusinessStamp === null) {
      setError('Debe verificar si el boleto tiene sello del negocio o seleccionar tarifa por boleto perdido');
      return;
    }

    if (!paymentAmount || parseFloat(paymentAmount) < calculatedAmount) {
      setError('El monto de pago debe ser mayor o igual al total');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      let response;
      
      if (chargeLostTicketFee) {
        // Use partner lost ticket endpoint for partner lost ticket fees
        response = await fetch('/api/partner/lost-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plateNumber: partnerTicket.plateNumber,
            cashReceived: parseFloat(paymentAmount),
            operatorId: 'operator1'
          }),
        });
      } else {
        // Use regular partner payment endpoint
        response = await fetch(`/api/partner/tickets/${partnerTicket.id}/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hasBusinessStamp,
            chargeRegularRate,
            operatorId: 'operator1', // TODO: Get from auth context
            paymentMethod: 'CASH'
          }),
        });
      }

      const data = await response.json();

      if (data.success) {
        const changeAmount = change || 0;
        
        if (chargeLostTicketFee) {
          // Handle lost ticket payment completion
          onPaymentComplete({
            transactionId: data.data.transactionId || data.data.id,
            plateNumber: partnerTicket.plateNumber,
            totalAmount: `$${lostTicketFee.toFixed(2)} MXN`,
            cashReceived: `$${parseFloat(paymentAmount).toFixed(2)} MXN`,
            changeGiven: `$${changeAmount.toFixed(2)} MXN`,
            paymentTime: new Date().toISOString(),
            receiptPrinted: true,
            transactionType: 'LOST_TICKET'
          });
        } else {
          // Handle regular partner payment completion
          onPaymentComplete({
            ticketNumber: data.data.ticket?.id || partnerTicket.id,
            plateNumber: partnerTicket.plateNumber,
            totalAmount: `$${calculatedAmount.toFixed(2)} MXN`,
            cashReceived: `$${parseFloat(paymentAmount).toFixed(2)} MXN`,
            changeGiven: `$${changeAmount.toFixed(2)} MXN`,
            paymentTime: new Date().toISOString(),
            receiptPrinted: true,
            transactionType: 'PARTNER',
            isPartnerTicket: true,
            hasBusinessStamp,
            chargedRegularRate: chargeRegularRate
          });
        }
      } else {
        setError(data.message || 'Error al procesar pago');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (entryTime: string) => {
    const entry = new Date(entryTime);
    const now = new Date();
    const hours = Math.ceil((now.getTime() - entry.getTime()) / (1000 * 60 * 60));
    return `${hours} horas`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!partnerTicket || !rateComparison) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Cargando información del boleto...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Pago Boleto de Socio
            </h2>
            <p className="text-gray-600">
              {partnerTicket.partnerBusiness.name} - {partnerTicket.plateNumber}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              Información del Boleto
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Socio Comercial:</span>
                <p className="font-medium">{partnerTicket.partnerBusiness.name}</p>
              </div>
              
              <div>
                <span className="text-sm text-gray-500">Tipo de Negocio:</span>
                <p className="font-medium">{partnerTicket.partnerBusiness.businessType}</p>
              </div>

              <div>
                <span className="text-sm text-gray-500">Placa:</span>
                <p className="font-medium font-mono">{partnerTicket.plateNumber}</p>
              </div>

              <div>
                <span className="text-sm text-gray-500">Entrada:</span>
                <p className="font-medium">{formatTime(partnerTicket.entryTime)}</p>
              </div>

              <div>
                <span className="text-sm text-gray-500">Tiempo Estacionado:</span>
                <p className="font-medium">{formatDuration(partnerTicket.entryTime)}</p>
              </div>

              {partnerTicket.customerName && (
                <div>
                  <span className="text-sm text-gray-500">Cliente:</span>
                  <p className="font-medium">{partnerTicket.customerName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Rate Comparison and Stamp Verification */}
          <div className="space-y-6">
            {/* Stamp Verification */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Stamp className="w-5 h-5 text-yellow-600" />
                Tipo de Pago
              </h3>

              <p className="text-sm text-gray-600 mb-4">
                Seleccione el tipo de pago a aplicar
              </p>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleStampDecision(true)}
                  className={`p-4 border rounded-lg transition-all ${
                    hasBusinessStamp === true && !chargeLostTicketFee
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                  <span className="block font-medium">SÍ tiene sello</span>
                  <span className="text-xs">Aplicar tarifa de socio</span>
                </button>

                <button
                  onClick={() => handleStampDecision(false)}
                  className={`p-4 border rounded-lg transition-all ${
                    hasBusinessStamp === false && !chargeLostTicketFee
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                  <span className="block font-medium">NO tiene sello</span>
                  <span className="text-xs">Aplicar tarifa regular</span>
                </button>

                <button
                  onClick={handleLostTicketDecision}
                  className={`p-4 border rounded-lg transition-all ${
                    chargeLostTicketFee
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                  }`}
                >
                  <FileX className="w-6 h-6 mx-auto mb-2" />
                  <span className="block font-medium">Boleto perdido</span>
                  <span className="text-xs">Aplicar tarifa por extravío</span>
                </button>
              </div>
            </div>

            {/* Rate Comparison */}
            {(hasBusinessStamp !== null || chargeLostTicketFee) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  Comparación de Tarifas
                </h3>

                <div className="space-y-3">
                  <div className={`p-3 rounded-lg border ${
                    !chargeRegularRate && !chargeLostTicketFee ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Tarifa de Socio:</span>
                      <span className="text-lg font-bold text-green-600">
                        ${rateComparison.partnerRate.amount} MXN
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{rateComparison.partnerRate.description}</p>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    chargeRegularRate && !chargeLostTicketFee ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Tarifa Regular:</span>
                      <span className="text-lg font-bold text-orange-600">
                        ${rateComparison.regularRate.amount} MXN
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{rateComparison.regularRate.description}</p>
                  </div>

                  <div className={`p-3 rounded-lg border ${
                    chargeLostTicketFee ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Tarifa por Extravío:</span>
                      <span className="text-lg font-bold text-red-600">
                        ${lostTicketFee.toFixed(2)} MXN
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">Tarifa fija por boleto perdido</p>
                  </div>

                  {rateComparison.comparison.savings > 0 && !chargeRegularRate && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Ahorro:</strong> ${rateComparison.comparison.savings} MXN 
                        ({rateComparison.comparison.savingsPercentage})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Section */}
        {(hasBusinessStamp !== null || chargeLostTicketFee) && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Procesar Pago
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total a Cobrar
                </label>
                <div className="text-3xl font-bold text-gray-900">
                  ${calculatedAmount.toFixed(2)} MXN
                </div>
                <p className="text-sm text-gray-500">
                  {chargeLostTicketFee ? 'Tarifa por Extravío' : chargeRegularRate ? 'Tarifa Regular' : 'Tarifa de Socio'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto Recibido
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={setExactAmount}
                  className="mt-2 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
                >
                  Monto Exacto (${calculatedAmount.toFixed(2)})
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cambio
                </label>
                <div className={`text-2xl font-bold ${
                  change && change > 0 ? 'text-green-600' : 'text-gray-400'
                }`}>
                  ${change ? change.toFixed(2) : '0.00'} MXN
                </div>
              </div>
            </div>

            <button
              onClick={handleProcessPayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) < calculatedAmount || isProcessing}
              className={`w-full mt-6 py-4 px-6 rounded-lg font-medium text-lg transition-colors ${
                !paymentAmount || parseFloat(paymentAmount) < calculatedAmount || isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500'
              }`}
            >
              {isProcessing ? 'Procesando Pago...' : 'Procesar Pago'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerPaymentSection;