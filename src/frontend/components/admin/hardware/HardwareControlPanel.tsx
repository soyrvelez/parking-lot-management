import React, { useState, useEffect } from 'react';
import { Monitor, Printer, Scan, Database, Wifi, AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap, Activity } from 'lucide-react';

interface HardwareStatus {
  printer: {
    status: 'online' | 'offline' | 'error' | 'warning';
    name: string;
    ipAddress: string;
    paperLevel: number;
    temperature: number;
    lastPrint: string;
    totalPrints: number;
    errorMessage?: string;
  };
  scanner: {
    status: 'online' | 'offline' | 'error' | 'warning';
    name: string;
    connection: string;
    lastScan: string;
    totalScans: number;
    scanRate: number;
    errorMessage?: string;
  };
  database: {
    status: 'online' | 'offline' | 'error' | 'warning';
    responseTime: number;
    connectionCount: number;
    uptime: string;
    lastBackup: string;
    diskUsage: number;
  };
  network: {
    status: 'online' | 'offline' | 'error' | 'warning';
    latency: number;
    bandwidth: number;
    uptime: string;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
  system: {
    cpu: number;
    memory: number;
    disk: number;
    temperature: number;
    uptime: string;
  };
}

export default function HardwareControlPanel() {
  const [status, setStatus] = useState<HardwareStatus>({
    printer: {
      status: 'offline',
      name: 'Epson TM-T20III',
      ipAddress: '192.168.1.100',
      paperLevel: 0,
      temperature: 0,
      lastPrint: '',
      totalPrints: 0,
    },
    scanner: {
      status: 'offline',
      name: 'Honeywell Voyager 1250g',
      connection: 'USB',
      lastScan: '',
      totalScans: 0,
      scanRate: 0,
    },
    database: {
      status: 'offline',
      responseTime: 0,
      connectionCount: 0,
      uptime: '',
      lastBackup: '',
      diskUsage: 0,
    },
    network: {
      status: 'offline',
      latency: 0,
      bandwidth: 0,
      uptime: '',
      quality: 'poor',
    },
    system: {
      cpu: 0,
      memory: 0,
      disk: 0,
      temperature: 0,
      uptime: '',
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchHardwareStatus();
    const interval = setInterval(fetchHardwareStatus, 5 * 60 * 1000); // Much less aggressive polling - every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchHardwareStatus = async () => {
    try {
      const response = await fetch('/api/admin/hardware/status-detailed', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
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

  const executeQuickAction = async (action: string, device: string) => {
    try {
      const response = await fetch('/api/admin/hardware/quick-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action, device }),
      });

      if (response.ok) {
        // Refresh status after action
        setTimeout(fetchHardwareStatus, 1000);
      }
    } catch (error) {
      console.error('Error executing quick action:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return CheckCircle;
      case 'offline': return XCircle;
      case 'error': return AlertTriangle;
      case 'warning': return AlertTriangle;
      default: return XCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Estado General del Hardware</h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">CPU</div>
              <div className="text-2xl font-bold text-gray-900">{status.system.cpu}%</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getUsageColor(status.system.cpu)}`}
              style={{ width: `${status.system.cpu}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Monitor className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Memoria</div>
              <div className="text-2xl font-bold text-gray-900">{status.system.memory}%</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getUsageColor(status.system.memory)}`}
              style={{ width: `${status.system.memory}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Disco</div>
              <div className="text-2xl font-bold text-gray-900">{status.system.disk}%</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${getUsageColor(status.system.disk)}`}
              style={{ width: `${status.system.disk}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Temperatura</div>
              <div className="text-2xl font-bold text-gray-900">{status.system.temperature}°C</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Uptime: {status.system.uptime}</div>
        </div>
      </div>

      {/* Hardware Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Printer Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.printer.status)}`}>
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{status.printer.name}</h4>
                <div className="text-sm text-gray-500">{status.printer.ipAddress}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {React.createElement(getStatusIcon(status.printer.status), {
                className: `w-5 h-5 ${getStatusColor(status.printer.status).split(' ')[0]}`,
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Nivel de Papel:</span>
              <span className="font-medium">{status.printer.paperLevel}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${status.printer.paperLevel > 20 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${status.printer.paperLevel}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Temperatura:</span>
                <div className="font-medium">{status.printer.temperature}°C</div>
              </div>
              <div>
                <span className="text-gray-600">Total Impresiones:</span>
                <div className="font-medium">{status.printer.totalPrints}</div>
              </div>
            </div>

            {status.printer.errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {status.printer.errorMessage}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => executeQuickAction('test_print', 'printer')}
                className="btn-secondary text-sm flex-1"
              >
                Imprimir Prueba
              </button>
              <button
                onClick={() => executeQuickAction('reset', 'printer')}
                className="btn-secondary text-sm flex-1"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>

        {/* Scanner Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.scanner.status)}`}>
                <Scan className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{status.scanner.name}</h4>
                <div className="text-sm text-gray-500">{status.scanner.connection}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {React.createElement(getStatusIcon(status.scanner.status), {
                className: `w-5 h-5 ${getStatusColor(status.scanner.status).split(' ')[0]}`,
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Tasa de Escaneo:</span>
                <div className="font-medium">{status.scanner.scanRate}/min</div>
              </div>
              <div>
                <span className="text-gray-600">Total Escaneos:</span>
                <div className="font-medium">{status.scanner.totalScans}</div>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-gray-600">Último Escaneo:</span>
              <div className="font-medium">{status.scanner.lastScan || 'Nunca'}</div>
            </div>

            {status.scanner.errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {status.scanner.errorMessage}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => executeQuickAction('test_scan', 'scanner')}
                className="btn-secondary text-sm flex-1"
              >
                Probar Escaneo
              </button>
              <button
                onClick={() => executeQuickAction('calibrate', 'scanner')}
                className="btn-secondary text-sm flex-1"
              >
                Calibrar
              </button>
            </div>
          </div>
        </div>

        {/* Database Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.database.status)}`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Base de Datos</h4>
                <div className="text-sm text-gray-500">PostgreSQL</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {React.createElement(getStatusIcon(status.database.status), {
                className: `w-5 h-5 ${getStatusColor(status.database.status).split(' ')[0]}`,
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Tiempo Respuesta:</span>
                <div className="font-medium">{status.database.responseTime}ms</div>
              </div>
              <div>
                <span className="text-gray-600">Conexiones:</span>
                <div className="font-medium">{status.database.connectionCount}</div>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-gray-600">Uso de Disco:</span>
              <div className="font-medium">{status.database.diskUsage}%</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${getUsageColor(status.database.diskUsage)}`}
                style={{ width: `${status.database.diskUsage}%` }}
              ></div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => executeQuickAction('backup', 'database')}
                className="btn-secondary text-sm flex-1"
              >
                Crear Respaldo
              </button>
              <button
                onClick={() => executeQuickAction('optimize', 'database')}
                className="btn-secondary text-sm flex-1"
              >
                Optimizar
              </button>
            </div>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(status.network.status)}`}>
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Red</h4>
                <div className="text-sm text-gray-500">Conectividad</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {React.createElement(getStatusIcon(status.network.status), {
                className: `w-5 h-5 ${getStatusColor(status.network.status).split(' ')[0]}`,
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Latencia:</span>
                <div className="font-medium">{status.network.latency}ms</div>
              </div>
              <div>
                <span className="text-gray-600">Ancho de Banda:</span>
                <div className="font-medium">{status.network.bandwidth} Mbps</div>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-gray-600">Calidad:</span>
              <div className={`font-medium capitalize ${
                status.network.quality === 'excellent' ? 'text-green-600' :
                status.network.quality === 'good' ? 'text-blue-600' :
                status.network.quality === 'fair' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {status.network.quality === 'excellent' ? 'Excelente' :
                 status.network.quality === 'good' ? 'Buena' :
                 status.network.quality === 'fair' ? 'Regular' : 'Deficiente'}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => executeQuickAction('ping_test', 'network')}
                className="btn-secondary text-sm flex-1"
              >
                Probar Ping
              </button>
              <button
                onClick={() => executeQuickAction('speed_test', 'network')}
                className="btn-secondary text-sm flex-1"
              >
                Test Velocidad
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h4 className="font-medium text-gray-900 mb-4">Acciones Rápidas del Sistema</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => executeQuickAction('restart_services', 'system')}
            className="btn-secondary flex items-center gap-2 justify-center"
          >
            <RefreshCw className="w-4 h-4" />
            Reiniciar Servicios
          </button>
          <button
            onClick={() => executeQuickAction('clear_cache', 'system')}
            className="btn-secondary flex items-center gap-2 justify-center"
          >
            <Database className="w-4 h-4" />
            Limpiar Caché
          </button>
          <button
            onClick={() => executeQuickAction('full_diagnostic', 'system')}
            className="btn-primary flex items-center gap-2 justify-center"
          >
            <Activity className="w-4 h-4" />
            Diagnóstico Completo
          </button>
        </div>
      </div>
    </div>
  );
}