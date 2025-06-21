import { useState, useEffect } from 'react';
import { Cog, Printer, Scan, Database, Wifi, TestTube, AlertCircle, CheckCircle } from 'lucide-react';

interface SystemConfig {
  printerIP: string;
  printerPort: number;
  scannerPort: string;
  databaseUrl: string;
  backupEnabled: boolean;
  maintenanceMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export default function SystemSettings() {
  const [config, setConfig] = useState<SystemConfig>({
    printerIP: '192.168.1.100',
    printerPort: 9100,
    scannerPort: 'COM3',
    databaseUrl: 'postgresql://localhost:5432/parking_lot',
    backupEnabled: true,
    maintenanceMode: false,
    logLevel: 'info',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<{
    printer?: 'success' | 'error';
    scanner?: 'success' | 'error';
    database?: 'success' | 'error';
  }>({});

  useEffect(() => {
    fetchSystemConfig();
  }, []);

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/admin/config/system', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching system config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testHardware = async (type: 'printer' | 'scanner' | 'database') => {
    try {
      const response = await fetch(`/api/admin/hardware/test/${type}`, {
        method: 'POST',
        credentials: 'include',
      });

      setTestResults(prev => ({
        ...prev,
        [type]: response.ok ? 'success' : 'error',
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [type]: 'error',
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hardware Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2 mb-6">
          <Cog className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Configuración de Hardware</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Printer Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Printer className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-gray-900">Impresora Térmica</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección IP
              </label>
              <input
                type="text"
                value={config.printerIP}
                onChange={(e) => setConfig(prev => ({ ...prev, printerIP: e.target.value }))}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Puerto
              </label>
              <input
                type="number"
                value={config.printerPort}
                onChange={(e) => setConfig(prev => ({ ...prev, printerPort: parseInt(e.target.value) }))}
                className="input-field"
              />
            </div>

            <button
              onClick={() => testHardware('printer')}
              className="btn-secondary flex items-center gap-2 w-full"
            >
              <TestTube className="w-4 h-4" />
              Probar Conexión
              {testResults.printer && (
                testResults.printer === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )
              )}
            </button>
          </div>

          {/* Scanner Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Scan className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-gray-900">Escáner de Código de Barras</h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Puerto/Dispositivo
              </label>
              <select
                value={config.scannerPort}
                onChange={(e) => setConfig(prev => ({ ...prev, scannerPort: e.target.value }))}
                className="input-field"
              >
                <option value="USB">USB (Automático)</option>
                <option value="COM3">COM3 (Windows)</option>
                <option value="/dev/ttyUSB0">/dev/ttyUSB0 (Linux)</option>
                <option value="bluetooth">Bluetooth</option>
              </select>
            </div>

            <button
              onClick={() => testHardware('scanner')}
              className="btn-secondary flex items-center gap-2 w-full"
            >
              <TestTube className="w-4 h-4" />
              Probar Escáner
              {testResults.scanner && (
                testResults.scanner === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )
              )}
            </button>
          </div>
        </div>
      </div>

      {/* System Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-2 mb-6">
          <Database className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Configuración del Sistema</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL de Base de Datos
              </label>
              <input
                type="text"
                value={config.databaseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, databaseUrl: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder="postgresql://user:pass@host:port/database"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nivel de Registro
              </label>
              <select
                value={config.logLevel}
                onChange={(e) => setConfig(prev => ({ ...prev, logLevel: e.target.value as any }))}
                className="input-field"
              >
                <option value="error">Error</option>
                <option value="warn">Advertencia</option>
                <option value="info">Información</option>
                <option value="debug">Debug</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">Respaldo Automático</div>
                <div className="text-sm text-gray-500">Crear respaldos diarios de la base de datos</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.backupEnabled}
                  onChange={(e) => setConfig(prev => ({ ...prev, backupEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div>
                <div className="font-medium text-yellow-900">Modo Mantenimiento</div>
                <div className="text-sm text-yellow-700">Bloquear acceso a operadores</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.maintenanceMode}
                  onChange={(e) => setConfig(prev => ({ ...prev, maintenanceMode: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>

            <button
              onClick={() => testHardware('database')}
              className="btn-secondary flex items-center gap-2 w-full"
            >
              <Database className="w-4 h-4" />
              Probar Base de Datos
              {testResults.database && (
                testResults.database === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )
              )}
            </button>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado del Sistema</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-700">Tiempo de Actividad</div>
            <div className="text-2xl font-bold text-green-900">72h 45m</div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-700">Uso de Memoria</div>
            <div className="text-2xl font-bold text-blue-900">245 MB</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-700">Transacciones/día</div>
            <div className="text-2xl font-bold text-purple-900">127</div>
          </div>
        </div>
      </div>
    </div>
  );
}