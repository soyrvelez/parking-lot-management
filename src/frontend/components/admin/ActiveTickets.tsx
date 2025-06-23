import { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Car, Clock, DollarSign, Search, Filter, MoreVertical, Eye, CreditCard, AlertTriangle, Trash2, XCircle } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'entryTime' | 'plateNumber' | 'estimatedAmount'>('entryTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveTickets();
    const interval = setInterval(fetchActiveTickets, 2 * 60 * 1000); // Much less aggressive polling - every 2 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const { authenticatedFetch } = useAdminAuth();

  const fetchActiveTickets = async () => {
    try {
      const response = await authenticatedFetch('/api/admin/tickets/active');

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
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

  const handleTicketAction = async (ticketId: string, action: string) => {
    setShowDropdown(null);
    
    try {
      switch (action) {
        case 'view':
          await handleViewTicketDetails(ticketId);
          break;
        case 'process-payment':
          await handleProcessPayment(ticketId);
          break;
        case 'mark-lost':
          await handleMarkAsLost(ticketId);
          break;
        case 'void':
          await handleVoidTicket(ticketId);
          break;
        case 'delete':
          await handleDeleteTicket(ticketId);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error handling ticket action:', error);
      alert('Error al procesar la acción. Intente nuevamente.');
    }
  };

  const handleViewTicketDetails = async (ticketId: string) => {
    try {
      const response = await authenticatedFetch(`/api/admin/tickets/${ticketId}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const ticket = result.data.ticket;
          const transactions = result.data.transactions;
          
          let detailsMessage = `DETALLES DEL BOLETO\n\n`;
          detailsMessage += `Placa: ${ticket.plateNumber}\n`;
          detailsMessage += `Código: ${ticket.barcode}\n`;
          detailsMessage += `Entrada: ${moment.tz(ticket.entryTime, 'America/Mexico_City').format('DD/MM/YYYY HH:mm')}\n`;
          detailsMessage += `Estado: ${getStatusText(ticket.status)}\n`;
          detailsMessage += `Tarifa Actual: $${ticket.currentFee}\n`;
          
          if (ticket.exitTime) {
            detailsMessage += `Salida: ${moment.tz(ticket.exitTime, 'America/Mexico_City').format('DD/MM/YYYY HH:mm')}\n`;
          }
          
          if (transactions.length > 0) {
            detailsMessage += `\n--- TRANSACCIONES ---\n`;
            transactions.forEach((t: any) => {
              detailsMessage += `${moment.tz(t.timestamp, 'America/Mexico_City').format('DD/MM HH:mm')} - ${t.type}: $${t.amount}\n`;
            });
          }
          
          alert(detailsMessage);
        }
      } else {
        alert('Error al obtener detalles del boleto');
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      alert('Error al conectar con el servidor');
    }
  };

  const handleProcessPayment = async (ticketId: string) => {
    const ticket = data.tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    try {
      // Get current ticket details to get accurate fee calculation
      const detailsResponse = await authenticatedFetch(`/api/admin/tickets/${ticketId}`);
      if (!detailsResponse.ok) {
        alert('Error al obtener detalles del boleto');
        return;
      }
      
      const detailsResult = await detailsResponse.json();
      if (!detailsResult.success) {
        alert('Error al obtener detalles del boleto');
        return;
      }
      
      const currentFee = parseFloat(detailsResult.data.ticket.currentFee);
      const duration = moment.tz('America/Mexico_City').diff(moment.tz(ticket.entryTime, 'America/Mexico_City'), 'minutes');
      const hours = Math.ceil(duration / 60);
      
      const confirmMessage = `PROCESAR PAGO\n\nPlaca: ${ticket.plateNumber}\nTiempo: ${hours} hora(s)\nTotal a cobrar: $${currentFee.toFixed(2)}\n\n¿Confirmar pago en efectivo?`;
      
      if (confirm(confirmMessage)) {
        const response = await authenticatedFetch(`/api/admin/tickets/${ticketId}/payment`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentMethod: 'CASH',
            amountPaid: currentFee
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            alert(`¡Pago procesado exitosamente!\n\nMonto: $${result.data.transaction.amount}\nRecibo: ${result.data.transaction.description}`);
            // Refresh the data
            fetchActiveTickets();
          } else {
            alert('Error al procesar el pago: ' + result.error.message);
          }
        } else {
          alert('Error al procesar el pago');
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error al conectar con el servidor');
    }
  };

  const handleMarkAsLost = async (ticketId: string) => {
    const ticket = data.tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    try {
      // Get pricing configuration to show correct lost ticket fee
      const configResponse = await authenticatedFetch('/api/admin/config/pricing');
      let lostTicketFee = 50.00; // Default fallback
      
      if (configResponse.ok) {
        const configResult = await configResponse.json();
        if (configResult.success) {
          lostTicketFee = parseFloat(configResult.data.lostTicketFee);
        }
      }
      
      const confirmMessage = `MARCAR COMO PERDIDO\n\nPlaca: ${ticket.plateNumber}\nTarifa por boleto perdido: $${lostTicketFee.toFixed(2)}\n\n¿Confirmar cobro?`;
      
      if (confirm(confirmMessage)) {
        const response = await authenticatedFetch(`/api/admin/tickets/${ticketId}/lost`, {
          method: 'PUT'
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            alert(`¡Boleto marcado como perdido!\n\nMonto cobrado: $${result.data.transaction.amount}\nRecibo: ${result.data.transaction.description}`);
            // Refresh the data
            fetchActiveTickets();
          } else {
            alert('Error al marcar como perdido: ' + result.error.message);
          }
        } else {
          alert('Error al marcar como perdido');
        }
      }
    } catch (error) {
      console.error('Error marking as lost:', error);
      alert('Error al conectar con el servidor');
    }
  };

  const handleVoidTicket = async (ticketId: string) => {
    const ticket = data.tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const confirmMessage = `ANULAR BOLETO\n\nPlaca: ${ticket.plateNumber}\nID: ${ticketId.slice(-8)}\n\nEsta acción marcará el boleto como anulado.\nNo se generará ningún cargo.\n\n¿Confirmar anulación?`;
    
    if (confirm(confirmMessage)) {
      try {
        const response = await authenticatedFetch(`/api/admin/tickets/${ticketId}/void`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: 'Anulado por administrador'
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            alert('¡Boleto anulado exitosamente!');
            fetchActiveTickets();
          } else {
            alert('Error al anular el boleto: ' + result.error.message);
          }
        } else {
          alert('Error al anular el boleto');
        }
      } catch (error) {
        console.error('Error voiding ticket:', error);
        alert('Error al conectar con el servidor');
      }
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const ticket = data.tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const confirmMessage = `⚠️ ELIMINAR BOLETO\n\nPlaca: ${ticket.plateNumber}\nID: ${ticketId.slice(-8)}\n\nEsta acción eliminará permanentemente el boleto del sistema.\nEsta operación NO se puede deshacer.\n\n¿Está seguro de eliminar este boleto?`;
    
    if (confirm(confirmMessage)) {
      // Double confirmation for delete
      const secondConfirm = prompt(`Para confirmar la eliminación, escriba "ELIMINAR":`);
      
      if (secondConfirm === 'ELIMINAR') {
        try {
          const response = await authenticatedFetch(`/api/admin/tickets/${ticketId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              reason: 'Eliminado por administrador'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              alert('Boleto eliminado del sistema.');
              fetchActiveTickets();
            } else {
              alert('Error al eliminar el boleto: ' + result.error.message);
            }
          } else {
            alert('Error al eliminar el boleto');
          }
        } catch (error) {
          console.error('Error deleting ticket:', error);
          alert('Error al conectar con el servidor');
        }
      } else {
        alert('Eliminación cancelada');
      }
    }
  };

  const toggleDropdown = (ticketId: string) => {
    setShowDropdown(showDropdown === ticketId ? null : ticketId);
  };

  if (isLoading) {
    return (
      <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/3 mb-3 sm:mb-4"></div>
          <div className="space-y-2 sm:space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 sm:h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Boletos Activos</h3>
          <p className="text-xs sm:text-sm text-gray-500">{data.total} vehículos en el estacionamiento</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por placa o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-8 sm:pl-10 text-sm sm:text-base"
          />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input-field text-xs sm:text-sm min-w-0 flex-1 sm:flex-initial"
          >
            <option value="entryTime">Hora de Entrada</option>
            <option value="plateNumber">Placa</option>
            <option value="estimatedAmount">Monto</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary px-2 sm:px-3 py-2 text-sm sm:text-base flex-shrink-0"
            aria-label={`Ordenar ${sortOrder === 'asc' ? 'descendente' : 'ascendente'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <Car className="mx-auto w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-gray-400 mb-2 sm:mb-3" />
            <p className="text-gray-500 text-sm sm:text-base">
              {searchTerm ? 'No se encontraron boletos' : 'No hay vehículos en el estacionamiento'}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
              {/* Mobile Layout */}
              <div className="block sm:hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Car className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-bold text-base truncate">{ticket.plateNumber}</div>
                      <div className="text-xs text-gray-500 truncate">ID: {ticket.id.slice(-8)}</div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(ticket.status)}`}>
                    {getStatusText(ticket.status)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{formatDuration(ticket.entryTime)}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {moment.tz(ticket.entryTime, 'America/Mexico_City').format('DD/MM HH:mm')}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(ticket.estimatedAmount)}
                    <span className="text-xs text-gray-500 ml-1">MXN</span>
                  </div>
                  <div className="relative" ref={showDropdown === ticket.id ? dropdownRef : null}>
                    <button 
                      className="p-2 text-gray-400 hover:text-gray-600 touch-manipulation"
                      onClick={() => toggleDropdown(ticket.id)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {showDropdown === ticket.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'view');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Detalles
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'process-payment');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 touch-manipulation"
                          >
                            <CreditCard className="w-4 h-4" />
                            Procesar Pago
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'mark-lost');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 touch-manipulation"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            Marcar como Perdido
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'void');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 touch-manipulation"
                          >
                            <XCircle className="w-4 h-4" />
                            Anular Boleto
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'delete');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 touch-manipulation"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar Boleto
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex items-center gap-3 lg:gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Car className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-base lg:text-lg truncate">{ticket.plateNumber}</div>
                    <div className="text-sm text-gray-500 truncate">ID: {ticket.id.slice(-8)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>{formatDuration(ticket.entryTime)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {moment.tz(ticket.entryTime, 'America/Mexico_City').format('DD/MM HH:mm')}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base lg:text-lg font-bold text-green-600">
                      {formatCurrency(ticket.estimatedAmount)}
                    </div>
                    <div className="text-xs text-gray-500">MXN</div>
                  </div>

                  <div className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(ticket.status)}`}>
                    {getStatusText(ticket.status)}
                  </div>

                  <div className="relative" ref={showDropdown === ticket.id ? dropdownRef : null}>
                    <button 
                      className="p-2 text-gray-400 hover:text-gray-600"
                      onClick={() => toggleDropdown(ticket.id)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {showDropdown === ticket.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'view');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Detalles
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'process-payment');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <CreditCard className="w-4 h-4" />
                            Procesar Pago
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'mark-lost');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            Marcar como Perdido
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'void');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Anular Boleto
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTicketAction(ticket.id, 'delete');
                            }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar Boleto
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredTickets.length > 0 && (
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
            <span className="text-gray-600 truncate">
              Mostrando {filteredTickets.length} de {data.total} boletos
            </span>
            <span className="font-medium text-gray-900 truncate">
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