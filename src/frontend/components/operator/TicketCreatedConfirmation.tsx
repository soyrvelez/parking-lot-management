import { useState } from 'react';
import { CheckCircle, Printer, Car, Clock, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import moment from 'moment-timezone';

interface TicketCreatedConfirmationProps {
  ticket: {
    ticketNumber: string;
    plateNumber: string;
    entryTime: string;
    barcode: string;
    estimatedFee: string;
    message: string;
    ticketPrinted?: boolean;
  };
  onContinue: () => void;
  onNewEntry: () => void;
}

export default function TicketCreatedConfirmation({ 
  ticket, 
  onContinue, 
  onNewEntry 
}: TicketCreatedConfirmationProps) {
  const [isReprinting, setIsReprinting] = useState(false);
  const [reprintError, setReprintError] = useState('');
  const [reprintSuccess, setReprintSuccess] = useState('');

  const handleReprint = async () => {
    setIsReprinting(true);
    setReprintError('');
    setReprintSuccess('');

    try {
      const response = await fetch('/api/hardware/print-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ticketId: ticket.ticketNumber,
          reprint: true 
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setReprintSuccess('¡Boleto reimpreso exitosamente!');
        // Clear success message after 3 seconds
        setTimeout(() => setReprintSuccess(''), 3000);
      } else {
        setReprintError(result.error?.message || 'Error al reimprimir boleto');
      }
    } catch (error) {
      setReprintError('Error de conexión. Verifique la impresora.');
    } finally {
      setIsReprinting(false);
    }
  };

  const formatEntryTime = (timeString: string) => {
    try {
      // Validate the date string first
      if (!timeString || timeString === 'Invalid Date') {
        return 'Ahora mismo';
      }
      
      const date = moment.tz(timeString, 'America/Mexico_City');
      
      // Check if moment created a valid date
      if (!date.isValid()) {
        console.warn('Invalid date string received:', timeString);
        return 'Ahora mismo';
      }
      
      // Format as a more user-friendly display
      const now = moment.tz('America/Mexico_City');
      const diffMinutes = now.diff(date, 'minutes');
      
      if (diffMinutes < 1) {
        return 'Ahora mismo';
      } else if (diffMinutes < 60) {
        return `Hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
      } else {
        return date.format('DD/MM/YYYY HH:mm');
      }
    } catch (error) {
      console.error('Error formatting entry time:', error);
      return 'Ahora mismo';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-green-700 mb-2">
          ¡Boleto Creado Exitosamente!
        </h2>
        <p className="text-xl text-gray-600">
          El vehículo ha sido registrado en el sistema
        </p>
      </div>

      {/* Ticket Details Card */}
      <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Vehicle Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Car className="w-8 h-8 text-green-600" />
              <h3 className="text-2xl font-bold text-gray-900">Información del Vehículo</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 font-medium">Número de Placa</div>
                <div className="text-3xl font-mono font-bold text-gray-900 bg-white px-4 py-2 rounded-lg border">
                  {ticket.plateNumber}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 font-medium">Número de Boleto</div>
                <div className="text-lg font-mono text-gray-800 bg-white px-3 py-2 rounded border">
                  {ticket.ticketNumber}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Pricing & Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
              <h3 className="text-2xl font-bold text-gray-900">Información de Entrada</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 font-medium">Estado del Boleto</div>
                <div className="text-xl font-bold text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200">
                  ✅ ACTIVO
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 font-medium">Tarifa Mínima</div>
                <div className="text-xl font-bold text-green-700 bg-white px-3 py-2 rounded border">
                  {ticket.estimatedFee}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 font-medium">Registrado</div>
                <div className="text-lg font-bold text-gray-900 bg-white px-3 py-2 rounded border">
                  {formatEntryTime(ticket.entryTime)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barcode Display */}
        <div className="mt-6 pt-6 border-t border-green-200">
          <div className="text-center">
            <div className="text-sm text-gray-600 font-medium mb-2">Código de Barras</div>
            <div className="text-lg font-mono text-gray-800 bg-white px-4 py-2 rounded border inline-block">
              {ticket.barcode}
            </div>
          </div>
        </div>
      </div>

      {/* Printer Status & Actions */}
      <div className="space-y-6">
        {/* Initial Print Status */}
        {ticket.ticketPrinted === false && (
          <div className="flex items-center gap-4 text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <div className="font-medium text-lg">El boleto no se pudo imprimir automáticamente</div>
              <div className="text-sm mt-1">
                Use el botón "Reimprimir Boleto" para intentar nuevamente
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
          {/* Reprint Button */}
          <button
            type="button"
            onClick={handleReprint}
            disabled={isReprinting}
            className="btn-warning btn-operator flex items-center justify-center gap-3 text-lg py-6"
            title="Reimprimir en caso de problema con la impresora"
          >
            {isReprinting ? (
              <>
                <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full"></div>
                Imprimiendo...
              </>
            ) : (
              <>
                <Printer className="w-6 h-6" />
                Reimprimir Boleto
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
          <p>💡 Use "Reimprimir" si la impresora tuvo problemas o se acabó el papel</p>
          <p>🚗 Use "Nueva Entrada" para registrar otro vehículo inmediatamente</p>
          <p>📱 Use "Continuar" para regresar al menú principal</p>
        </div>
      </div>
    </div>
  );
}