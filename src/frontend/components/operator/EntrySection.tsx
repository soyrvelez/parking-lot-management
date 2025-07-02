import { useState } from 'react';
import { Car, ArrowLeft, Printer, AlertCircle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const entrySchema = z.object({
  plateNumber: z.string()
    .min(1, 'Número de placa requerido')
    .max(10, 'Máximo 10 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras mayúsculas, números y guiones'),
});

type EntryForm = z.infer<typeof entrySchema>;

interface EntrySectionProps {
  onTicketCreated: (ticket: any) => void;
  onBack: () => void;
}

export default function EntrySection({ onTicketCreated, onBack }: EntrySectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
  });

  const onSubmit = async (data: EntryForm) => {
    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/parking/entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('¡Boleto creado exitosamente!');
        
        // Extract ticket data from API response - printing handled by backend
        const rawTicketData = result.data || result;
        const ticketData = {
          ...rawTicketData,
          ticketPrinted: true, // Backend handles printing internally
          // Ensure we have a valid entry time, fallback to current time if invalid
          entryTime: rawTicketData.entryTime || new Date().toISOString()
        };
        
        // Reset form for next entry
        reset();
        
        // Show confirmation screen
        onTicketCreated(ticketData);
      } else {
        const errorMessage = result.error?.message || result.message || 'Error al crear el boleto';
        setError(errorMessage);
      }
    } catch (err) {
      setError('Error de conexión. Verifique la red.');
    } finally {
      setIsCreating(false);
    }
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
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Nueva Entrada</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Registrar nuevo vehículo</p>
        </div>
      </div>

      {/* Main Form Container - Responsive width and spacing */}
      <div className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {/* Car Icon - Responsive sizing */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-green-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <Car className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-green-600" />
            </div>
          </div>

          {/* Plate Number Input - Touch-friendly sizing */}
          <div>
            <label 
              htmlFor="plateNumber" 
              className="block text-sm sm:text-base md:text-lg font-medium text-gray-700 mb-2 sm:mb-3 text-center sm:text-left"
            >
              Número de Placa
            </label>
            <input
              {...register('plateNumber')}
              type="text"
              id="plateNumber"
              className="w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-2 border-gray-300 rounded-xl sm:rounded-2xl text-lg sm:text-xl md:text-2xl font-mono text-center uppercase focus:ring-4 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 touch-manipulation"
              placeholder="ABC-123"
              autoFocus
              style={{ textTransform: 'uppercase' }}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = target.value.toUpperCase();
              }}
            />
            {errors.plateNumber && (
              <p className="mt-2 text-sm sm:text-base text-red-600 text-center font-medium">
                {errors.plateNumber.message}
              </p>
            )}
          </div>

          {/* Error Message - Responsive padding and text */}
          {error && (
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 text-red-600 bg-red-50 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-red-200 touch-manipulation">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-sm sm:text-base font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Success Message - Responsive padding and text */}
          {success && (
            <div className="flex items-start sm:items-center gap-2 sm:gap-3 text-green-600 bg-green-50 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-green-200 touch-manipulation">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-sm sm:text-base font-medium leading-relaxed">{success}</span>
            </div>
          )}

          {/* Submit Button - Extra large and touch-friendly */}
          <button
            type="submit"
            disabled={isCreating}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-bold py-4 sm:py-5 md:py-6 px-6 sm:px-8 text-lg sm:text-xl md:text-2xl rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-offset-2 touch-manipulation flex items-center justify-center gap-2 sm:gap-3 min-h-[72px] sm:min-h-[80px] md:min-h-[88px]"
          >
            {isCreating ? (
              <>
                <div className="animate-spin w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Creando Boleto...</span>
              </>
            ) : (
              <>
                <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Crear e Imprimir Boleto</span>
              </>
            )}
          </button>
        </form>

        {/* Helper Text - Responsive spacing and sizing */}
        <div className="mt-6 sm:mt-8 text-center space-y-2 sm:space-y-3">
          <div className="bg-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
            <p className="text-sm sm:text-base text-blue-800 font-medium flex items-center justify-center gap-2 mb-2">
              <span className="text-lg sm:text-xl">💡</span>
              El boleto se imprimirá automáticamente
            </p>
            <p className="text-sm sm:text-base text-blue-700 flex items-center justify-center gap-2">
              <span className="text-lg sm:text-xl">⚡</span>
              Use el escáner para entrada más rápida
            </p>
          </div>
          
          {/* Additional touch-friendly tip for mobile */}
          <div className="block sm:hidden">
            <p className="text-xs text-gray-500 bg-gray-100 rounded-lg p-2 border">
              💡 Consejo: Mantenga presionado para usar el escáner de códigos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}