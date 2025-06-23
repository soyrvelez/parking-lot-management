import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import Decimal from 'decimal.js';
import { useAdminErrorHandler } from '../AdminErrorBoundary';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const pricingSchema = z.object({
  minimumHours: z.number().min(0.25).max(24),
  minimumRate: z.string().refine(val => {
    try {
      const decimal = new Decimal(val);
      return decimal.gte(0) && decimal.lte(1000);
    } catch {
      return false;
    }
  }, 'Debe ser un número válido entre 0 y 1000'),
  incrementMinutes: z.number().min(5).max(60),
  incrementRate: z.string().refine(val => {
    try {
      const decimal = new Decimal(val);
      return decimal.gte(0) && decimal.lte(500);
    } catch {
      return false;
    }
  }, 'Debe ser un número válido entre 0 y 500'),
  dailySpecialHours: z.number().min(1).max(24),
  dailySpecialRate: z.string().refine(val => {
    try {
      const decimal = new Decimal(val);
      return decimal.gte(0) && decimal.lte(2000);
    } catch {
      return false;
    }
  }, 'Debe ser un número válido entre 0 y 2000'),
  monthlyRate: z.string().refine(val => {
    try {
      const decimal = new Decimal(val);
      return decimal.gte(0) && decimal.lte(10000);
    } catch {
      return false;
    }
  }, 'Debe ser un número válido entre 0 y 10000'),
  lostTicketFee: z.string().refine(val => {
    try {
      const decimal = new Decimal(val);
      return decimal.gte(0) && decimal.lte(1000);
    } catch {
      return false;
    }
  }, 'Debe ser un número válido entre 0 y 1000'),
});

type PricingForm = z.infer<typeof pricingSchema>;

