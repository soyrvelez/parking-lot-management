import { useState, useEffect } from 'react';
import { Printer, Scan, Database, Wifi, WifiOff } from 'lucide-react';
import { HardwareHealth } from '../../../shared/types/hardware';

export default function HardwareStatusIndicator() {
  const [hardwareStatus, setHardwareStatus] = useState<HardwareHealth | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check hardware status immediately and then every 30 seconds
    checkHardwareStatus();
    const interval = setInterval(checkHardwareStatus, 30000);

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkHardwareStatus = async () => {
    try {
      const response = await fetch('/api/hardware/status');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHardwareStatus(result.data);
        }
      }
    } catch (error) {
      console.error('Error checking hardware status:', error);
    }
  };

  const getStatusColor = (connected: boolean) => {
    return connected ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusText = (connected: boolean) => {
    return connected ? 'Conectado' : 'Desconectado';
  };

  const getPrinterStatus = () => {
    if (!hardwareStatus) return { color: 'bg-gray-400', text: 'Verificando...' };
    
    const { printer } = hardwareStatus;
    if (!printer.connected) {
      return { color: 'bg-red-500', text: 'Desconectada' };
    }
    if (printer.paperStatus === 'LOW') {
      return { color: 'bg-yellow-500', text: 'Papel bajo' };
    }
    if (printer.paperStatus === 'OUT') {
      return { color: 'bg-red-500', text: 'Sin papel' };
    }
    return { color: 'bg-green-500', text: 'Lista' };
  };

  const getScannerStatus = () => {
    if (!hardwareStatus) return { color: 'bg-gray-400', text: 'Verificando...' };
    
    const { scanner } = hardwareStatus;
    if (!scanner.connected) {
      return { color: 'bg-red-500', text: 'Desconectado' };
    }
    if (!scanner.ready) {
      return { color: 'bg-yellow-500', text: 'Preparando...' };
    }
    return { color: 'bg-green-500', text: 'Listo' };
  };

  const printerStatus = getPrinterStatus();
  const scannerStatus = getScannerStatus();

  return (
    <div className="flex items-center space-x-4 text-xs">
      {/* Network Status */}
      <div className="flex items-center gap-1.5">
        {isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-600" />
        )}
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-gray-600">Red</span>
      </div>

      {/* Printer Status */}
      <div className="flex items-center gap-1.5">
        <Printer className="w-3.5 h-3.5 text-gray-600" />
        <div className={`w-2 h-2 rounded-full ${printerStatus.color}`}></div>
        <span className="text-gray-600">Impresora</span>
      </div>

      {/* Scanner Status */}
      <div className="flex items-center gap-1.5">
        <Scan className="w-3.5 h-3.5 text-gray-600" />
        <div className={`w-2 h-2 rounded-full ${scannerStatus.color}`}></div>
        <span className="text-gray-600">Escáner</span>
      </div>

      {/* Database Status */}
      <div className="flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5 text-gray-600" />
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-gray-600">BD</span>
      </div>
    </div>
  );
}