import { useState, useEffect } from 'react';
import { Calendar, Filter, User, Search, RotateCcw } from 'lucide-react';

interface AuditFiltersProps {
  filters: {
    startDate: string;
    endDate: string;
    level: string;
    category: string;
    userId: string;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
}

interface User {
  id: string;
  username: string;
}

export default function AuditFilters({ filters, onFiltersChange }: AuditFiltersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });

      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleFilterChange = (field: string, value: any) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      level: 'all',
      category: 'all',
      userId: 'all',
      search: '',
    });
  };

  const getPresetDates = (preset: string) => {
    const today = new Date();
    let startDate = new Date();
    
    switch (preset) {
      case 'today':
        startDate = new Date(today);
        break;
      case 'yesterday':
        startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        today.setTime(today.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'hour':
        startDate = new Date(today.getTime() - 60 * 60 * 1000);
        break;
    }
    
    onFiltersChange({
      ...filters,
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filtros de Auditoría</h3>
        </div>
        <button
          onClick={resetFilters}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Limpiar Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Fecha Inicial
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Fecha Final
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="input-field"
          />
        </div>

        {/* Level Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nivel de Evento
          </label>
          <select
            value={filters.level}
            onChange={(e) => handleFilterChange('level', e.target.value)}
            className="input-field"
          >
            <option value="all">Todos los Niveles</option>
            <option value="info">Información</option>
            <option value="warn">Advertencia</option>
            <option value="error">Error</option>
            <option value="security">Seguridad</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categoría
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="input-field"
          >
            <option value="all">Todas las Categorías</option>
            <option value="auth">Autenticación</option>
            <option value="transaction">Transacciones</option>
            <option value="system">Sistema</option>
            <option value="operator">Operadores</option>
            <option value="hardware">Hardware</option>
            <option value="admin">Administración</option>
          </select>
        </div>

        {/* User Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-1" />
            Usuario
          </label>
          <select
            value={filters.userId}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
            className="input-field"
            disabled={isLoadingUsers}
          >
            <option value="all">Todos los Usuarios</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Search className="w-4 h-4 inline mr-1" />
            Búsqueda
          </label>
          <input
            type="text"
            placeholder="Buscar en eventos..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Quick Date Presets */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-2">Rangos Rápidos:</div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'hour', label: 'Última Hora' },
            { key: 'today', label: 'Hoy' },
            { key: 'yesterday', label: 'Ayer' },
            { key: 'week', label: 'Última Semana' },
            { key: 'month', label: 'Este Mes' },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => getPresetDates(preset.key)}
              className="btn-secondary text-sm py-1 px-3"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-700">
          <strong>Filtros Activos:</strong>
        </div>
        <div className="text-xs text-gray-600 mt-1 space-y-1">
          <div>Período: {filters.startDate} a {filters.endDate}</div>
          <div className="flex flex-wrap gap-2">
            {filters.level !== 'all' && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                Nivel: {filters.level}
              </span>
            )}
            {filters.category !== 'all' && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                Categoría: {filters.category}
              </span>
            )}
            {filters.userId !== 'all' && (
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                Usuario: {users.find(u => u.id === filters.userId)?.username || filters.userId}
              </span>
            )}
            {filters.search && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                Búsqueda: "{filters.search}"
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}