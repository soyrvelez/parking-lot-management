import { useState, useEffect } from 'react';
import { Search, Filter, Calendar, User, AlertTriangle, CheckCircle, Info, XCircle, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import moment from 'moment-timezone';

interface AuditLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'security';
  category: 'auth' | 'transaction' | 'system' | 'operator' | 'hardware' | 'admin';
  action: string;
  userId?: string;
  userName?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface AuditLogData {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

interface AuditLogViewerProps {
  filters: {
    startDate: string;
    endDate: string;
    level: string;
    category: string;
    userId: string;
    search: string;
  };
}

export default function AuditLogViewer({ filters }: AuditLogViewerProps) {
  const [data, setData] = useState<AuditLogData>({
    logs: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [sortBy, setSortBy] = useState<'timestamp' | 'level' | 'category'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchAuditLogs();
  }, [filters, currentPage, sortBy, sortOrder]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        level: filters.level,
        category: filters.category,
        userId: filters.userId,
        search: filters.search,
        page: currentPage.toString(),
        limit: '25',
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/admin/audit/logs?${queryParams}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const auditData = await response.json();
        setData(auditData);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return Info;
      case 'warn': return AlertTriangle;
      case 'error': return XCircle;
      case 'security': return CheckCircle;
      default: return Info;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-600 bg-blue-100';
      case 'warn': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'security': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'auth': return 'text-green-700 bg-green-100';
      case 'transaction': return 'text-blue-700 bg-blue-100';
      case 'system': return 'text-purple-700 bg-purple-100';
      case 'operator': return 'text-orange-700 bg-orange-100';
      case 'hardware': return 'text-gray-700 bg-gray-100';
      case 'admin': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'auth': return 'Autenticación';
      case 'transaction': return 'Transacción';
      case 'system': return 'Sistema';
      case 'operator': return 'Operador';
      case 'hardware': return 'Hardware';
      case 'admin': return 'Administración';
      default: return category;
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'info': return 'Información';
      case 'warn': return 'Advertencia';
      case 'error': return 'Error';
      case 'security': return 'Seguridad';
      default: return level;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
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
          <h3 className="text-lg font-semibold text-gray-900">Registro de Eventos</h3>
          <p className="text-sm text-gray-500">{data.total} eventos encontrados</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input-field text-sm"
          >
            <option value="timestamp">Fecha</option>
            <option value="level">Nivel</option>
            <option value="category">Categoría</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary px-3 py-2"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {data.logs.length === 0 ? (
          <div className="text-center py-8">
            <Search className="mx-auto w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-500">No se encontraron eventos para los filtros seleccionados</p>
          </div>
        ) : (
          data.logs.map((log) => {
            const LevelIcon = getLevelIcon(log.level);
            
            return (
              <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getLevelColor(log.level)}`}>
                      <LevelIcon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{log.action}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                          {getCategoryText(log.category)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(log.level)}`}>
                          {getLevelText(log.level)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-4">
                          <span>
                            {moment.tz(log.timestamp, 'America/Mexico_City').format('DD/MM/YY HH:mm:ss')}
                          </span>
                          {log.userName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.userName}
                            </span>
                          )}
                          {log.ipAddress && (
                            <span className="text-xs text-gray-500">
                              IP: {log.ipAddress}
                            </span>
                          )}
                        </div>
                        
                        {Object.keys(log.details).length > 0 && (
                          <div className="text-xs text-gray-500">
                            {Object.entries(log.details).slice(0, 2).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            ))}
                            {Object.keys(log.details).length > 2 && <span>...</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedLog(log)}
                    className="btn-secondary p-2 ml-4"
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Página {data.page} de {data.totalPages} ({data.total} eventos total)
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn-secondary flex items-center gap-1 px-3 py-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            
            <span className="px-3 py-2 text-sm text-gray-600">
              {currentPage} / {data.totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
              disabled={currentPage === data.totalPages}
              className="btn-secondary flex items-center gap-1 px-3 py-2"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedLog(null)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Detalles del Evento</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Fecha y Hora</label>
                      <div className="text-sm text-gray-900">
                        {moment.tz(selectedLog.timestamp, 'America/Mexico_City').format('DD/MM/YYYY HH:mm:ss')}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">ID de Sesión</label>
                      <div className="text-sm text-gray-900 font-mono">
                        {selectedLog.sessionId || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Acción</label>
                    <div className="text-sm text-gray-900">{selectedLog.action}</div>
                  </div>

                  {selectedLog.userName && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Usuario</label>
                      <div className="text-sm text-gray-900">{selectedLog.userName}</div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700">Detalles</label>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {selectedLog.userAgent && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">User Agent</label>
                      <div className="text-xs text-gray-600 break-all">{selectedLog.userAgent}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}