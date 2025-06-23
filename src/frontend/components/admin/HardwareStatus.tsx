import React, { useState, useEffect } from 'react';
import { i18n } from '../../../shared/localization';
import { Printer, Scan, Database, Wifi, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

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
  const { authenticatedFetch } = useAdminAuth();
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
    const interval = setInterval(fetchHardwareStatus, 3 * 60 * 1000); // Much less aggressive polling - every 3 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchHardwareStatus = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/hardware/status');

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Transform the API response to match our interface
          const transformedStatus: HardwareStatus = {
            printer: {
              status: result.data.printer?.status === 'connected' ? 'online' : 'offline',
              lastCheck: new Date().toISOString(),
              model: result.data.printer?.model || 'Epson TM-T20III',
              paperLevel: result.data.printer?.status === 'connected' ? 75 : 0,
              errorMessage: result.data.printer?.status !== 'connected' ? result.data.printer?.description : undefined,
            },
            scanner: {
              status: result.data.scanner?.status === 'connected' ? 'online' : 'offline', 
              lastCheck: new Date().toISOString(),
              model: result.data.scanner?.model || 'Honeywell Voyager 1250g',
              errorMessage: result.data.scanner?.status !== 'connected' ? result.data.scanner?.description : undefined,
            },
            database: {
              status: result.data.database?.status === 'connected' ? 'online' : 'offline',
              lastCheck: new Date().toISOString(),
              responseTime: parseInt(result.data.database?.responseTime?.replace('ms', '') || '0'),
              connectionCount: result.data.database?.connectionCount || 0,
            },
            network: {
              status: result.data.network?.status === 'connected' ? 'online' : 'offline',
              lastCheck: new Date().toISOString(),
              latency: result.data.network?.latency === 'low' ? 15 : result.data.network?.latency === 'medium' ? 50 : 100,
              quality: result.data.network?.quality === 'excellent' ? 'excellent' : 
                       result.data.network?.quality === 'good' ? 'good' : 'poor',
            },
          };
          setStatus(transformedStatus);
        }
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
      case 'online': return i18n.t('hardware.status_online');
      case 'offline': return i18n.t('hardware.status_offline');
      case 'error': return i18n.t('hardware.status_error');
      default: return i18n.t('hardware.status_unknown');
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
      <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-2/3 mb-3 sm:mb-4"></div>
          <div className="space-y-3 sm:space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 sm:h-16 lg:h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{i18n.t('admin.hardware_status')}</h3>
          <p className="text-xs sm:text-sm text-gray-500 truncate">{i18n.t('admin.real_time_monitoring')}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 flex-shrink-0"
        >
          <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{i18n.t('actions.refresh')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Printer Status */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(status.printer.status)}`}>
                <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{i18n.t('hardware.thermal_printer')}</div>
                <div className="text-xs sm:text-sm text-gray-500 truncate">{status.printer.model}</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2">
                {React.createElement(getStatusIcon(status.printer.status), {
                  className: `w-3 h-3 sm:w-4 sm:h-4 ${getStatusColor(status.printer.status).split(' ')[0]}`,
                })}
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">{getStatusText(status.printer.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.printer.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.printer.status === 'online' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-600">{i18n.t('hardware.paper_level')}:</span>
                <span className="font-medium">{status.printer.paperLevel}%</span>
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                <div 
                  className={`h-1.5 sm:h-2 rounded-full ${getPaperLevelColor(status.printer.paperLevel)}`}
                  style={{ width: `${status.printer.paperLevel}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {status.printer.errorMessage && (
            <div className="mt-3 text-xs sm:text-sm text-red-600 bg-red-50 p-2 rounded">
              {status.printer.errorMessage}
            </div>
          )}
        </div>

        {/* Scanner Status */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(status.scanner.status)}`}>
                <Scan className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm sm:text-base truncate">Escáner de Códigos</div>
                <div className="text-xs sm:text-sm text-gray-500 truncate">{status.scanner.model}</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2">
                {React.createElement(getStatusIcon(status.scanner.status), {
                  className: `w-3 h-3 sm:w-4 sm:h-4 ${getStatusColor(status.scanner.status).split(' ')[0]}`,
                })}
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">{getStatusText(status.scanner.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.scanner.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.scanner.errorMessage && (
            <div className="mt-3 text-xs sm:text-sm text-red-600 bg-red-50 p-2 rounded">
              {status.scanner.errorMessage}
            </div>
          )}
        </div>

        {/* Database Status */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(status.database.status)}`}>
                <Database className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm sm:text-base truncate">Base de Datos</div>
                <div className="text-xs sm:text-sm text-gray-500 truncate">PostgreSQL</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2">
                {React.createElement(getStatusIcon(status.database.status), {
                  className: `w-3 h-3 sm:w-4 sm:h-4 ${getStatusColor(status.database.status).split(' ')[0]}`,
                })}
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">{getStatusText(status.database.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.database.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.database.status === 'online' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
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
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(status.network.status)}`}>
                <Wifi className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm sm:text-base truncate">Conectividad de Red</div>
                <div className="text-xs sm:text-sm text-gray-500 truncate">Ethernet/WiFi</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2">
                {React.createElement(getStatusIcon(status.network.status), {
                  className: `w-3 h-3 sm:w-4 sm:h-4 ${getStatusColor(status.network.status).split(' ')[0]}`,
                })}
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">{getStatusText(status.network.status)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(status.network.lastCheck).toLocaleTimeString('es-MX')}
              </div>
            </div>
          </div>
          
          {status.network.status === 'online' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
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