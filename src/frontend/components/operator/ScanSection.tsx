import { useState, useEffect, useRef } from 'react';
import { Scan, AlertCircle, Clock, CheckCircle } from 'lucide-react';

interface ScanSectionProps {
  onTicketFound: (ticket: any) => void;
  onPartnerTicketFound: (ticket: any) => void;
  onPensionCustomerFound: (customer: any) => void;
  onSwitchToEntry: () => void;
}

export default function ScanSection({ onTicketFound, onPartnerTicketFound, onPensionCustomerFound, onSwitchToEntry }: ScanSectionProps) {
  const [scannedCode, setScannedCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus scanner input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Clear success message after 3 seconds
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    // Clear error message after 5 seconds
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-submit when barcode scanner completes (detects rapid input)
  useEffect(() => {
    if (scannedCode.length >= 8) {
      const timer = setTimeout(() => {
        if (scannedCode.trim()) {
          handleScan();
        }
      }, 100); // Small delay to ensure complete scan
      return () => clearTimeout(timer);
    }
  }, [scannedCode]);

  const handleScan = async () => {
    if (!scannedCode.trim()) return;
    
    setIsScanning(true);
    setError('');
    setSuccess('');
    setLastScanTime(new Date());
    
    try {
      // Visual feedback - flash the input
      if (inputRef.current) {
        inputRef.current.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75');
        setTimeout(() => {
          inputRef.current?.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75');
        }, 300);
      }

      // First try to find regular parking ticket
      let response = await fetch(`/api/parking/tickets/lookup/${scannedCode}`);
      let result = await response.json();
      
      if (response.ok && result.data) {
        // Found regular ticket
        setSuccess('¡Boleto encontrado!');
        console.log('Found ticket data:', result.data);
        setTimeout(() => {
          onTicketFound(result.data);
        }, 500); // Brief delay for user feedback
        return;
      }
      
      // If not found, try partner ticket lookup
      response = await fetch(`/api/partner/tickets/lookup/${scannedCode}`);
      result = await response.json();
      
      if (response.ok && result.data) {
        // Found partner ticket
        setSuccess('¡Boleto de socio encontrado!');
        console.log('Found partner ticket data:', result.data);
        setTimeout(() => {
          onPartnerTicketFound(result.data);
        }, 500); // Brief delay for user feedback
        return;
      }
      
      // If not found, try pension customer lookup
      response = await fetch(`/api/pension/lookup/${scannedCode}`);
      result = await response.json();
      
      if (response.ok && result.data) {
        // Found pension customer
        setSuccess('¡Cliente de pensión encontrado!');
        console.log('Found pension customer:', result.data);
        setTimeout(() => {
          onPensionCustomerFound(result.data);
        }, 500); // Brief delay for user feedback
        return;
      }
      
      // Neither found
      const errorMessage = result.error?.message || result.message || 'Boleto o cliente de pensión no encontrado';
      setError(errorMessage);
      
      // Vibrate pattern for error (if supported)
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
    } catch (err) {
      setError('Error de conexión. Verifique la red.');
    } finally {
      setIsScanning(false);
      setTimeout(() => {
        setScannedCode('');
        inputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="mx-auto w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <Scan className="w-12 h-12 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Escanear Código de Barras
        </h2>
        <p className="text-gray-600">
          Apunte el escáner al código de barras del boleto
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={scannedCode}
            onChange={(e) => setScannedCode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && scannedCode.trim()) {
                handleScan();
              }
            }}
            className="scanner-input transition-all duration-300"
            placeholder="Escanee o ingrese código"
            autoFocus
            disabled={isScanning}
          />
          {isScanning && (
            <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          )}
          {scannedCode && !isScanning && (
            <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-blue-600">
              <span className="text-sm font-medium">Presione Enter</span>
            </div>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-4 text-green-600 bg-green-50 p-6 rounded-2xl text-lg animate-pulse">
            <CheckCircle className="w-8 h-8" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-4 text-red-600 bg-red-50 p-6 rounded-2xl text-lg">
            <AlertCircle className="w-8 h-8" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={handleScan}
            disabled={!scannedCode.trim() || isScanning}
            className="btn-primary btn-operator flex items-center justify-center gap-4"
          >
            <Scan className="w-8 h-8" />
            {isScanning ? 'Buscando...' : 'Buscar Boleto'}
          </button>
          
          <button
            onClick={onSwitchToEntry}
            className="btn-secondary btn-operator flex items-center justify-center gap-4"
          >
            <Clock className="w-8 h-8" />
            Nueva Entrada
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        <div className="text-sm text-gray-500">
          <p>💡 El escáner se conecta automáticamente cuando está disponible</p>
        </div>
        {lastScanTime && (
          <div className="text-xs text-gray-400">
            Último escaneo: {lastScanTime.toLocaleTimeString('es-MX')}
          </div>
        )}
      </div>
    </div>
  );
}