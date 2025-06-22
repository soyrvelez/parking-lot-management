import { useState } from 'react';
import { UserPlus, ArrowLeft, AlertCircle, CheckCircle, Car, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
  
  monthlyRate: z.number()
    .positive('Tarifa mensual debe ser positiva')
    .max(50000, 'Tarifa mensual demasiado alta'),
  
  durationMonths: z.number()
    .int('Duración debe ser un número entero')
    .min(1, 'Duración mínima 1 mes')
    .max(12, 'Duración máxima 12 meses')
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
  
  // Default monthly rate from pricing configuration
  const defaultMonthlyRate = 2000;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      monthlyRate: defaultMonthlyRate,
      durationMonths: 1
    }
  });

  const watchedValues = watch();
  const totalAmount = (watchedValues.monthlyRate || 0) * (watchedValues.durationMonths || 1);

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
          <h2 className="text-2xl font-bold text-gray-900">Registrar Cliente de Pensión</h2>
          <p className="text-gray-600">Nuevo cliente mensual</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Información Personal</h3>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo *
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                className="input-field"
                placeholder="Juan Pérez García"
                autoFocus
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                {...register('phone')}
                type="tel"
                id="phone"
                className="input-field"
                placeholder="55-1234-5678"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Información del Vehículo</h3>
            
            <div>
              <label htmlFor="plateNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Número de Placa *
              </label>
              <input
                {...register('plateNumber')}
                type="text"
                id="plateNumber"
                className="input-field text-center text-xl font-mono uppercase"
                placeholder="ABC-123"
                style={{ textTransform: 'uppercase' }}
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.value = target.value.toUpperCase();
                }}
              />
              {errors.plateNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.plateNumber.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="vehicleMake" className="block text-sm font-medium text-gray-700 mb-2">
                  Marca
                </label>
                <input
                  {...register('vehicleMake')}
                  type="text"
                  id="vehicleMake"
                  className="input-field"
                  placeholder="Toyota"
                />
              </div>

              <div>
                <label htmlFor="vehicleModel" className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo
                </label>
                <input
                  {...register('vehicleModel')}
                  type="text"
                  id="vehicleModel"
                  className="input-field"
                  placeholder="Corolla"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing and Duration */}
        <div className="card bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración de Pensión</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="monthlyRate" className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa Mensual (MXN) *
              </label>
              <input
                {...register('monthlyRate', { valueAsNumber: true })}
                type="number"
                id="monthlyRate"
                className="input-field text-center text-lg font-bold"
                placeholder="2000"
                step="50"
                min="100"
                max="50000"
              />
              {errors.monthlyRate && (
                <p className="mt-1 text-sm text-red-600">{errors.monthlyRate.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="durationMonths" className="block text-sm font-medium text-gray-700 mb-2">
                Duración Inicial
              </label>
              <select
                {...register('durationMonths', { valueAsNumber: true })}
                id="durationMonths"
                className="input-field"
              >
                <option value={1}>1 mes</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
              </select>
              {errors.durationMonths && (
                <p className="mt-1 text-sm text-red-600">{errors.durationMonths.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total a Cobrar:</span>
              <span className="text-2xl font-bold text-green-600">
                ${totalAmount.toFixed(2)} MXN
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Válido desde hoy hasta {new Date(Date.now() + (watchedValues.durationMonths || 1) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX')}
            </p>
          </div>
        </div>

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
          type="submit"
          disabled={isCreating}
          className="btn-primary w-full btn-operator flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              Registrando Cliente...
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              Registrar y Cobrar ${totalAmount.toFixed(2)} MXN
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500 space-y-1">
        <p>💡 Se imprimirá automáticamente la tarjeta de pensión</p>
        <p>📝 Todos los campos marcados con * son obligatorios</p>
        <p>💰 El pago inicial incluye el período seleccionado</p>
      </div>
    </div>
  );
}