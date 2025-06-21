import { useState, useEffect } from 'react';
import { Car, Clock, DollarSign, Search, Filter, MoreVertical } from 'lucide-react';
import moment from 'moment-timezone';
import Decimal from 'decimal.js';

interface Ticket {
  id: string;
  plateNumber: string;
  entryTime: string;
  estimatedAmount: string;
  status: 'ACTIVE' | 'PAID' | 'LOST';
  duration: string;
}

interface ActiveTicketsData {
  tickets: Ticket[];
  total: number;
}

export default function ActiveTickets() {
  const [data, setData] = useState<ActiveTicketsData>({ tickets: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'entryTime' | 'plateNumber' | 'estimatedAmount'>('entryTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchActiveTickets();
    const interval = setInterval(fetchActiveTickets, 20000); // Update every 20 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchActiveTickets = async () => {
    try {
      const response = await fetch('/api/admin/tickets/active', {
        credentials: 'include',
      });

      if (response.ok) {
        const ticketsData = await response.json();
        setData(ticketsData);
      }
    } catch (error) {
      console.error('Error fetching active tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTickets = data.tickets
    .filter(ticket => 
      ticket.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (sortBy === 'estimatedAmount') {
        aValue = new Decimal(aValue).toNumber();
        bValue = new Decimal(bValue).toNumber();
      } else if (sortBy === 'entryTime') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const formatCurrency = (amount: string) => {
    const value = new Decimal(amount);
    return `$${value.toFixed(2)}`;
  };

  const formatDuration = (entryTime: string) => {
    const entry = moment.tz(entryTime, 'America/Mexico_City');
    const now = moment.tz('America/Mexico_City');
    const duration = moment.duration(now.diff(entry));
    
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
      case 'PAID': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOST': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Activo';
      case 'PAID': return 'Pagado';
      case 'LOST': return 'Perdido';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
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
          <h3 className="text-lg font-semibold text-gray-900">Boletos Activos</h3>
          <p className="text-sm text-gray-500">{data.total} vehículos en el estacionamiento</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por placa o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input-field"
          >
            <option value="entryTime">Hora de Entrada</option>
            <option value="plateNumber">Placa</option>
            <option value="estimatedAmount">Monto</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary px-3"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-8">
            <Car className="mx-auto w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-500">
              {searchTerm ? 'No se encontraron boletos' : 'No hay vehículos en el estacionamiento'}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Car className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-lg">{ticket.plateNumber}</div>
                    <div className="text-sm text-gray-500">ID: {ticket.id.slice(-8)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {formatDuration(ticket.entryTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {moment.tz(ticket.entryTime, 'America/Mexico_City').format('DD/MM HH:mm')}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                      <DollarSign className="w-4 h-4" />
                      {formatCurrency(ticket.estimatedAmount)}
                    </div>
                    <div className="text-xs text-gray-500">MXN</div>
                  </div>

                  <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                    {getStatusText(ticket.status)}
                  </div>

                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredTickets.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Mostrando {filteredTickets.length} de {data.total} boletos
            </span>
            <span className="font-medium text-gray-900">
              Total estimado: {formatCurrency(
                filteredTickets.reduce((sum, ticket) => 
                  sum.plus(new Decimal(ticket.estimatedAmount)), new Decimal(0)
                ).toString()
              )} MXN
            </span>
          </div>
        </div>
      )}
    </div>
  );
}