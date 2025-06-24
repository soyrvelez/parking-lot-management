import { useState, useEffect } from 'react';
import { 
  Building2, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  MoreVertical,
  Eye
} from 'lucide-react';
import { useAdminAuth } from '../../../hooks/useAdminAuth';

interface PartnerBusiness {
  id: string;
  name: string;
  businessType: string;
  flatRate?: string;
  hourlyRate?: string;
  maxHours?: number;
  validDays: string;
  validTimeStart?: string;
  validTimeEnd?: string;
  description?: string;
  specialInstructions?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    partnerTickets: number;
  };
}

interface PartnerBusinessListProps {
  onEditPartner: (partner: PartnerBusiness) => void;
  refreshTrigger: number;
}

export default function PartnerBusinessList({ onEditPartner, refreshTrigger }: PartnerBusinessListProps) {
  const { authenticatedFetch } = useAdminAuth();
  const [partners, setPartners] = useState<PartnerBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    loadPartners();
  }, [refreshTrigger]);

  const loadPartners = async () => {
    try {
      setLoading(true);
      setError('');

      const queryParams = new URLSearchParams();
      if (filterActive !== 'all') {
        queryParams.append('isActive', filterActive === 'active' ? 'true' : 'false');
      }
      if (filterType) {
        queryParams.append('businessType', filterType);
      }
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }

      const response = await authenticatedFetch(`/api/partner/businesses?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setPartners(data.data || []);
      } else {
        setError(data.message || 'Error al cargar socios comerciales');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await authenticatedFetch(`/api/partner/businesses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: !currentStatus
        }),
      });

      const data = await response.json();

      if (data.success) {
        loadPartners(); // Refresh the list
      } else {
        setError(data.message || 'Error al actualizar estado');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el socio comercial "${name}"?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/partner/businesses/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        loadPartners(); // Refresh the list
      } else {
        setError(data.message || 'Error al eliminar socio comercial');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  const formatRate = (partner: PartnerBusiness) => {
    if (partner.flatRate) {
      return `$${partner.flatRate} pesos fijos`;
    }
    if (partner.hourlyRate) {
      const maxHours = partner.maxHours ? ` (máx. ${partner.maxHours}h)` : '';
      return `$${partner.hourlyRate}/hora${maxHours}`;
    }
    return 'Sin configurar';
  };

  const formatBusinessHours = (partner: PartnerBusiness) => {
    try {
      const validDays = JSON.parse(partner.validDays || '[]');
      const daysText = validDays.join(', ');
      
      if (partner.validTimeStart && partner.validTimeEnd) {
        return `${daysText}: ${partner.validTimeStart} - ${partner.validTimeEnd}`;
      }
      
      return daysText || 'Todos los días';
    } catch {
      return 'No configurado';
    }
  };

  const getBusinessTypes = () => {
    const types = new Set(partners.map(p => p.businessType));
    return Array.from(types).sort();
  };

  const filteredPartners = partners.filter(partner => {
    if (searchTerm && !partner.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !partner.businessType.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando socios comerciales...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o tipo de negocio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los tipos</option>
            {getBusinessTypes().map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <button
            onClick={loadPartners}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Partners List */}
      <div className="bg-white shadow border border-gray-200 rounded-lg overflow-hidden">
        {filteredPartners.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay socios comerciales</h3>
            <p className="mt-1 text-sm text-gray-500">
              {partners.length === 0 ? 'Comience creando su primer socio comercial.' : 'No se encontraron resultados con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Negocio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarifa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Horarios
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tickets
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {partner.name}
                        </div>
                        {partner.description && (
                          <div className="text-sm text-gray-500">
                            {partner.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{partner.businessType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm text-gray-900">{formatRate(partner)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-blue-500 mr-1" />
                        <span className="text-sm text-gray-900">{formatBusinessHours(partner)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(partner.id, partner.isActive)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          partner.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {partner.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Activo
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {partner._count?.partnerTickets || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEditPartner(partner)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(partner.id, partner.name)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {partners.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{partners.length}</div>
              <div className="text-sm text-gray-500">Total Socios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {partners.filter(p => p.isActive).length}
              </div>
              <div className="text-sm text-gray-500">Activos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {partners.filter(p => !p.isActive).length}
              </div>
              <div className="text-sm text-gray-500">Inactivos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {partners.reduce((acc, p) => acc + (p._count?.partnerTickets || 0), 0)}
              </div>
              <div className="text-sm text-gray-500">Total Tickets</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}