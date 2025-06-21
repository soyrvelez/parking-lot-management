import { useState, useEffect } from 'react';
import { Search, AlertCircle, Users, Scan } from 'lucide-react';

interface PensionLookupProps {
  onCustomerFound: (customer: any) => void;
}

export default function PensionLookup({ onCustomerFound }: PensionLookupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [lastSearchTime, setLastSearchTime] = useState(0);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchCustomers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchCustomers = async () => {
    const now = Date.now();
    setLastSearchTime(now);
    setIsSearching(true);
    setError('');

    try {
      const response = await fetch(`/api/pension/search/${encodeURIComponent(searchQuery)}`);
      const result = await response.json();

      // Only update if this is the most recent search
      if (now === lastSearchTime) {
        if (response.ok) {
          setSearchResults(result.data || []);
        } else {
          setError(result.error?.message || 'Error al buscar clientes');
          setSearchResults([]);
        }
      }
    } catch (err) {
      if (now === lastSearchTime) {
        setError('Error de conexión. Verifique la red.');
        setSearchResults([]);
      }
    } finally {
      if (now === lastSearchTime) {
        setIsSearching(false);
      }
    }
  };

  const handleExactLookup = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');

    try {
      const response = await fetch(`/api/pension/lookup/${encodeURIComponent(searchQuery.trim())}`);
      const result = await response.json();

      if (response.ok && result.data) {
        onCustomerFound(result.data);
      } else {
        setError(result.error?.message || 'Cliente no encontrado');
      }
    } catch (err) {
      setError('Error de conexión. Verifique la red.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExactLookup();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'EXPIRING_SOON':
        return 'bg-yellow-100 text-yellow-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'EXPIRING_SOON':
        return 'Por Vencer';
      case 'EXPIRED':
        return 'Vencido';
      default:
        return 'Inactivo';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Users className="w-12 h-12 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Buscar Cliente de Pensión
        </h3>
        <p className="text-gray-600">
          Ingrese número de placa o nombre del cliente
        </p>
      </div>

      {/* Search Input */}
      <div className="max-w-md mx-auto space-y-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            className="input-field text-center text-lg font-mono pr-12"
            placeholder="ABC-123 o nombre"
            autoFocus
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleExactLookup}
            disabled={!searchQuery.trim() || isSearching}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5" />
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="max-w-2xl mx-auto">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Resultados de Búsqueda ({searchResults.length})
          </h4>
          
          <div className="space-y-3">
            {searchResults.map((customer) => (
              <div
                key={customer.id}
                onClick={() => onCustomerFound(customer)}
                className="card hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-500"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg">
                        {customer.plateNumber}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                        {getStatusText(customer.status)}
                      </span>
                    </div>
                    
                    <div className="text-gray-900 font-medium">
                      {customer.name}
                    </div>
                    
                    {customer.vehicleMake && (
                      <div className="text-gray-600 text-sm">
                        {customer.vehicleMake} {customer.vehicleModel}
                      </div>
                    )}
                    
                    <div className="text-gray-600 text-sm">
                      Válido hasta: {new Date(customer.endDate).toLocaleDateString('es-MX')}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      ${customer.monthlyRate.toFixed(2)} MXN
                    </div>
                    <div className={`text-sm font-medium ${
                      customer.daysRemaining > 7 ? 'text-green-600' :
                      customer.daysRemaining > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {customer.daysRemaining} días restantes
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="max-w-md mx-auto text-center text-sm text-gray-500 space-y-1">
        <p>💡 Busque por número de placa (ABC-123) o nombre del cliente</p>
        <p>⚡ También puede escanear el código de barras de la pensión</p>
        <p>🔍 Aparecerán sugerencias mientras escribe</p>
      </div>
    </div>
  );
}