import { useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, Download } from 'lucide-react';

export default function SystemDiagnostics() {
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  const runDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    
    setTimeout(() => {
      setIsRunningDiagnostic(false);
    }, 5000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Diagnósticos del Sistema</h3>
        </div>

        <div className="space-y-6">
          <button
            onClick={runDiagnostic}
            disabled={isRunningDiagnostic}
            className="btn-primary w-full flex items-center gap-2 justify-center"
          >
            {isRunningDiagnostic ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Ejecutando Diagnóstico...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Ejecutar Diagnóstico Completo
              </>
            )}
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Estado de Componentes</h4>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Sistema operativo funcional</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Base de datos conectada</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Memoria al 75% de uso</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Acciones</h4>
              
              <button className="btn-secondary w-full flex items-center gap-2 justify-center">
                <Download className="w-4 h-4" />
                Descargar Reporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}