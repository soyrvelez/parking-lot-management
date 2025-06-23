import { useState } from 'react';
import { Car, Scan, DollarSign, FileText, Users, Activity, Clock } from 'lucide-react';
import ScanSection from '../components/operator/ScanSection';
import EntrySection from '../components/operator/EntrySection';
import PaymentSection from '../components/operator/PaymentSection';
import PensionSection from '../components/operator/PensionSection';
import TicketCreatedConfirmation from '../components/operator/TicketCreatedConfirmation';
import PaymentCompletedConfirmation from '../components/operator/PaymentCompletedConfirmation';
import StatusDisplay from '../components/operator/StatusDisplay';
import HardwareStatusIndicator from '../components/operator/HardwareStatusIndicator';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

type ViewType = 'scan' | 'entry' | 'payment' | 'pension' | 'ticket-created' | 'payment-completed';

export default function OperatorInterface() {
  const [currentView, setCurrentView] = useState<ViewType>('entry');
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [currentPensionCustomer, setCurrentPensionCustomer] = useState<any>(null);
  const [createdTicketData, setCreatedTicketData] = useState<any>(null);
  const [paymentCompletedData, setPaymentCompletedData] = useState<any>(null);

  // Keyboard shortcuts for operator efficiency (only for main views)
  useKeyboardShortcuts({
    onScanMode: () => {
      if (currentView !== 'ticket-created' && currentView !== 'payment-completed') {
        setCurrentView('scan');
        setCurrentTicket(null);
      }
    },
    onEntryMode: () => {
      if (currentView !== 'ticket-created' && currentView !== 'payment-completed') {
        setCurrentView('entry');
      }
    },
    onPensionMode: () => {
      if (currentView !== 'ticket-created' && currentView !== 'payment-completed') {
        setCurrentView('pension');
      }
    },
    onPaymentMode: () => {
      if (currentTicket && currentView !== 'ticket-created' && currentView !== 'payment-completed') {
        setCurrentView('payment');
      }
    },
    onEscape: () => {
      // Allow escape from confirmation screens
      if (currentView === 'ticket-created' || currentView === 'payment-completed') {
        setCurrentView('entry');
        setCurrentTicket(null);
        setCreatedTicketData(null);
        setPaymentCompletedData(null);
      }
    }
  });

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex flex-col">
        {/* Navigation Tabs - Always Visible */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-6 shadow-sm">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto">
              <button
                onClick={() => setCurrentView('entry')}
                className={`px-3 sm:px-6 lg:px-8 py-3 sm:py-4 text-sm sm:text-lg font-medium rounded-t-lg transition-colors flex-shrink-0 ${
                  currentView === 'entry'
                    ? 'bg-green-50 text-green-700 border-b-2 border-green-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <Car className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  <span className="hidden sm:inline">Nueva Entrada</span>
                  <span className="sm:hidden">Entrada</span>
                </div>
              </button>
            
            <button
              onClick={() => setCurrentView('scan')}
              className={`px-3 sm:px-6 lg:px-8 py-3 sm:py-4 text-sm sm:text-lg font-medium rounded-t-lg transition-colors flex-shrink-0 ${
                currentView === 'scan'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <Scan className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                <span className="hidden sm:inline">Escanear</span>
                <span className="sm:hidden">Scan</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentView('pension')}
              className={`px-3 sm:px-6 lg:px-8 py-3 sm:py-4 text-sm sm:text-lg font-medium rounded-t-lg transition-colors flex-shrink-0 ${
                currentView === 'pension'
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                Pensión
              </div>
            </button>

            {currentTicket && currentTicket.status !== 'PAID' && (
              <button
                onClick={() => setCurrentView('payment')}
                className={`px-3 sm:px-6 lg:px-8 py-3 sm:py-4 text-sm sm:text-lg font-medium rounded-t-lg transition-colors flex-shrink-0 ${
                  currentView === 'payment'
                    ? 'bg-red-50 text-red-700 border-b-2 border-red-700'
                    : 'text-gray-500 hover:text-gray-700'
                } animate-pulse`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  <span className="hidden sm:inline">Procesar Pago</span>
                  <span className="sm:hidden">Pago</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Main Content Area - Full Width Single Screen */}
        <div className="flex-1 p-2 sm:p-4 lg:p-6 bg-gray-50">
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
                  setCreatedTicketData(ticket);
                  setCurrentView('ticket-created');
                }}
                onBack={() => setCurrentView('entry')} // Nueva Entrada is the home page
              />
            )}
            
            {currentView === 'payment' && currentTicket && (
              <PaymentSection 
                ticket={currentTicket}
                onPaymentComplete={(paymentData) => {
                  setPaymentCompletedData(paymentData);
                  setCurrentTicket(null);
                  setCurrentView('payment-completed');
                }}
                onBack={() => setCurrentView('scan')} // Back goes to scan when in payment
              />
            )}

            {currentView === 'ticket-created' && createdTicketData && (
              <TicketCreatedConfirmation 
                ticket={createdTicketData}
                onContinue={() => {
                  setCreatedTicketData(null);
                  setCurrentView('entry');
                }}
                onNewEntry={() => {
                  setCreatedTicketData(null);
                  setCurrentView('entry');
                }}
              />
            )}

            {currentView === 'payment-completed' && paymentCompletedData && (
              <PaymentCompletedConfirmation 
                paymentData={paymentCompletedData}
                onContinue={() => {
                  setPaymentCompletedData(null);
                  setCurrentView('entry');
                }}
                onNewEntry={() => {
                  setPaymentCompletedData(null);
                  setCurrentView('entry');
                }}
              />
            )}

            {currentView === 'pension' && (
              <PensionSection 
                onBack={() => setCurrentView('entry')} // Return to Nueva Entrada from pension
              />
            )}
          </div>
        </div>

        {/* Bottom Status Bar - Optimized 2-Row Layout */}
        <div className="bg-white border-t border-gray-200 px-3 sm:px-6 py-2 sm:py-3">
          <div className="max-w-7xl mx-auto">
            {/* Mobile/Small: 2-row layout with Sistema + Hardware on top, Stats on bottom */}
            <div className="block lg:hidden space-y-2">
              {/* Top row: Sistema status + Hardware indicators */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-primary-600" />
                  <span className="text-xs sm:text-sm text-gray-600">Sistema:</span>
                  <span className="text-xs sm:text-sm font-medium text-green-600">En Línea</span>
                </div>
                <HardwareStatusIndicator />
              </div>
              
              {/* Bottom row: Stats only - hide sistema status on mobile */}
              <div className="[&>div]:!hidden [&>div:nth-child(2)]:!grid [&>div:nth-child(2)]:!grid-cols-3 [&>div:nth-child(2)]:!gap-2 [&>div:nth-child(2)>div]:!py-1.5 [&>div:nth-child(2)>div]:!px-2 [&>div:nth-child(3)]:!hidden">
                <StatusDisplay />
              </div>
            </div>

            {/* Desktop: Original horizontal layout */}
            <div className="hidden lg:flex items-center justify-between gap-8">
              <StatusDisplay />
              <div className="flex-shrink-0">
                <HardwareStatusIndicator />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}