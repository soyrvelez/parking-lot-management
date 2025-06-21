import { useState } from 'react';
import { Car, Scan, DollarSign, FileText } from 'lucide-react';
import ScanSection from '@/components/operator/ScanSection';
import EntrySection from '@/components/operator/EntrySection';
import PaymentSection from '@/components/operator/PaymentSection';
import StatusDisplay from '@/components/operator/StatusDisplay';

export default function OperatorInterface() {
  const [currentView, setCurrentView] = useState<'scan' | 'entry' | 'payment'>('scan');
  const [currentTicket, setCurrentTicket] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Sistema de Estacionamiento
          </h1>
          <p className="text-gray-600 mt-1">Interfaz del Operador</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Action Area */}
          <div className="lg:col-span-2">
            <div className="card">
              {currentView === 'scan' && (
                <ScanSection 
                  onTicketFound={setCurrentTicket}
                  onSwitchToEntry={() => setCurrentView('entry')}
                />
              )}
              
              {currentView === 'entry' && (
                <EntrySection 
                  onTicketCreated={setCurrentTicket}
                  onBack={() => setCurrentView('scan')}
                />
              )}
              
              {currentView === 'payment' && currentTicket && (
                <PaymentSection 
                  ticket={currentTicket}
                  onPaymentComplete={() => {
                    setCurrentTicket(null);
                    setCurrentView('scan');
                  }}
                  onBack={() => setCurrentView('scan')}
                />
              )}
            </div>
          </div>

          {/* Status and Quick Actions */}
          <div className="space-y-6">
            <StatusDisplay />
            
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Acciones Rápidas
              </h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => setCurrentView('scan')}
                  className="btn-secondary btn-operator w-full flex items-center justify-center gap-3"
                >
                  <Scan className="w-5 h-5" />
                  Escanear Boleto
                </button>
                
                <button
                  onClick={() => setCurrentView('entry')}
                  className="btn-primary btn-operator w-full flex items-center justify-center gap-3"
                >
                  <Car className="w-5 h-5" />
                  Nueva Entrada
                </button>
                
                {currentTicket && (
                  <button
                    onClick={() => setCurrentView('payment')}
                    className="btn-danger btn-operator w-full flex items-center justify-center gap-3"
                  >
                    <DollarSign className="w-5 h-5" />
                    Procesar Pago
                  </button>
                )}
              </div>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Estado del Sistema
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Impresora:</span>
                  <span className="text-green-600 font-medium">Conectada</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Escáner:</span>
                  <span className="text-green-600 font-medium">Listo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Base de Datos:</span>
                  <span className="text-green-600 font-medium">Activa</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}