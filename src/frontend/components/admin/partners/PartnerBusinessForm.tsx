import { useState, useEffect } from 'react';
import { Save, ArrowLeft, AlertTriangle, CheckCircle, DollarSign, Clock, Building2 } from 'lucide-react';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

interface PartnerBusiness {
  id?: string;
  name: string;
  businessType: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  flatRate?: string;
  hourlyRate?: string;
  maxHours?: number;
  validDays: string[];
  validTimeStart?: string;
  validTimeEnd?: string;
  description?: string;
  specialInstructions?: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface PartnerBusinessFormProps {
  partner?: PartnerBusiness | null;
  onSave: () => void;
  onCancel: () => void;
}

const DAYS_OF_WEEK = [
  { value: 'MON', label: 'Lunes' },
  { value: 'TUE', label: 'Martes' },
  { value: 'WED', label: 'Miércoles' },
  { value: 'THU', label: 'Jueves' },
  { value: 'FRI', label: 'Viernes' },
  { value: 'SAT', label: 'Sábado' },
  { value: 'SUN', label: 'Domingo' }
];

const BUSINESS_TYPES = [
  'Restaurante',
  'Tienda',
  'Farmacia',
  'Panadería',
  'Cafetería',
  'Supermercado',
  'Boutique',
  'Peluquería',
  'Clínica',
  'Oficina',
  'Otro'
];

export default function PartnerBusinessForm({ partner, onSave, onCancel }: PartnerBusinessFormProps) {
  const { authenticatedFetch } = useAdminAuth();
  const [formData, setFormData] = useState<PartnerBusiness>({
    name: '',
    businessType: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    flatRate: '',
    hourlyRate: '',
    maxHours: undefined,
    validDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    validTimeStart: '09:00',
    validTimeEnd: '18:00',
    description: '',
    specialInstructions: '',
    logoUrl: '',
    isActive: true
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rateType, setRateType] = useState<'flat' | 'hourly'>('flat');

  useEffect(() => {
    if (partner) {
      // Parse existing partner data
      let validDays: string[] = [];
      try {
        validDays = JSON.parse(partner.validDays as any) || [];
      } catch {
        validDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
      }

      setFormData({
        ...partner,
        validDays,
        flatRate: partner.flatRate || '',
        hourlyRate: partner.hourlyRate || '',
        contactName: partner.contactName || '',
        contactPhone: partner.contactPhone || '',
        contactEmail: partner.contactEmail || '',
        address: partner.address || '',
        validTimeStart: partner.validTimeStart || '09:00',
        validTimeEnd: partner.validTimeEnd || '18:00',
        description: partner.description || '',
        specialInstructions: partner.specialInstructions || '',
        logoUrl: partner.logoUrl || ''
      });

      // Determine rate type
      if (partner.flatRate && parseFloat(partner.flatRate) > 0) {
        setRateType('flat');
      } else if (partner.hourlyRate && parseFloat(partner.hourlyRate) > 0) {
        setRateType('hourly');
      }
    }
  }, [partner]);

  const handleInputChange = (field: keyof PartnerBusiness, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      validDays: prev.validDays.includes(day)
        ? prev.validDays.filter(d => d !== day)
        : [...prev.validDays, day]
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'El nombre del negocio es requerido';
    if (!formData.businessType.trim()) return 'El tipo de negocio es requerido';
    if (formData.validDays.length === 0) return 'Debe seleccionar al menos un día válido';

    // Rate validation
    if (rateType === 'flat') {
      if (!formData.flatRate || parseFloat(formData.flatRate) <= 0) {
        return 'La tarifa fija debe ser mayor a 0';
      }
    } else {
      if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0) {
        return 'La tarifa por hora debe ser mayor a 0';
      }
      if (formData.maxHours && formData.maxHours <= 0) {
        return 'Las horas máximas deben ser mayor a 0';
      }
    }

    // Time validation
    if (formData.validTimeStart && formData.validTimeEnd) {
      if (formData.validTimeStart >= formData.validTimeEnd) {
        return 'La hora de inicio debe ser anterior a la hora de fin';
      }
    }

    // Email validation
    if (formData.contactEmail && !formData.contactEmail.includes('@')) {
      return 'El formato del correo electrónico es inválido';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Prepare data for submission
      const submitData = {
        name: formData.name.trim(),
        businessType: formData.businessType.trim(),
        contactName: formData.contactName?.trim() || undefined,
        contactPhone: formData.contactPhone?.trim() || undefined,
        contactEmail: formData.contactEmail?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        flatRate: rateType === 'flat' ? formData.flatRate : undefined,
        hourlyRate: rateType === 'hourly' ? formData.hourlyRate : undefined,
        maxHours: rateType === 'hourly' ? formData.maxHours : undefined,
        validDays: formData.validDays,
        validTimeStart: formData.validTimeStart,
        validTimeEnd: formData.validTimeEnd,
        description: formData.description?.trim() || undefined,
        specialInstructions: formData.specialInstructions?.trim() || undefined,
        logoUrl: formData.logoUrl?.trim() || undefined,
        isActive: formData.isActive
      };

      const url = partner?.id 
        ? `/api/partner/businesses/${partner.id}`
        : '/api/partner/businesses';
      
      const method = partner?.id ? 'PUT' : 'POST';

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(partner?.id ? 'Socio comercial actualizado exitosamente' : 'Socio comercial creado exitosamente');
        setTimeout(() => {
          onSave();
        }, 1500);
      } else {
        setError(data.message || 'Error al guardar socio comercial');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {partner?.id ? 'Editar Socio Comercial' : 'Nuevo Socio Comercial'}
              </h2>
              <p className="text-gray-600">
                Configure los detalles y tarifas especiales del negocio
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Información Básica
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Negocio *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Restaurante Los Comales"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Negocio *
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => handleInputChange('businessType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar tipo</option>
                {BUSINESS_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de Contacto
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="55 1234 5678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="contacto@restaurant.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Calle Principal 123, Col. Centro"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Cliente del Restaurante Los Comales"
            />
          </div>
        </div>

        {/* Pricing Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Configuración de Tarifas *
          </h3>

          <div className="space-y-6">
            {/* Rate Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Tarifa
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRateType('flat')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    rateType === 'flat'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="font-medium">Tarifa Fija</div>
                  <div className="text-sm text-gray-600">
                    Precio fijo sin importar el tiempo de estacionamiento
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRateType('hourly')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    rateType === 'hourly'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="font-medium">Tarifa por Hora</div>
                  <div className="text-sm text-gray-600">
                    Precio por hora con límite máximo opcional
                  </div>
                </button>
              </div>
            </div>

            {/* Rate Configuration */}
            {rateType === 'flat' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tarifa Fija (MXN) *
                </label>
                <input
                  type="number"
                  value={formData.flatRate}
                  onChange={(e) => handleInputChange('flatRate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="30.00"
                  min="0"
                  step="0.01"
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Precio fijo que se cobrará independientemente del tiempo de estacionamiento
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tarifa por Hora (MXN) *
                  </label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="15.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horas Máximas (Opcional)
                  </label>
                  <input
                    type="number"
                    value={formData.maxHours || ''}
                    onChange={(e) => handleInputChange('maxHours', e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="4"
                    min="1"
                    max="24"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Límite máximo de horas para la tarifa especial
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Horarios de Validez *
          </h3>

          <div className="space-y-6">
            {/* Days Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Días Válidos
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={`p-3 border rounded-md text-sm font-medium transition-all ${
                      formData.validDays.includes(day.value)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de Inicio
                </label>
                <input
                  type="time"
                  value={formData.validTimeStart}
                  onChange={(e) => handleInputChange('validTimeStart', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de Fin
                </label>
                <input
                  type="time"
                  value={formData.validTimeEnd}
                  onChange={(e) => handleInputChange('validTimeEnd', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Configuración Adicional
          </h3>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instrucciones Especiales
              </label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Válido solo con compra mínima de $200"
              />
              <p className="mt-1 text-sm text-gray-500">
                Instrucciones que aparecerán en el boleto impreso
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Socio comercial activo
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {partner?.id ? 'Actualizar Socio' : 'Crear Socio'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}