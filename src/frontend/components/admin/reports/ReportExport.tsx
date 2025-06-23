import { useState } from 'react';
import { Download, FileText, Table, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

interface ReportExportProps {
  filters: {
    startDate: string;
    endDate: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    transactionType: string;
  };
}

export default function ReportExport({ filters }: ReportExportProps) {
  const { authenticatedFetch } = useAdminAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{
    type: string;
    timestamp: string;
    status: 'success' | 'error';
    message?: string;
  } | null>(null);

  const handleExport = async (exportType: 'csv' | 'pdf', reportScope: 'summary' | 'detailed' | 'transactions') => {
    setIsExporting(true);
    setLastExport(null);

    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        reportType: filters.reportType,
        transactionType: filters.transactionType,
        exportType,
        reportScope,
      });

      const response = await authenticatedFetch(`/api/admin/reports/export?${queryParams}`, {
        method: 'GET',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with current date and filters
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `reporte-${reportScope}-${filters.reportType}-${dateStr}.${exportType}`;
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
          message: error.error?.message || error.message || error.error || 'Error desconocido',
        });
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      setLastExport({
        type: `${reportScope} (${exportType.toUpperCase()})`,
        timestamp: new Date().toISOString(),
        status: 'error',
        message: error instanceof Error ? error.message : 'Error de conexión',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      id: 'summary-csv',
      title: 'Resumen Ejecutivo',
      description: 'Métricas principales y KPIs',
      icon: Table,
      scope: 'summary' as const,
      formats: [
        { type: 'csv' as const, label: 'CSV', icon: Table },
        { type: 'pdf' as const, label: 'PDF', icon: FileText },
      ],
    },
    {
      id: 'detailed-csv',
      title: 'Reporte Detallado',
      description: 'Análisis completo con gráficos',
      icon: FileText,
      scope: 'detailed' as const,
      formats: [
        { type: 'pdf' as const, label: 'PDF', icon: FileText },
      ],
    },
    {
      id: 'transactions-csv',
      title: 'Historial de Transacciones',
      description: 'Todas las transacciones del período',
      icon: Calendar,
      scope: 'transactions' as const,
      formats: [
        { type: 'csv' as const, label: 'CSV', icon: Table },
      ],
    },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center gap-2 mb-6">
        <Download className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Exportar Reportes</h3>
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
          <p>• Los archivos CSV son compatibles con Excel y Google Sheets</p>
          <p>• Los reportes PDF incluyen gráficos y análisis visual</p>
          <p>• Todos los montos se exportan en pesos mexicanos (MXN)</p>
          <p>• Las fechas utilizan zona horaria de Ciudad de México</p>
        </div>
      </div>

      {/* Current Filter Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-700">
          <strong>Filtros Actuales:</strong>
        </div>
        <div className="text-xs text-gray-600 mt-1 space-y-1">
          <div>Período: {filters.startDate} a {filters.endDate}</div>
          <div>Tipo: {filters.reportType === 'daily' ? 'Diario' : filters.reportType === 'weekly' ? 'Semanal' : 'Mensual'}</div>
          <div>Transacciones: {filters.transactionType === 'all' ? 'Todas' : filters.transactionType}</div>
        </div>
      </div>
    </div>
  );
}