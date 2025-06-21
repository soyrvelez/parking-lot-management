import { useState } from 'react';
import { Printer, TestTube, Settings, FileText, AlertCircle } from 'lucide-react';

export default function PrinterControls() {
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/hardware/printer/test', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch (error) {
      setTestResult('error');
    } finally {
      setIsTestPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3 mb-6">
          <Printer className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Control de Impresora Térmica</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Pruebas de Impresión</h4>
            
            <button
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              className="btn-primary w-full flex items-center gap-2 justify-center"
            >
              {isTestPrinting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Imprimiendo...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4" />
                  Imprimir Prueba
                </>
              )}
            </button>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {testResult === 'success' ? (
                  <>
                    <TestTube className="w-4 h-4" />
                    Impresión de prueba exitosa
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Error en la impresión de prueba
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Configuración</h4>
            <div className="space-y-3">
              <button className="btn-secondary w-full flex items-center gap-2 justify-center">
                <Settings className="w-4 h-4" />
                Configurar Impresora
              </button>
              <button className="btn-secondary w-full flex items-center gap-2 justify-center">
                <FileText className="w-4 h-4" />
                Ver Registro de Impresión
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}