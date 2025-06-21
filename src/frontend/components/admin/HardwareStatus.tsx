import { useState, useEffect } from 'react';
import { Printer, Scan, Database, Wifi, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface HardwareStatus {
  printer: {
    status: 'online' | 'offline' | 'error';
    lastCheck: string;
    model: string;
    paperLevel: number;
    errorMessage?: string;
  };
  scanner: {
    status: 'online' | 'offline' | 'error';
    lastCheck: string;
    model: string;
    errorMessage?: string;
  };
  database: {
    status: 'online' | 'offline' | 'error';
    lastCheck: string;
    responseTime: number;
    connectionCount: number;
  };
  network: {
    status: 'online' | 'offline' | 'error';
    lastCheck: string;
    latency: number;
    quality: 'excellent' | 'good' | 'poor';
  };
}

export default function HardwareStatus() {
  const [status, setStatus] = useState<HardwareStatus>({
    printer: {
      status: 'offline',
      lastCheck: new Date().toISOString(),
      model: 'Epson TM-T20III',
      paperLevel: 0,
    },
    scanner: {
      status: 'offline',
      lastCheck: new Date().toISOString(),
      model: 'Honeywell Voyager 1250g',
    },
    database: {
      status: 'offline',
      lastCheck: new Date().toISOString(),
      responseTime: 0,
      connectionCount: 0,
    },
    network: {
      status: 'offline',
      lastCheck: new Date().toISOString(),
      latency: 0,
      quality: 'poor',
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchHardwareStatus();
    const interval = setInterval(fetchHardwareStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchHardwareStatus = async () => {
    try {
      const response = await fetch('/api/admin/hardware/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const hardwareData = await response.json();
        setStatus(hardwareData);
      }
    } catch (error) {
      console.error('Error fetching hardware status:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHardwareStatus();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return CheckCircle;
      case 'offline': return XCircle;
      case 'error': return AlertTriangle;
      default: return XCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'En Línea';
      case 'offline': return 'Desconectado';
      case 'error': return 'Error';
      default: return 'Desconocido';
    }
  };

  const getPaperLevelColor = (level: number) => {
    if (level >= 70) return 'bg-green-500';
    if (level >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Estado del Hardware</h3>
          <p className="text-sm text-gray-500">Monitoreo en tiempo real</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Verificar
        </button>
      </div>

      <div className="space-y-4">
        {/* Printer Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.printer.status)}`}>
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Impresora Térmica</div>
                <div className="text-sm text-gray-500">{status.printer.model}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                {React.createElement(getStatusIcon(status.printer.status), {
                  className: `w-4 h-4 ${getStatusColor(status.printer.status).split(' ')[0]}`,
                })}
                <span className="text-sm font-medium">{getStatusText(status.printer.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.printer.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.printer.status === 'online' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Nivel de Papel:</span>
                <span className="font-medium">{status.printer.paperLevel}%</span>
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getPaperLevelColor(status.printer.paperLevel)}`}
                  style={{ width: `${status.printer.paperLevel}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {status.printer.errorMessage && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
              {status.printer.errorMessage}
            </div>
          )}
        </div>

        {/* Scanner Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.scanner.status)}`}>
                <Scan className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Escáner de Códigos</div>
                <div className="text-sm text-gray-500">{status.scanner.model}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                {React.createElement(getStatusIcon(status.scanner.status), {
                  className: `w-4 h-4 ${getStatusColor(status.scanner.status).split(' ')[0]}`,
                })}
                <span className="text-sm font-medium">{getStatusText(status.scanner.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.scanner.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.scanner.errorMessage && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
              {status.scanner.errorMessage}
            </div>
          )}
        </div>

        {/* Database Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.database.status)}`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Base de Datos</div>
                <div className="text-sm text-gray-500">PostgreSQL</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                {React.createElement(getStatusIcon(status.database.status), {
                  className: `w-4 h-4 ${getStatusColor(status.database.status).split(' ')[0]}`,
                })}
                <span className="text-sm font-medium">{getStatusText(status.database.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.database.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.database.status === 'online' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Tiempo de Respuesta:</span>
                <div className="font-medium">{status.database.responseTime}ms</div>
              </div>
              <div>
                <span className="text-gray-600">Conexiones:</span>
                <div className="font-medium">{status.database.connectionCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* Network Status */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.network.status)}`}>
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Conectividad de Red</div>
                <div className="text-sm text-gray-500">Ethernet/WiFi</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                {React.createElement(getStatusIcon(status.network.status), {
                  className: `w-4 h-4 ${getStatusColor(status.network.status).split(' ')[0]}`,
                })}
                <span className="text-sm font-medium">{getStatusText(status.network.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.network.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.network.status === 'online' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Latencia:</span>
                <div className="font-medium">{status.network.latency}ms</div>
              </div>
              <div>
                <span className="text-gray-600">Calidad:</span>
                <div className={`font-medium capitalize ${getQualityColor(status.network.quality)}`}>
                  {status.network.quality === 'excellent' ? 'Excelente' : 
                   status.network.quality === 'good' ? 'Buena' : 'Deficiente'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}