import React, { useState, useRef, useEffect } from 'react';
import { 
  DollarSign, 
  Search, 
  Car, 
  Scan, 
  AlertCircle, 
  CheckCircle,
  Building2,
  FileX,
  ArrowLeft
} from 'lucide-react';
import PaymentSection, { LostTicketSection } from './PaymentSection';
import PartnerPaymentSection from './PartnerPaymentSection';

interface UnifiedPaymentSectionProps {
  onPaymentComplete: (paymentData: any) => void;
  onBack: () => void;
}

type SearchType = 'ticket' | 'plate';
type TicketType = 'regular' | 'partner' | 'lost' | null;

export default function UnifiedPaymentSection({ 
  onPaymentComplete, 
  onBack 
}: UnifiedPaymentSectionProps) {
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('ticket');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [ticketType, setTicketType] = useState<TicketType>(null);
  const [ticketData, setTicketData] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('Ingrese un número de boleto o placa');
      return;
    }

    setIsSearching(true);
    setError('');
    setTicketData(null);
    setTicketType(null);

    try {
      if (searchType === 'ticket') {
        // Search by ticket number/barcode
        // First try regular ticket
        let response = await fetch(`/api/parking/tickets/lookup/${searchValue}`);
        let result = await response.json();
        
        if (response.ok && result.data) {
          setTicketType('regular');
          setTicketData(result.data);
          return;
        }

        // Try partner ticket
        response = await fetch(`/api/partner/tickets/lookup/${searchValue}`);
        result = await response.json();
        
        if (response.ok && result.data) {
          setTicketType('partner');
          setTicketData(result.data);
          return;
        }
      } else {
        // Search by plate number
        // First try regular tickets
        let response = await fetch(`/api/parking/tickets/by-plate/${searchValue}`);
        let result = await response.json();
        
        if (response.ok && result.data && result.data.length > 0) {
          // Show the most recent unpaid ticket
          const unpaidTicket = result.data.find((t: any) => t.status !== 'PAID') || result.data[0];
          setTicketType('regular');
          setTicketData(unpaidTicket);
          return;
        }

        // Try partner tickets
        response = await fetch(`/api/partner/tickets/by-plate/${searchValue}`);
        result = await response.json();
        
        if (response.ok && result.data && result.data.length > 0) {
          // Show the most recent unpaid partner ticket
          const unpaidTicket = result.data.find((t: any) => t.paymentStatus !== 'PAID') || result.data[0];
          setTicketType('partner');
          setTicketData(unpaidTicket);
          return;
        }
      }

      // If nothing found, assume it's a lost ticket
      setTicketType('lost');
      setTicketData({ plateNumber: searchType === 'plate' ? searchValue : '' });

    } catch (err) {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      handleSearch();
    }
  };

  // If we have found a ticket, show the appropriate payment section
  if (ticketType && ticketData) {
    if (ticketType === 'regular') {
      return (
        <PaymentSection 
          ticket={ticketData}
          onPaymentComplete={onPaymentComplete}
          onBack={() => {
            setTicketType(null);
            setTicketData(null);
            setSearchValue('');
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
        />
      );
    }

    if (ticketType === 'partner') {
      return (
        <PartnerPaymentSection 
          partnerTicket={ticketData}
          onPaymentComplete={onPaymentComplete}
          onBack={() => {
            setTicketType(null);
            setTicketData(null);
            setSearchValue('');
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
        />
      );
    }

    if (ticketType === 'lost') {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => {
                setTicketType(null);
                setTicketData(null);
                setSearchValue('');
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Regresar a búsqueda</span>
            </button>
          </div>
          <LostTicketSection 
            onSuccess={onPaymentComplete}
            onError={(error) => {
              console.error('Lost ticket error:', error);
            }}
            initialPlateNumber={ticketData.plateNumber}
          />
        </div>
      );
    }
  }

  // Show search interface
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Cobrar Estacionamiento
          </h2>
          <p className="text-lg text-gray-600">
            Busque el boleto por código o placa del vehículo
          </p>
        </div>

        {/* Search Type Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => {
                setSearchType('ticket');
                setSearchValue('');
                setError('');
                inputRef.current?.focus();
              }}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                searchType === 'ticket'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4" />
                <span>Boleto</span>
              </div>
            </button>
            <button
              onClick={() => {
                setSearchType('plate');
                setSearchValue('');
                setError('');
                inputRef.current?.focus();
              }}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                searchType === 'plate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                <span>Placa</span>
              </div>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder={searchType === 'ticket' 
              ? 'Escanee o ingrese número de boleto' 
              : 'Ingrese placa del vehículo'
            }
            className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase"
            disabled={isSearching}
            autoFocus
          />
          <button
            onClick={handleSearch}
            disabled={!searchValue.trim() || isSearching}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900">Boleto Regular</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Tarifa estándar por tiempo
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900">Boleto de Socio</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Verifica sello del negocio
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <FileX className="w-5 h-5 text-orange-600 mt-1" />
              <div>
                <h4 className="font-semibold text-gray-900">Boleto Perdido</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Tarifa fija establecida
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>💡 Tip: Use el escáner de código de barras para búsqueda rápida</p>
        </div>
      </div>
    </div>
  );
}