import { useState, useEffect } from 'react';
import { UserPlus, ArrowLeft, AlertCircle, CheckCircle, Car, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Money } from '../../../../shared/utils/money';

const registrationSchema = z.object({
  name: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre muy largo'),
  
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[\d\s\-\+\(\)]+$/.test(val), {
      message: 'Formato de teléfono inválido'
    }),
  
  plateNumber: z.string()
    .min(3, 'Número de placa muy corto')
    .max(15, 'Número de placa muy largo')
    .regex(/^[A-Z0-9\-]+$/, 'Placa debe contener solo letras, números y guiones'),
  
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  
  durationMonths: z.number()
    .int('Duración debe ser un número entero')
    .min(1, 'Duración mínima 1 mes')
    .max(6, 'Duración máxima 6 meses')
});

type RegistrationForm = z.infer<typeof registrationSchema>;

interface PensionRegistrationProps {
  onRegistrationComplete: (customer?: any) => void;
  onBack: () => void;
}

export default function PensionRegistration({ onRegistrationComplete, onBack }: PensionRegistrationProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [monthlyRate, setMonthlyRate] = useState<number | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  
  // Fetch pricing configuration
  useEffect(() => {
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    try {
      const response = await fetch('/api/parking/pricing');
      if (response.ok) {
        const result = await response.json();
        setMonthlyRate(parseFloat(result.data.monthlyRate));
      } else {
        setError('Error al cargar configuración de precios');
      }
    } catch (err) {
      setError('Error de conexión al cargar precios');
    } finally {
      setLoadingPricing(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      durationMonths: 1
    }
  });

  const watchedValues = watch();
  const totalAmount = (monthlyRate || 0) * (watchedValues.durationMonths || 1);

  // Helper function to safely format currency without Money class limits
  const formatCurrency = (amount: number): string => {
    try {
      // If amount is within Money class limits, use it for consistency
      if (amount <= 9999.99) {
        return Money.fromNumber(amount).formatPesos();
      }
      // For larger amounts, format manually
      return `$${amount.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} MXN`;
    } catch (error) {
      // Fallback formatting if Money class fails
      return `$${amount.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} MXN`;
    }
  };

  const onSubmit = async (data: RegistrationForm) => {
    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/pension/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          monthlyRate: monthlyRate,
          plateNumber: data.plateNumber.toUpperCase(),
          startDate: new Date().toISOString()
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('¡Cliente de pensión registrado exitosamente! Redirigiendo a cobro...');
        reset();
        
        setTimeout(() => {
          onRegistrationComplete(result.data);
        }, 1500);
      } else {
        const errorMessage = result.error?.message || result.message || 'Error al registrar cliente';
        setError(errorMessage);
      }
    } catch (err) {
      setError('Error de conexión. Verifique la red.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6">
      {/* Header Section - Mobile Optimized */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 text-center sm:text-left">
          Registrar Cliente de Pensión
        </h2>
        <p className="text-sm sm:text-base text-gray-600 text-center sm:text-left mt-1">
          Nuevo cliente mensual
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Icon Section - Responsive */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
            <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
          </div>
        </div>

        {/* Form Fields - Mobile-First Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Personal Information Section */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Personal
            </h3>
            
            {/* Name Field - Touch Friendly */}
            <div>
              <label htmlFor="name" className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                Nombre Completo *
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                className="w-full h-12 sm:h-14 px-4 sm:px-5 text-base sm:text-lg border-2 border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                         bg-white placeholder-gray-400 touch-manipulation"
                placeholder="Juan Pérez García"
                autoFocus
              />
              {errors.name && (
                <p className="mt-2 text-sm sm:text-base text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Phone Field - Touch Friendly */}
            <div>
              <label htmlFor="phone" className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                Teléfono
              </label>
              <input
                {...register('phone')}
                type="tel"
                id="phone"
                className="w-full h-12 sm:h-14 px-4 sm:px-5 text-base sm:text-lg border-2 border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                         bg-white placeholder-gray-400 touch-manipulation"
                placeholder="55-1234-5678"
              />
              {errors.phone && (
                <p className="mt-2 text-sm sm:text-base text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          {/* Vehicle Information Section */}
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 flex items-center gap-2">
              <Car className="w-5 h-5" />
              Información del Vehículo
            </h3>
            
            {/* Plate Number Field - Prominent Display */}
            <div>
              <label htmlFor="plateNumber" className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                Número de Placa *
              </label>
              <input
                {...register('plateNumber')}
                type="text"
                id="plateNumber"
                className="w-full h-14 sm:h-16 px-4 sm:px-5 text-lg sm:text-xl lg:text-2xl font-mono 
                         border-2 border-gray-300 rounded-lg text-center uppercase font-bold
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                         bg-white placeholder-gray-400 tracking-wider touch-manipulation"
                placeholder="ABC-123"
                style={{ textTransform: 'uppercase' }}
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.value = target.value.toUpperCase();
                }}
              />
              {errors.plateNumber && (
                <p className="mt-2 text-sm sm:text-base text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.plateNumber.message}
                </p>
              )}
            </div>

            {/* Vehicle Make/Model - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="vehicleMake" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                  Marca
                </label>
                <input
                  {...register('vehicleMake')}
                  type="text"
                  id="vehicleMake"
                  className="w-full h-12 sm:h-14 px-4 text-base sm:text-lg border-2 border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                           bg-white placeholder-gray-400 touch-manipulation"
                  placeholder="Toyota"
                />
              </div>

              <div>
                <label htmlFor="vehicleModel" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                  Modelo
                </label>
                <input
                  {...register('vehicleModel')}
                  type="text"
                  id="vehicleModel"
                  className="w-full h-12 sm:h-14 px-4 text-base sm:text-lg border-2 border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                           bg-white placeholder-gray-400 touch-manipulation"
                  placeholder="Corolla"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing and Duration Section - Full Width Card */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Configuración de Pensión
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Monthly Rate Display */}
            <div>
              <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                Tarifa Mensual (Sistema)
              </label>
              <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-4 sm:px-6 sm:py-5 text-center
                            min-h-[60px] sm:min-h-[70px] flex items-center justify-center">
                {loadingPricing ? (
                  <div className="text-gray-500 text-sm sm:text-base flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    Cargando...
                  </div>
                ) : monthlyRate ? (
                  <div className="text-lg sm:text-xl font-bold text-gray-900">
                    {formatCurrency(monthlyRate)}
                  </div>
                ) : (
                  <div className="text-red-600 text-sm sm:text-base">Error al cargar tarifa</div>
                )}
              </div>
            </div>

            {/* Duration Selector - Touch Friendly */}
            <div>
              <label htmlFor="durationMonths" className="block text-sm sm:text-base font-medium text-gray-700 mb-2 sm:mb-3">
                Duración Inicial
              </label>
              <select
                {...register('durationMonths', { valueAsNumber: true })}
                id="durationMonths"
                className="w-full h-12 sm:h-14 px-4 text-base sm:text-lg border-2 border-gray-300 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors
                         bg-white touch-manipulation appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
              >
                <option value={1}>1 mes</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
              </select>
              {errors.durationMonths && (
                <p className="mt-2 text-sm sm:text-base text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.durationMonths.message}
                </p>
              )}
            </div>
          </div>

          {/* Total Amount Display - Prominent */}
          <div className="mt-6 pt-4 sm:pt-6 border-t-2 border-gray-200">
            <div className="bg-white rounded-lg p-4 sm:p-6 border-2 border-green-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
                <span className="text-lg sm:text-xl font-semibold text-gray-900">Total a Cobrar:</span>
                <span className="text-2xl sm:text-3xl font-bold text-green-600">
                  {loadingPricing ? 'Cargando...' : formatCurrency(totalAmount)}
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-600 mt-2 text-center sm:text-left">
                Válido desde hoy hasta {new Date(Date.now() + (watchedValues.durationMonths || 1) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX')}
              </p>
            </div>
          </div>
        </div>

        {/* Error Messages - Touch Friendly */}
        {error && (
          <div className="flex items-start gap-3 text-red-600 bg-red-50 border-2 border-red-200 p-4 sm:p-5 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm sm:text-base">{error}</span>
          </div>
        )}

        {/* Success Messages - Touch Friendly */}
        {success && (
          <div className="flex items-start gap-3 text-green-600 bg-green-50 border-2 border-green-200 p-4 sm:p-5 rounded-lg">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm sm:text-base">{success}</span>
          </div>
        )}

        {/* Submit Button - Large and Touch Friendly */}
        <div className="pt-4 sm:pt-6">
          <button
            type="submit"
            disabled={isCreating || loadingPricing || !monthlyRate}
            className="w-full h-14 sm:h-16 lg:h-18 px-6 text-lg sm:text-xl font-bold
                     bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     text-white rounded-lg shadow-lg hover:shadow-xl
                     transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                     disabled:transform-none disabled:cursor-not-allowed
                     flex items-center justify-center gap-3 touch-manipulation"
          >
            {isCreating ? (
              <>
                <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full"></div>
                <span className="text-base sm:text-lg">Registrando Cliente...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="text-base sm:text-lg lg:text-xl">
                  Registrar y Cobrar {formatCurrency(totalAmount)}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Help Section - Mobile Optimized */}
      <div className="mt-8 sm:mt-12 text-center space-y-2 sm:space-y-3 px-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-5">
          <div className="text-xs sm:text-sm text-blue-800 space-y-1 sm:space-y-2">
            <p className="flex items-center justify-center gap-2">
              💡 <span>Se imprimirá automáticamente la tarjeta de pensión</span>
            </p>
            <p className="flex items-center justify-center gap-2">
              📝 <span>Todos los campos marcados con * son obligatorios</span>
            </p>
            <p className="flex items-center justify-center gap-2">
              💰 <span>El pago inicial incluye el período seleccionado</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}