import { Calendar, Filter, Clock } from 'lucide-react';

interface ReportFiltersProps {
  filters: {
    startDate: string;
    endDate: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    transactionType: 'all' | 'parking' | 'pension' | 'partner' | 'lost_ticket' | 'refund';
  };
  onFiltersChange: (filters: any) => void;
}

export default function ReportFilters({ filters, onFiltersChange }: ReportFiltersProps) {
  const handleFilterChange = (field: string, value: any) => {
    const newFilters = { ...filters, [field]: value };
    
    // Auto-adjust date range based on report type
    if (field === 'reportType') {
      const today = new Date();
      let startDate = new Date();
      
      switch (value) {
        case 'daily':
          startDate = new Date(today);
          break;
        case 'weekly':
          startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
      }
      
      newFilters.startDate = startDate.toISOString().split('T')[0];
      newFilters.endDate = today.toISOString().split('T')[0];
    }
    
    onFiltersChange(newFilters);
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
      case 'quarter':
        const quarterStart = Math.floor(today.getMonth() / 3) * 3;
        startDate = new Date(today.getFullYear(), quarterStart, 1);
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
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Filtros de Reporte</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Report Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Tipo de Reporte
          </label>
          <select
            value={filters.reportType}
            onChange={(e) => handleFilterChange('reportType', e.target.value)}
            className="input-field"
          >
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>

        {/* Transaction Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Transacción
          </label>
          <select
            value={filters.transactionType}
            onChange={(e) => handleFilterChange('transactionType', e.target.value)}
            className="input-field"
          >
            <option value="all">Todas</option>
            <option value="parking">Estacionamiento</option>
            <option value="pension">Pensión</option>
            <option value="partner">Socio Comercial</option>
            <option value="lost_ticket">Boleto Perdido</option>
            <option value="refund">Reembolso</option>
          </select>
        </div>
      </div>

      {/* Quick Date Presets */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-2">Rangos Rápidos:</div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'today', label: 'Hoy' },
            { key: 'yesterday', label: 'Ayer' },
            { key: 'week', label: 'Última Semana' },
            { key: 'month', label: 'Este Mes' },
            { key: 'quarter', label: 'Este Trimestre' },
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
    </div>
  );
}