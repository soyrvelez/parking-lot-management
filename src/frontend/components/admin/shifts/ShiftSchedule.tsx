import { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, Clock, User, Save } from 'lucide-react';
import moment from 'moment-timezone';

interface ShiftSchedule {
  id: string;
  operatorId: string;
  operatorName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  notes?: string;
}

interface Operator {
  id: string;
  name: string;
  isActive: boolean;
}

export default function ShiftSchedule() {
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(moment.tz('America/Mexico_City').startOf('week'));
  const [editingSchedule, setEditingSchedule] = useState<ShiftSchedule | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchOperators();
  }, [selectedWeek]);

  const fetchSchedules = async () => {
    try {
      const startDate = selectedWeek.format('YYYY-MM-DD');
      const endDate = selectedWeek.clone().endOf('week').format('YYYY-MM-DD');
      
      const response = await fetch(`/api/admin/shifts/schedule?startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const fetchOperators = async () => {
    try {
      const response = await fetch('/api/admin/operators', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setOperators(data);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(selectedWeek.clone().add(i, 'day'));
    }
    return days;
  };

  const getSchedulesForDay = (date: moment.Moment) => {
    return schedules.filter(schedule => 
      moment.tz(schedule.date, 'America/Mexico_City').isSame(date, 'day')
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Programado';
      case 'active': return 'Activo';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schedule Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Programación de Turnos</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedWeek(selectedWeek.clone().subtract(1, 'week'))}
                className="btn-secondary px-3 py-2"
              >
                ←
              </button>
              <span className="text-sm text-gray-600 min-w-[200px] text-center">
                {selectedWeek.format('DD/MM/YYYY')} - {selectedWeek.clone().endOf('week').format('DD/MM/YYYY')}
              </span>
              <button
                onClick={() => setSelectedWeek(selectedWeek.clone().add(1, 'week'))}
                className="btn-secondary px-3 py-2"
              >
                →
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedWeek(moment.tz('America/Mexico_City').startOf('week'))}
              className="btn-secondary"
            >
              Semana Actual
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Programar Turno
            </button>
          </div>
        </div>

        {/* Week Calendar */}
        <div className="grid grid-cols-7 gap-4">
          {getWeekDays().map((day, index) => {
            const daySchedules = getSchedulesForDay(day);
            const isToday = day.isSame(moment.tz('America/Mexico_City'), 'day');
            
            return (
              <div
                key={index}
                className={`border rounded-lg p-3 min-h-[200px] ${
                  isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="text-center mb-3">
                  <div className="text-sm font-medium text-gray-900">
                    {day.format('dddd')}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {day.format('DD')}
                  </div>
                </div>

                <div className="space-y-2">
                  {daySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-2 rounded text-xs border ${getStatusColor(schedule.status)}`}
                    >
                      <div className="font-medium">{schedule.operatorName}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {schedule.startTime} - {schedule.endTime}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => setEditingSchedule(schedule)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Turnos Programados</div>
              <div className="text-2xl font-bold text-gray-900">
                {schedules.filter(s => s.status === 'scheduled').length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Operadores Activos</div>
              <div className="text-2xl font-bold text-gray-900">
                {schedules.filter(s => s.status === 'active').length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Horas Totales</div>
              <div className="text-2xl font-bold text-gray-900">
                {schedules.reduce((total, schedule) => {
                  const start = moment.tz(`${schedule.date} ${schedule.startTime}`, 'YYYY-MM-DD HH:mm', 'America/Mexico_City');
                  const end = moment.tz(`${schedule.date} ${schedule.endTime}`, 'YYYY-MM-DD HH:mm', 'America/Mexico_City');
                  return total + moment.duration(end.diff(start)).asHours();
                }, 0).toFixed(0)}h
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-600">Cobertura</div>
              <div className="text-2xl font-bold text-gray-900">
                {schedules.length > 0 ? Math.round((schedules.filter(s => s.status !== 'cancelled').length / (7 * 3)) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Schedule Form Modal */}
      {(showAddForm || editingSchedule) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => {
              setShowAddForm(false);
              setEditingSchedule(null);
            }}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingSchedule ? 'Editar Turno' : 'Programar Nuevo Turno'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingSchedule(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operador
                    </label>
                    <select
                      defaultValue={editingSchedule?.operatorId || ''}
                      className="input-field"
                    >
                      <option value="">Seleccionar operador</option>
                      {operators.filter(op => op.isActive).map(operator => (
                        <option key={operator.id} value={operator.id}>
                          {operator.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha
                    </label>
                    <input
                      type="date"
                      defaultValue={editingSchedule?.date || selectedWeek.format('YYYY-MM-DD')}
                      className="input-field"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de Inicio
                      </label>
                      <input
                        type="time"
                        defaultValue={editingSchedule?.startTime || '08:00'}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de Fin
                      </label>
                      <input
                        type="time"
                        defaultValue={editingSchedule?.endTime || '16:00'}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas (Opcional)
                    </label>
                    <textarea
                      defaultValue={editingSchedule?.notes || ''}
                      className="input-field"
                      rows={3}
                      placeholder="Notas adicionales sobre el turno..."
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="submit"
                      className="btn-primary flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingSchedule ? 'Actualizar' : 'Programar'} Turno
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingSchedule(null);
                      }}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Schedule Templates */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plantillas Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Turno Matutino</h4>
            <p className="text-sm text-gray-600 mb-3">08:00 - 16:00 (8 horas)</p>
            <button className="btn-secondary w-full text-sm">Aplicar Plantilla</button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Turno Vespertino</h4>
            <p className="text-sm text-gray-600 mb-3">16:00 - 00:00 (8 horas)</p>
            <button className="btn-secondary w-full text-sm">Aplicar Plantilla</button>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Horario Completo</h4>
            <p className="text-sm text-gray-600 mb-3">Lunes a Domingo</p>
            <button className="btn-secondary w-full text-sm">Aplicar Plantilla</button>
          </div>
        </div>
      </div>
    </div>
  );
}