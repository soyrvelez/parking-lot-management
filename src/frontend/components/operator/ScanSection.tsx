import { useState, useEffect } from 'react';
import { Scan, AlertCircle, Clock } from 'lucide-react';

interface ScanSectionProps {
  onTicketFound: (ticket: any) => void;
  onSwitchToEntry: () => void;
}

export default function ScanSection({ onTicketFound, onSwitchToEntry }: ScanSectionProps) {
  const [scannedCode, setScannedCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && scannedCode) {
        handleScan();
      } else if (event.key.length === 1) {
        setScannedCode(prev => prev + event.key);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [scannedCode]);

  const handleScan = async () => {
    if (!scannedCode.trim()) return;
    
    setIsScanning(true);
    setError('');
    
    try {
      const response = await fetch(`/api/tickets/lookup/${scannedCode}`);
      const ticket = await response.json();
      
      if (response.ok) {
        onTicketFound(ticket);
      } else {
        setError(ticket.error || 'Boleto no encontrado');
      }
    } catch (err) {
      setError('Error de conexión. Verifique la red.');
    } finally {
      setIsScanning(false);
      setScannedCode('');
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

      <div className="max-w-md mx-auto space-y-4">
        <div className="relative">
          <input
            type="text"
            value={scannedCode}
            onChange={(e) => setScannedCode(e.target.value)}
            className="input-field text-center text-lg font-mono"
            placeholder="Código del boleto"
            autoFocus
            disabled={isScanning}
          />
          {isScanning && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleScan}
            disabled={!scannedCode.trim() || isScanning}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Scan className="w-5 h-5" />
            {isScanning ? 'Buscando...' : 'Buscar Boleto'}
          </button>
          
          <button
            onClick={onSwitchToEntry}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Clock className="w-5 h-5" />
            Nueva Entrada
          </button>
        </div>
      </div>

      <div className="mt-8 text-sm text-gray-500">
        <p>💡 El escáner se conecta automáticamente cuando está disponible</p>
      </div>
    </div>
  );
}