import React, { useState, useEffect } from 'react';
import { Building2, Clock, DollarSign, AlertTriangle, CheckCircle, Stamp } from 'lucide-react';

interface PartnerBusiness {
  id: string;
  name: string;
  businessType: string;
  flatRate?: string;
  hourlyRate?: string;
  maxHours?: number;
  validDays: string;
  validTimeStart?: string;
  validTimeEnd?: string;
  description?: string;
  specialInstructions?: string;
  isActive: boolean;
}

interface PartnerSectionProps {
  onTicketCreated: (ticketData: any) => void;
}

const PartnerSection: React.FC<PartnerSectionProps> = ({ onTicketCreated }) => {
  const [partners, setPartners] = useState<PartnerBusiness[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<PartnerBusiness | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessReference, setBusinessReference] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValidTime, setIsValidTime] = useState(true);

  // Load partner businesses on component mount
  useEffect(() => {
    loadPartnerBusinesses();
  }, []);

  // Check if current time is valid for selected partner
  useEffect(() => {
    if (selectedPartner) {
      checkBusinessHours();
    }
  }, [selectedPartner]);

  const loadPartnerBusinesses = async () => {
    try {
      const response = await fetch('/api/partner/businesses/active');
      const data = await response.json();
      
      if (data.success) {
        setPartners(data.data || []);
      } else {
        setError('Error al cargar socios comerciales');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const checkBusinessHours = () => {
    if (!selectedPartner) return;

    const now = new Date();
    const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
    const validDays = JSON.parse(selectedPartner.validDays || '[]');

    // Check valid days
    if (!validDays.includes(currentDay)) {
      setIsValidTime(false);
      return;
    }

    // Check valid hours
    if (selectedPartner.validTimeStart && selectedPartner.validTimeEnd) {
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      if (currentTime < selectedPartner.validTimeStart || currentTime > selectedPartner.validTimeEnd) {
        setIsValidTime(false);
        return;
      }
    }

    setIsValidTime(true);
  };

  const handleCreatePartnerTicket = async () => {
    if (!selectedPartner || !plateNumber.trim()) {
      setError('Seleccione un socio comercial e ingrese la placa');
      return;
    }

    if (!isValidTime) {
      setError('Socio comercial no válido en este horario');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/partner/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plateNumber: plateNumber.toUpperCase(),
          partnerBusinessId: selectedPartner.id,
          customerName: customerName.trim() || undefined,
          businessReference: businessReference.trim() || undefined,
          operatorId: 'operator1' // TODO: Get from auth context
        }),
      });

      const data = await response.json();

      if (data.success) {
        onTicketCreated(data.data);
        
        // Reset form
        setPlateNumber('');
        setCustomerName('');
        setBusinessReference('');
        setSelectedPartner(null);
      } else {
        setError(data.message || 'Error al crear boleto de socio');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const formatRate = (partner: PartnerBusiness) => {
    if (partner.flatRate) {
      return `$${partner.flatRate} pesos fijos`;
    }
    if (partner.hourlyRate) {
      const maxHours = partner.maxHours ? ` (máx. ${partner.maxHours}h)` : '';
      return `$${partner.hourlyRate} pesos/hora${maxHours}`;
    }
    return 'Tarifa no configurada';
  };

  const formatBusinessHours = (partner: PartnerBusiness) => {
    const validDays = JSON.parse(partner.validDays || '[]');
    const daysText = validDays.join(', ');
    
    if (partner.validTimeStart && partner.validTimeEnd) {
      return `${daysText}: ${partner.validTimeStart} - ${partner.validTimeEnd}`;
    }
    
    return daysText;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Boleto de Socio Comercial
          </h2>
          <p className="text-gray-600">
            Cree boletos con tarifas especiales para clientes de socios comerciales
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Partner Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Seleccionar Socio Comercial
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {partners.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No hay socios comerciales activos
                </p>
              ) : (
                partners.map((partner) => {
                  const isSelected = selectedPartner?.id === partner.id;
                  const now = new Date();
                  const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
                  const validDays = JSON.parse(partner.validDays || '[]');
                  const isDayValid = validDays.includes(currentDay);
                  
                  let isTimeValid = true;
                  if (partner.validTimeStart && partner.validTimeEnd) {
                    const currentTime = now.toTimeString().slice(0, 5);
                    isTimeValid = currentTime >= partner.validTimeStart && currentTime <= partner.validTimeEnd;
                  }
                  
                  const isCurrentlyValid = isDayValid && isTimeValid;

                  return (
                    <div
                      key={partner.id}
                      onClick={() => setSelectedPartner(partner)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : isCurrentlyValid
                          ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{partner.name}</h4>
                            {isCurrentlyValid ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Clock className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{partner.businessType}</p>
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-700">
                              {formatRate(partner)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatBusinessHours(partner)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {partner.specialInstructions && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          <strong>Instrucciones:</strong> {partner.specialInstructions}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ticket Creation Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">
              Información del Boleto
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placa del Vehículo *
                </label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="ABC-123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referencia del Negocio (Opcional)
                </label>
                <input
                  type="text"
                  value={businessReference}
                  onChange={(e) => setBusinessReference(e.target.value)}
                  placeholder="Ticket #123, Mesa 5, etc."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {selectedPartner && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Stamp className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">IMPORTANTE</span>
                  </div>
                  <p className="text-sm text-yellow-700 mb-2">
                    El cliente debe solicitar el <strong>sello del negocio</strong> en su boleto.
                  </p>
                  <p className="text-xs text-yellow-600">
                    Sin sello = se cobrará tarifa regular de estacionamiento
                  </p>
                </div>
              )}

              {!isValidTime && selectedPartner && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">Horario No Válido</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    Este socio comercial no está disponible en el horario actual
                  </p>
                </div>
              )}

              <button
                onClick={handleCreatePartnerTicket}
                disabled={!selectedPartner || !plateNumber.trim() || !isValidTime || isLoading}
                className={`w-full py-4 px-6 rounded-lg font-medium text-lg transition-colors ${
                  !selectedPartner || !plateNumber.trim() || !isValidTime || isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
                }`}
              >
                {isLoading ? 'Creando Boleto...' : 'Crear Boleto de Socio'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerSection;