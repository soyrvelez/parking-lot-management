import { useState } from 'react';
import { Download, FileText, Shield, Calendar, CheckCircle, AlertCircle, Database } from 'lucide-react';

interface AuditExportProps {
  filters: {
    startDate: string;
    endDate: string;
    level: string;
    category: string;
    userId: string;
    search: string;
  };
}

export default function AuditExport({ filters }: AuditExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{
    type: string;
    timestamp: string;
    status: 'success' | 'error';
    message?: string;
  } | null>(null);

  const handleExport = async (exportType: 'csv' | 'pdf' | 'json', reportScope: 'filtered' | 'security' | 'compliance') => {
    setIsExporting(true);
    setLastExport(null);

    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        level: filters.level,
        category: filters.category,
        userId: filters.userId,
        search: filters.search,
        exportType,
        reportScope,
      });

      const response = await fetch(`/api/admin/audit/export?${queryParams}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with current date and filters
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `auditoria-${reportScope}-${dateStr}.${exportType}`;
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setLastExport({
          type: `${reportScope} (${exportType.toUpperCase()})`,
          timestamp: new Date().toISOString(),
          status: 'success',
        });
      } else {
        const error = await response.json();
        setLastExport({
          type: `${reportScope} (${exportType.toUpperCase()})`,
          timestamp: new Date().toISOString(),
          status: 'error',
          message: error.error || 'Error desconocido',
        });
      }
    } catch (error) {
      console.error('Error exporting audit report:', error);
      setLastExport({
        type: `${reportScope} (${exportType.toUpperCase()})`,
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Error de conexión',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      id: 'filtered-logs',
      title: 'Eventos Filtrados',
      description: 'Exportar eventos según filtros actuales',
      icon: Database,
      scope: 'filtered' as const,
      formats: [
        { type: 'csv' as const, label: 'CSV', icon: FileText },
        { type: 'json' as const, label: 'JSON', icon: FileText },
        { type: 'pdf' as const, label: 'PDF', icon: FileText },
      ],
    },
    {
      id: 'security-report',
      title: 'Reporte de Seguridad',
      description: 'Eventos críticos y de seguridad',
      icon: Shield,
      scope: 'security' as const,
      formats: [
        { type: 'pdf' as const, label: 'PDF', icon: FileText },
        { type: 'csv' as const, label: 'CSV', icon: FileText },
      ],
    },
    {
      id: 'compliance-report',
      title: 'Reporte de Cumplimiento',
      description: 'Reporte completo para auditorías',
      icon: Calendar,
      scope: 'compliance' as const,
      formats: [
        { type: 'pdf' as const, label: 'PDF', icon: FileText },
      ],
    },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center gap-2 mb-6">
        <Download className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Exportar Auditoría</h3>
      </div>

      <div className="space-y-4">
        {exportOptions.map((option) => (
          <div key={option.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <option.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{option.title}</h4>
                <p className="text-sm text-gray-500 mt-1">{option.description}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {option.formats.map((format) => (
                <button
                  key={`${option.scope}-${format.type}`}
                  onClick={() => handleExport(format.type, option.scope)}
                  disabled={isExporting}
                  className="btn-secondary flex items-center gap-2 text-sm py-2 px-3"
                >
                  <format.icon className="w-4 h-4" />
                  {format.label}
                  {isExporting && <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full"></div>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Export Status */}
      {lastExport && (
        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
          lastExport.status === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {lastExport.status === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <div className="flex-1">
            <div className="font-medium">
              {lastExport.status === 'success' ? 'Exportación Exitosa' : 'Error en Exportación'}
            </div>
            <div className="text-sm">
              {lastExport.type} - {new Date(lastExport.timestamp).toLocaleString('es-MX')}
              {lastExport.message && ` - ${lastExport.message}`}
            </div>
          </div>
        </div>
      )}

      {/* Export Info */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Información de Exportación</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <p>• Los reportes PDF incluyen resúmenes ejecutivos y análisis</p>
          <p>• Los archivos CSV son compatibles con Excel y herramientas de análisis</p>
          <p>• Los datos JSON mantienen estructura completa para integración</p>
          <p>• Todas las fechas están en zona horaria de Ciudad de México</p>
          <p>• Los reportes incluyen hash de integridad para verificación</p>
        </div>
      </div>

      {/* Current Filter Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-700">
          <strong>Filtros de Exportación:</strong>
        </div>
        <div className="text-xs text-gray-600 mt-1 space-y-1">
          <div>Período: {filters.startDate} a {filters.endDate}</div>
          <div>Nivel: {filters.level === 'all' ? 'Todos' : filters.level}</div>
          <div>Categoría: {filters.category === 'all' ? 'Todas' : filters.category}</div>
          {filters.search && <div>Búsqueda: "{filters.search}"</div>}
        </div>
      </div>

      {/* Security Notice */}
      <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <strong>Aviso de Seguridad:</strong> Los reportes exportados contienen información sensible. 
            Manéjelos según las políticas de seguridad de la organización.
          </div>
        </div>
      </div>
    </div>
  );
}