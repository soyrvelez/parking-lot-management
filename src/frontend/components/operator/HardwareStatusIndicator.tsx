import { useState, useEffect } from 'react';
import { Printer, Scan, Database, Wifi, WifiOff } from 'lucide-react';
import { HardwareHealth } from '../../../shared/types/hardware';
import { i18n } from '../../../shared/localization';

export default function HardwareStatusIndicator() {
  const [hardwareStatus, setHardwareStatus] = useState<HardwareHealth | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check hardware status immediately and then every 30 seconds
    checkHardwareStatus();
    const interval = setInterval(checkHardwareStatus, 3 * 60 * 1000); // Less aggressive - every 3 minutes

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
    return connected ? i18n.t('hardware.status_connected') : i18n.t('hardware.status_disconnected');
  };

  const getPrinterStatus = () => {
    if (!hardwareStatus) return { color: 'bg-gray-400', text: i18n.t('status.processing') };
    
    const { printer } = hardwareStatus;
    if (!printer.connected) {
      return { color: 'bg-red-500', text: i18n.t('hardware.printer_disconnected') };
    }
    if (printer.paperStatus === 'LOW') {
      return { color: 'bg-yellow-500', text: i18n.t('hardware.paper_status_low') };
    }
    if (printer.paperStatus === 'OUT') {
      return { color: 'bg-red-500', text: i18n.t('hardware.paper_status_empty') };
    }
    return { color: 'bg-green-500', text: i18n.t('hardware.status_ready') };
  };

  const getScannerStatus = () => {
    if (!hardwareStatus) return { color: 'bg-gray-400', text: i18n.t('status.processing') };
    
    const { scanner } = hardwareStatus;
    if (!scanner.connected) {
      return { color: 'bg-red-500', text: i18n.t('hardware.scanner_error') };
    }
    if (!scanner.ready) {
      return { color: 'bg-yellow-500', text: i18n.t('status.processing') };
    }
    return { color: 'bg-green-500', text: i18n.t('hardware.scanner_ready') };
  };

  const printerStatus = getPrinterStatus();
  const scannerStatus = getScannerStatus();

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
      {/* Network Status */}
      <div className="flex items-center gap-1 sm:gap-1.5 touch-manipulation">
        {isOnline ? (
          <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-green-600 flex-shrink-0" />
        ) : (
          <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-red-600 flex-shrink-0" />
        )}
        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} flex-shrink-0`}></div>
        <span className="text-gray-600 font-medium hidden sm:inline">Red</span>
        <span className="text-gray-600 font-medium sm:hidden">R</span>
      </div>

      {/* Printer Status */}
      <div className="flex items-center gap-1 sm:gap-1.5 touch-manipulation">
        <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600 flex-shrink-0" />
        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${printerStatus.color} flex-shrink-0`}></div>
        <span className="text-gray-600 font-medium hidden sm:inline">Impresora</span>
        <span className="text-gray-600 font-medium sm:hidden">I</span>
      </div>

      {/* Scanner Status */}
      <div className="flex items-center gap-1 sm:gap-1.5 touch-manipulation">
        <Scan className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600 flex-shrink-0" />
        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${scannerStatus.color} flex-shrink-0`}></div>
        <span className="text-gray-600 font-medium hidden sm:inline">Escáner</span>
        <span className="text-gray-600 font-medium sm:hidden">E</span>
      </div>

      {/* Database Status */}
      <div className="flex items-center gap-1 sm:gap-1.5 touch-manipulation">
        <Database className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600 flex-shrink-0" />
        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} flex-shrink-0`}></div>
        <span className="text-gray-600 font-medium hidden sm:inline">BD</span>
        <span className="text-gray-600 font-medium sm:hidden">B</span>
      </div>
    </div>
  );
}