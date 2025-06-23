import { useState, useEffect } from 'react';
import { Search, UserPlus, CreditCard, Calendar, ArrowLeft } from 'lucide-react';
import PensionLookup from './pension/PensionLookup';
import PensionPayment from './pension/PensionPayment';
import PensionRegistration from './pension/PensionRegistration';

interface PensionSectionProps {
  onBack: () => void;
}

type PensionView = 'lookup' | 'payment' | 'registration' | 'details';

export default function PensionSection({ onBack }: PensionSectionProps) {
  const [currentView, setCurrentView] = useState<PensionView>('lookup');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const handleCustomerFound = (customer: any) => {
    setSelectedCustomer(customer);
    setCurrentView('details');
  };

  const handlePaymentComplete = () => {
    setSelectedCustomer(null);
    setCurrentView('lookup');
  };

  const handleRegistrationComplete = (newCustomer: any) => {
    if (newCustomer) {
      // If customer data is provided, go to payment
      setSelectedCustomer(newCustomer);
      setCurrentView('payment');
    } else {
      // Otherwise go back to lookup
      setCurrentView('lookup');
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
          <h2 className="text-2xl font-bold text-gray-900">Clientes de Pensión</h2>
          <p className="text-gray-600">Gestión de clientes mensuales</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {currentView === 'lookup' && (
          <div>
            <PensionLookup onCustomerFound={handleCustomerFound} />
            
            {/* Quick Actions */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setCurrentView('registration')}
                className="btn-primary btn-operator flex items-center justify-center gap-3"
              >
                <UserPlus className="w-6 h-6" />
                Registrar Nuevo Cliente
              </button>
              
              <button
                onClick={() => setCurrentView('lookup')}
                className="btn-secondary btn-operator flex items-center justify-center gap-3"
              >
                <Search className="w-6 h-6" />
                Buscar Cliente
              </button>
            </div>
          </div>
        )}

        {currentView === 'details' && selectedCustomer && (
          <div>
            {/* Customer Details Card */}
            <div className="card mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Información del Cliente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nombre:</span>
                    <span className="font-semibold">{selectedCustomer.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Placa:</span>
                    <span className="font-mono font-bold">{selectedCustomer.plateNumber}</span>
                  </div>
                  
                  {selectedCustomer.vehicleMake && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vehículo:</span>
                      <span>{selectedCustomer.vehicleMake} {selectedCustomer.vehicleModel}</span>
                    </div>
                  )}
                  
                  {selectedCustomer.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Teléfono:</span>
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                      selectedCustomer.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      selectedCustomer.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-800' :
                      selectedCustomer.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedCustomer.status === 'ACTIVE' ? 'Activo' :
                       selectedCustomer.status === 'EXPIRING_SOON' ? 'Por Vencer' :
                       selectedCustomer.status === 'EXPIRED' ? 'Vencido' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tarifa Mensual:</span>
                    <span className="font-semibold">${selectedCustomer.monthlyRate.toFixed(2)} MXN</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Válido hasta:</span>
                    <span>{new Date(selectedCustomer.endDate).toLocaleDateString('es-MX')}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Días restantes:</span>
                    <span className={`font-semibold ${
                      selectedCustomer.daysRemaining > 7 ? 'text-green-600' :
                      selectedCustomer.daysRemaining > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedCustomer.daysRemaining} días
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setCurrentView('payment')}
                className="btn-primary btn-operator flex items-center justify-center gap-3"
              >
                <CreditCard className="w-6 h-6" />
                Procesar Pago
              </button>
              
              <button
                onClick={() => setCurrentView('payment')}
                className="btn-danger btn-operator flex items-center justify-center gap-3"
              >
                <Calendar className="w-6 h-6" />
                Renovar Pensión
              </button>
              
              <button
                onClick={() => setCurrentView('lookup')}
                className="btn-secondary btn-operator flex items-center justify-center gap-3"
              >
                <Search className="w-6 h-6" />
                Buscar Otro
              </button>
            </div>
          </div>
        )}

        {currentView === 'payment' && selectedCustomer && (
          <PensionPayment 
            customer={selectedCustomer}
            onPaymentComplete={handlePaymentComplete}
            onBack={() => setCurrentView('details')}
          />
        )}

        {currentView === 'registration' && (
          <PensionRegistration 
            onRegistrationComplete={handleRegistrationComplete}
            onBack={() => setCurrentView('lookup')}
          />
        )}
      </div>
    </div>
  );
}