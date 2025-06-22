import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import AuditLogViewer from '@/components/admin/audit/AuditLogViewer';
import AuditFilters from '@/components/admin/audit/AuditFilters';
import AuditStats from '@/components/admin/audit/AuditStats';
import AuditExport from '@/components/admin/audit/AuditExport';
import { Shield, Activity, AlertTriangle } from 'lucide-react';

export default function AdminAudit() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    level: 'all',
    category: 'all',
    userId: 'all',
    search: '',
  });

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }

      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminToken');
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              Registro de Auditoría
            </h1>
            <p className="text-gray-600 mt-2">
              Monitoreo completo de actividades del sistema y operadores
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 px-3 py-2 rounded-lg">
              <Activity className="w-4 h-4 text-green-600" />
              <span>Registro Activo</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-yellow-50 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span>Retención: 90 días</span>
            </div>
          </div>
        </div>

        {/* Audit Statistics */}
        <AuditStats filters={filters} />

        {/* Filters */}
        <AuditFilters filters={filters} onFiltersChange={setFilters} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Audit Log Viewer */}
          <div className="xl:col-span-3">
            <AuditLogViewer filters={filters} />
          </div>

          {/* Export and Tools */}
          <div className="space-y-6">
            <AuditExport filters={filters} />
            
            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
              <div className="space-y-3">
                <button className="btn-secondary w-full flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Ver Eventos Críticos
                </button>
                <button className="btn-secondary w-full flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Detectar Anomalías
                </button>
                <button className="btn-secondary w-full flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Generar Reporte Seguridad
                </button>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Sistema</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nivel de Auditoría:</span>
                  <span className="font-medium text-blue-600">Completo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Compresión:</span>
                  <span className="font-medium text-green-600">Habilitada</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Respaldo:</span>
                  <span className="font-medium text-green-600">Automático</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Encriptación:</span>
                  <span className="font-medium text-green-600">AES-256</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}