export default function PricingSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { handleError } = useAdminErrorHandler();
  const { authenticatedFetch, requireAuth } = useAdminAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      minimumHours: 1,
      minimumRate: '20.00',
      incrementMinutes: 15,
      incrementRate: '15.00',
      dailySpecialHours: 8,
      dailySpecialRate: '100.00',
      monthlyRate: '2000.00',
      lostTicketFee: '150.00',
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    if (requireAuth()) {
      fetchPricingConfig();
    }
  }, []);

  const fetchPricingConfig = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/config/pricing');

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          reset(result.data);
        } else {
          throw new Error(result.error?.message || 'Error al cargar configuración');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error del servidor: ${response.status}`);
      }
    } catch (error: any) {
      handleError(error, 'fetchPricingConfig');
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al cargar la configuración de precios' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: PricingForm) => {
    setIsSaving(true);
    setMessage(null);

    try {
      // DEFENSIVE: Validate data before sending
      const validatedData = pricingSchema.parse(data);
      
      const response = await authenticatedFetch('/api/admin/config/pricing', {
        method: 'PUT',
        body: JSON.stringify(validatedData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({ 
          type: 'success', 
          text: result.data?.message || 'Configuración de precios actualizada exitosamente' 
        });
        reset(validatedData); // Reset form to mark as not dirty
      } else {
        // Handle different error types with specific Spanish messages
        let errorMessage = 'Error al actualizar la configuración';
        
        if (result.error) {
          switch (result.error.code) {
            case 'INVALID_NUMERIC_VALUES':
              errorMessage = 'Los valores ingresados no son números válidos';
              break;
            case 'NUMERIC_RANGE_ERROR':
              errorMessage = 'Los valores ingresados están fuera del rango permitido';
              break;
            case 'DUPLICATE_CONFIG_ERROR':
              errorMessage = 'Ya existe una configuración similar';
              break;
            case 'VALIDATION_ERROR':
              errorMessage = 'Los datos ingresados no son válidos';
              break;
            default:
              errorMessage = result.error.message || errorMessage;
          }
        }
        
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error: any) {
      handleError(error, 'onSubmit');
      
      let errorMessage = 'Error de conexión. Verifique la red.';
      
      if (error.name === 'ZodError') {
        errorMessage = 'Los datos ingresados no son válidos. Verifique todos los campos.';
      } else if (error.message?.includes('fetch')) {
        errorMessage = 'Error de conexión. Verifique su conexión a internet.';
      } else if (error.message?.includes('JSON')) {
        errorMessage = 'Error de formato de datos. Intente nuevamente.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const calculateExample = () => {
    try {
      // DEFENSIVE: Handle invalid input values gracefully
      const minimumRateStr = watchedValues.minimumRate || '0';
      const incrementRateStr = watchedValues.incrementRate || '0';
      
      // Validate numeric strings before creating Decimals
      if (!/^\d*\.?\d*$/.test(minimumRateStr) || !/^\d*\.?\d*$/.test(incrementRateStr)) {
        return {
          hours: 3,
          total: '0.00',
          breakdown: {
            minimum: '0.00',
            additional: '0.00',
            increments: 0,
          },
          error: 'Valores inválidos'
        };
      }

      const minimumRate = new Decimal(minimumRateStr);
      const incrementRate = new Decimal(incrementRateStr);
      const hours = 3; // Example: 3 hours
      const minHours = watchedValues.minimumHours || 1;
      const incMinutes = watchedValues.incrementMinutes || 15;

      const additionalHours = Math.max(0, hours - minHours);
      const incrementsNeeded = Math.ceil((additionalHours * 60) / incMinutes);
      const additional = incrementRate.times(incrementsNeeded);
      const total = minimumRate.plus(additional);

      return {
        hours,
        total: total.toFixed(2),
        breakdown: {
          minimum: minimumRate.toFixed(2),
          additional: additional.toFixed(2),
          increments: incrementsNeeded,
        },
      };
    } catch (error: any) {
      handleError(error, 'calculateExample');
      return {
        hours: 3,
        total: '0.00',
        breakdown: {
          minimum: '0.00',
          additional: '0.00',
          increments: 0,
        },
        error: 'Error en cálculo'
      };
    }
  };

  const example = calculateExample();

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Configuración de Tarifas</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Pricing */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Tarifa Básica</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Horas Mínimas
              </label>
              <input
                {...register('minimumHours', { valueAsNumber: true })}
                type="number"
                step="0.25"
                className="input-field"
              />
              {errors.minimumHours && (
                <p className="mt-1 text-sm text-red-600">{errors.minimumHours.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa Mínima (MXN)
              </label>
              <input
                {...register('minimumRate')}
                type="number"
                step="0.01"
                className="input-field"
              />
              {errors.minimumRate && (
                <p className="mt-1 text-sm text-red-600">{errors.minimumRate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Incremento por Minutos
              </label>
              <input
                {...register('incrementMinutes', { valueAsNumber: true })}
                type="number"
                min="5"
                max="60"
                className="input-field"
              />
              {errors.incrementMinutes && (
                <p className="mt-1 text-sm text-red-600">{errors.incrementMinutes.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa por Incremento (MXN)
              </label>
              <input
                {...register('incrementRate')}
                type="number"
                step="0.01"
                className="input-field"
              />
              {errors.incrementRate && (
                <p className="mt-1 text-sm text-red-600">{errors.incrementRate.message}</p>
              )}
            </div>
          </div>

          {/* Special Rates */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Tarifas Especiales</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa Diaria - Horas
              </label>
              <input
                {...register('dailySpecialHours', { valueAsNumber: true })}
                type="number"
                min="1"
                max="24"
                className="input-field"
              />
              {errors.dailySpecialHours && (
                <p className="mt-1 text-sm text-red-600">{errors.dailySpecialHours.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa Diaria - Precio (MXN)
              </label>
              <input
                {...register('dailySpecialRate')}
                type="number"
                step="0.01"
                className="input-field"
              />
              {errors.dailySpecialRate && (
                <p className="mt-1 text-sm text-red-600">{errors.dailySpecialRate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarifa Mensual (MXN)
              </label>
              <input
                {...register('monthlyRate')}
                type="number"
                step="0.01"
                className="input-field"
              />
              {errors.monthlyRate && (
                <p className="mt-1 text-sm text-red-600">{errors.monthlyRate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cargo por Boleto Perdido (MXN)
              </label>
              <input
                {...register('lostTicketFee')}
                type="number"
                step="0.01"
                className="input-field"
              />
              {errors.lostTicketFee && (
                <p className="mt-1 text-sm text-red-600">{errors.lostTicketFee.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Example */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Ejemplo de Cálculo</h4>
          <div className="text-sm text-blue-800">
            <p>Estancia de {example.hours} horas:</p>
            <ul className="mt-2 space-y-1 ml-4">
              <li>• Tarifa mínima: ${example.breakdown.minimum} MXN</li>
              <li>• Incrementos adicionales ({example.breakdown.increments}): ${example.breakdown.additional} MXN</li>
              <li className="font-medium">• Total: ${example.total} MXN</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {message && (
              <div className={`flex items-center gap-2 text-sm ${
                message.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {message.text}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fetchPricingConfig()}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar
            </button>

            <button
              type="submit"
              disabled={!isDirty || isSaving}
              className="btn-primary flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}