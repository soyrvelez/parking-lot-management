import { useState } from 'react';
import { Scan, TestTube, Settings, Activity } from 'lucide-react';

export default function ScannerControls() {
  const [isTestScanning, setIsTestScanning] = useState(false);

  const handleTestScan = async () => {
    setIsTestScanning(true);
    
    setTimeout(() => {
      setIsTestScanning(false);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3 mb-6">
          <Scan className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Control de Escáner</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Pruebas de Escaneo</h4>
            
            <button
              onClick={handleTestScan}
              disabled={isTestScanning}
              className="btn-primary w-full flex items-center gap-2 justify-center"
            >
              {isTestScanning ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Probando Escáner...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4" />
                  Probar Escáner
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Configuración</h4>
            <div className="space-y-3">
              <button className="btn-secondary w-full flex items-center gap-2 justify-center">
                <Settings className="w-4 h-4" />
                Configurar Escáner
              </button>
              <button className="btn-secondary w-full flex items-center gap-2 justify-center">
                <Activity className="w-4 h-4" />
                Calibrar Dispositivo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}