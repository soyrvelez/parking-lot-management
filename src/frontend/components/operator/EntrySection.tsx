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
        // Extract ticket data from API response
        const ticketData = result.data || result;
        onTicketCreated(ticketData);
        reset();
        
        // Auto print ticket
        try {
          await fetch('/api/hardware/print-ticket', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticketId: result.id }),
          });
        } catch (printError) {
          console.warn('Error al imprimir:', printError);
        }
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
          <h2 className="text-2xl font-bold text-gray-900">Nueva Entrada</h2>
          <p className="text-gray-600">Registrar nuevo vehículo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-md mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Car className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div>
          <label htmlFor="plateNumber" className="block text-sm font-medium text-gray-700 mb-2">
            Número de Placa
          </label>
          <input
            {...register('plateNumber')}
            type="text"
            id="plateNumber"
            className="input-field text-center text-xl font-mono uppercase"
            placeholder="ABC-123"
            autoFocus
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
              Creando Boleto...
            </>
          ) : (
            <>
              <Printer className="w-5 h-5" />
              Crear e Imprimir Boleto
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500 space-y-1">
        <p>💡 El boleto se imprimirá automáticamente</p>
        <p>⚡ Use el escáner para entrada más rápida</p>
      </div>
    </div>
  );
}