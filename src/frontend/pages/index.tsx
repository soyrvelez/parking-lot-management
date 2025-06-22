import { useState } from 'react';
import { Car, Scan, DollarSign, FileText, Users } from 'lucide-react';
import ScanSection from '../components/operator/ScanSection';
import EntrySection from '../components/operator/EntrySection';
import PaymentSection from '../components/operator/PaymentSection';
import PensionSection from '../components/operator/PensionSection';
import StatusDisplay from '../components/operator/StatusDisplay';
import HardwareStatusIndicator from '../components/operator/HardwareStatusIndicator';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export default function OperatorInterface() {
  const [currentView, setCurrentView] = useState<'scan' | 'entry' | 'payment' | 'pension'>('scan');
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [currentPensionCustomer, setCurrentPensionCustomer] = useState<any>(null);

  // Keyboard shortcuts for operator efficiency
  useKeyboardShortcuts({
    onScanMode: () => {
      setCurrentView('scan');
      setCurrentTicket(null);
    },
    onEntryMode: () => {
      setCurrentView('entry');
    },
    onPensionMode: () => {
      setCurrentView('pension');
    },
    onPaymentMode: () => {
      if (currentTicket) {
        setCurrentView('payment');
      }
    },
    onEscape: () => {
      setCurrentView('scan');
      setCurrentTicket(null);
    }
  });

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex flex-col">
        {/* Navigation Tabs - Always Visible */}
        <div className="bg-white border-b border-gray-200 px-6 shadow-sm">
          <nav className="flex space-x-2">
            <button
              onClick={() => setCurrentView('scan')}
              className={`px-8 py-4 text-lg font-medium rounded-t-lg transition-colors ${
                currentView === 'scan'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Scan className="w-6 h-6" />
                Escanear
              </div>
            </button>
            
            <button
              onClick={() => setCurrentView('entry')}
              className={`px-8 py-4 text-lg font-medium rounded-t-lg transition-colors ${
                currentView === 'entry'
                  ? 'bg-green-50 text-green-700 border-b-2 border-green-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Car className="w-6 h-6" />
                Nueva Entrada
              </div>
            </button>

            <button
              onClick={() => setCurrentView('pension')}
              className={`px-8 py-4 text-lg font-medium rounded-t-lg transition-colors ${
                currentView === 'pension'
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6" />
                Pensión
              </div>
            </button>

            {currentTicket && currentTicket.status !== 'PAID' && (
              <button
                onClick={() => setCurrentView('payment')}
                className={`px-8 py-4 text-lg font-medium rounded-t-lg transition-colors ${
                  currentView === 'payment'
                    ? 'bg-red-50 text-red-700 border-b-2 border-red-700'
                    : 'text-gray-500 hover:text-gray-700'
                } animate-pulse`}
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6" />
                  Procesar Pago
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Main Content Area - Full Width Single Screen */}
        <div className="flex-1 p-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {currentView === 'scan' && (
              <ScanSection 
                onTicketFound={(ticket) => {
                  setCurrentTicket(ticket);
                  setCurrentView('payment');
                }}
                onPensionCustomerFound={(customer) => {
                  setCurrentPensionCustomer(customer);
                  setCurrentView('pension');
                }}
                onSwitchToEntry={() => setCurrentView('entry')}
              />
            )}
            
            {currentView === 'entry' && (
              <EntrySection 
                onTicketCreated={(ticket) => {
                  setCurrentTicket(null);
                  setCurrentView('scan');
                }}
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

            {currentView === 'pension' && (
              <PensionSection 
                onBack={() => setCurrentView('scan')}
              />
            )}
          </div>
        </div>

        {/* Bottom Status Bar - Compact */}
        <div className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
            <StatusDisplay />
            <div className="flex-shrink-0">
              <HardwareStatusIndicator />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}